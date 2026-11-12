import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function respond(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Méthode non autorisée.' }, 405);
  try {
    if (Number(req.headers.get('content-length') || 0) > 2900000) return respond({ error: 'Image trop volumineuse.' }, 413);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return respond({ error: 'Connexion requise.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return respond({ error: 'Session invalide.' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: account, error: accountError } = await admin.from('comptes').select('data').eq('id', user.id).maybeSingle();
    if (accountError || !account) return respond({ error: 'Compte indisponible.' }, 403);
    const role = account.data?.role;
    const text = await req.text();
    if (text.length > 2900000) return respond({ error: 'Image trop volumineuse.' }, 413);
    const body = JSON.parse(text) as { action?: string; accountId?: string; mime?: string; image?: string; decision?: string };
    if (body.action === 'submit') {
      if (role !== 'directeur') return respond({ error: 'Réservé aux directrices.' }, 403);
      const image = typeof body.image === 'string' ? body.image : '';
      const mime = body.mime;
      if (!image || image.length > 2796204 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image) || (mime !== 'image/jpeg' && mime !== 'image/png')) return respond({ error: 'Image invalide.' }, 400);
      const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0));
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v);
      if (!bytes.length || bytes.length > 2097152 || (mime === 'image/jpeg' ? !jpeg : !png)) return respond({ error: 'Utilisez une image JPEG ou PNG valide de 2 Mo maximum.' }, 400);
      const { error } = await admin.rpc('rawdha_submit_identity_document', { p_account_id: user.id, p_mime: mime, p_base64: image });
      if (error) return respond({ error: error.message.includes('review_already_pending') ? 'Une demande est déjà en cours.' : 'Envoi impossible. Vérifiez le nom du compte et réessayez.' }, 409);
      return respond({ status: 'pending' });
    }
    if (role !== 'admin') return respond({ error: 'Réservé aux super administrateurs.' }, 403);
    const { data: isSuperAdmin, error: permissionError } = await admin.rpc('rawdha_identity_is_super_admin', { p_account_id: user.id });
    if (permissionError) return respond({ error: 'Vérification des accès indisponible.' }, 503);
    if (isSuperAdmin !== true) return respond({ error: 'Réservé aux super administrateurs.' }, 403);
    if (body.action === 'list') {
      const { data: reviews, error: statusError } = await admin.from('identity_document_reviews').select('account_id,auto_match,auto_document_revision').eq('status','pending');
      if (statusError) return respond({ error: 'Liste indisponible.' }, 503);
      const ids = (reviews || []).map((row: {account_id: string}) => row.account_id);
      if (!ids.length) return respond({ requests: [] });
      const { data, error } = await admin.from('identity_review_documents').select('account_id,account_first_name,account_last_name,ocr_revision,ocr_first_name,ocr_last_name').in('account_id', ids);
      if (error) return respond({ error: 'Liste indisponible.' }, 500);
      const requests = (data || []).map((doc: {account_id:string;ocr_revision:string;ocr_first_name:string|null;ocr_last_name:string|null;account_first_name:string;account_last_name:string}) => {
        const review = (reviews || []).find((row: {account_id:string}) => row.account_id === doc.account_id);
        const current = review?.auto_document_revision === doc.ocr_revision;
        return {account_id:doc.account_id,account_first_name:doc.account_first_name,account_last_name:doc.account_last_name,auto_match:current ? review.auto_match : 'not_checked',ocr_first_name:current ? doc.ocr_first_name : null,ocr_last_name:current ? doc.ocr_last_name : null};
      });
      return respond({ requests });
    }
    if (!body.accountId || !/^[0-9a-f-]{36}$/i.test(body.accountId)) return respond({ error: 'Compte invalide.' }, 400);
    const { data: ready, error: readyError } = await admin.from('identity_document_reviews').select('account_id').eq('account_id', body.accountId).eq('status','pending').maybeSingle();
    if (readyError || !ready) return respond({ error: 'Cette demande n’est plus en cours.' }, 409);
    if (body.action === 'document') {
      const { data, error } = await admin.from('identity_review_documents').select('mime_type,document_bytes').eq('account_id', body.accountId).maybeSingle();
      if (error || !data) return respond({ error: 'Document indisponible.' }, 404);
      const hex = String(data.document_bytes).replace(/^\\x/, '');
      if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return respond({ error: 'Document illisible.' }, 500);
      const bytes = Uint8Array.from(hex.match(/../g) || [], (pair: string) => parseInt(pair, 16));
      return new Response(bytes, { headers: { ...cors, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment' } });
    }
    if (body.action === 'decide' && (body.decision === 'document_reviewed' || body.decision === 'refused')) {
      const { error } = await admin.rpc('rawdha_decide_identity_document', { p_account_id: body.accountId, p_admin_id: user.id, p_decision: body.decision });
      if (error) return respond({ error: error.message.includes('account_name_changed') ? 'Le nom du compte a changé. Refusez la demande et demandez un nouvel envoi.' : 'Décision impossible. Actualisez la liste.' }, 409);
      return respond({ status: body.decision });
    }
    return respond({ error: 'Action invalide.' }, 400);
  } catch { return respond({ error: 'Impossible de traiter la demande.' }, 500); }
});
