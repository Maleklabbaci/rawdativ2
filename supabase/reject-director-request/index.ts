import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Non authentifié.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return jsonResponse({ error: 'Session invalide.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('comptes')
      .select('data')
      .eq('id', caller.id)
      .maybeSingle();
    if (callerProfileError) return jsonResponse({ error: callerProfileError.message }, 500);
    if ((callerProfile?.data as Record<string, unknown> | null)?.role !== 'admin') {
      return jsonResponse({ error: 'Accès refusé : réservé aux administrateurs.' }, 403);
    }

    const body = await req.json() as { demandeId?: string };
    if (!body.demandeId) return jsonResponse({ error: 'Identifiant de demande manquant.' }, 400);

    const { data: requestRow, error: requestError } = await adminClient
      .from('demandes_directeur')
      .select('id, data')
      .eq('id', body.demandeId)
      .maybeSingle();
    if (requestError) return jsonResponse({ error: requestError.message }, 500);
    if (!requestRow) return jsonResponse({ error: 'Demande introuvable.' }, 404);

    const request = (requestRow.data || {}) as Record<string, unknown>;
    if (request.statut !== 'en_attente') {
      return jsonResponse({ error: 'Cette demande a déjà été traitée.' }, 409);
    }

    const authUserId = typeof request.authUserId === 'string' ? request.authUserId : '';
    if (authUserId) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(authUserId);
      const deleteMessage = deleteAuthError?.message || '';
      if (deleteAuthError && !/not found|does not exist|invalid.*user/i.test(deleteMessage)) {
        return jsonResponse({ error: `Impossible de supprimer le compte Auth en attente : ${deleteMessage}` }, 500);
      }

      const { error: accountDeleteError } = await adminClient
        .from('comptes')
        .delete()
        .eq('id', authUserId);
      if (accountDeleteError) return jsonResponse({ error: accountDeleteError.message }, 500);

      const { error: settingsDeleteError } = await adminClient
        .from('parametres')
        .delete()
        .eq('id', `creche_${authUserId}`);
      if (settingsDeleteError) return jsonResponse({ error: settingsDeleteError.message }, 500);
    }

    const { error: requestDeleteError } = await adminClient
      .from('demandes_directeur')
      .delete()
      .eq('id', requestRow.id);
    if (requestDeleteError) return jsonResponse({ error: requestDeleteError.message }, 500);

    return jsonResponse({ id: requestRow.id, status: 'rejected' });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erreur inconnue.' }, 500);
  }
});

