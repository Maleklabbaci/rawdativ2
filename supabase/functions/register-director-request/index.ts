import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function isValidAlgerianPhone(value: string): boolean {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('213')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 9 && /^[5-7]\d{8}$/.test(digits);
}

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

  let createdId: string | undefined;
  let adminClient: ReturnType<typeof createClient> | undefined;
  const cleanup = async () => {
    if (!adminClient || !createdId) return;
    const id = createdId;
    // The Auth hook may have inserted pending rows before the RPC ran.
    // Best effort only: Auth and Postgres do not share a transaction.
    let failed = false;
    const attempt = async (operation: () => PromiseLike<{error: unknown}>) => {
      try { if ((await operation()).error) failed = true; } catch { failed = true; }
    };
    const client = adminClient;
    await attempt(() => client.from('parametres').delete().eq('id', `creche_${id}`));
    await attempt(() => client.from('comptes').delete().eq('id', id));
    await attempt(() => client.auth.admin.deleteUser(id));
    if (failed) console.error('Signup cleanup incomplete');
  };
  try {
    if (Number(req.headers.get('content-length') || 0) > 16384) return jsonResponse({ error: 'Demande trop volumineuse.' }, 413);
    const reader = req.body?.getReader();
    if (!reader) return jsonResponse({ error: 'Demande invalide.' }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const {done,value}=await reader.read(); if (done) break;
      length += value.length;
      if (length > 16384) { await reader.cancel(); return jsonResponse({ error: 'Demande trop volumineuse.' }, 413); }
      chunks.push(value);
    }
    const buffer = new Uint8Array(length); let offset=0;
    for (const chunk of chunks) {buffer.set(chunk,offset);offset+=chunk.length;}
    let body;
    try { body = JSON.parse(new TextDecoder().decode(buffer)); } catch { return jsonResponse({ error: 'Demande invalide.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'Demande invalide.' }, 400);
    body = body as {
      nom?: string;
      prenom?: string;
      email?: string;
      password?: string;
      telephone?: string;
      nomCreche?: string;
      adresse?: string;
      siteWeb?: string;
      message?: string;
    };

    const nom = String(body.nom || '').trim();
    const prenom = String(body.prenom || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const telephone = String(body.telephone || '').trim();
    const nomCreche = String(body.nomCreche || '').trim();
    const adresse = String(body.adresse || '').trim();
    const siteWeb = String(body.siteWeb || '').trim();

    if (!nom || !prenom || !email || !password || !telephone || !nomCreche || !adresse) {
      return jsonResponse({ error: 'Tous les champs obligatoires doivent être remplis.' }, 400);
    }
    if (nom.length>120 || prenom.length>120 || email.length>254 || password.length>128 || telephone.length>40 || nomCreche.length>160 || adresse.length>500 || siteWeb.length>2048) return jsonResponse({ error: 'Un champ est trop long.' }, 400);
    if (password.length < 8) return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Adresse e-mail invalide.' }, 400);
    if (!isValidAlgerianPhone(telephone)) return jsonResponse({ error: 'Numéro de téléphone algérien invalide.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    adminClient = createClient(supabaseUrl, serviceRoleKey);
    const {data:slot, error:slotError} = await adminClient.rpc('rawdha_signup_take_slot');
    if (slotError) return jsonResponse({ error: 'Inscription temporairement indisponible.' }, 503);
    if (slot !== true) return jsonResponse({ error: 'Trop de demandes. Réessayez dans quelques instants.' }, 429);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      // Inscription ouverte : l’adresse n’a pas été vérifiée par son propriétaire.
      email_confirm: true,
      user_metadata: {
        full_name: `${prenom} ${nom}`,
        nom,
        prenom,
        nomCreche,
        role: 'directeur',
        pendingDirector: false,
      },
    });
    if (createError || !created.user) {
      return jsonResponse({ error: 'Impossible de créer le compte. Vérifiez les informations ou connectez-vous si le compte existe déjà.' }, 400);
    }

    createdId = created.user.id;
    const { error: initError } = await adminClient.rpc('rawdha_initialize_director_signup', {
      p_account_id: createdId, p_email: email, p_first: prenom, p_last: nom,
      p_phone: telephone, p_nursery: nomCreche, p_address: adresse, p_website: siteWeb,
    });
    if (initError) {
      await cleanup();
      return jsonResponse({ error: 'Impossible de finaliser le compte.' }, 500);
    }
    createdId = undefined;
    return jsonResponse({ authUserId: created.user.id, status: 'active' }, 201);
  } catch {
    await cleanup();
    return jsonResponse({ error: 'Impossible de finaliser le compte.' }, 500);
  }
});
