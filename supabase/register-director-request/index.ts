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
    const body = await req.json() as {
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

    if (!nom || !prenom || !email || !password || !telephone || !nomCreche || !adresse) {
      return jsonResponse({ error: 'Tous les champs obligatoires doivent être remplis.' }, 400);
    }
    if (password.length < 8) return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Adresse e-mail invalide.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Évite les doubles demandes en attente pour la même adresse.
    const { data: existingRequests, error: existingRequestError } = await adminClient
      .from('demandes_directeur')
      .select('id, data')
      .limit(500);
    if (existingRequestError) return jsonResponse({ error: existingRequestError.message }, 500);
    const duplicate = (existingRequests || []).find((row) => {
      const rowData = (row.data || {}) as Record<string, unknown>;
      return String(rowData.email || '').trim().toLowerCase() === email && rowData.statut === 'en_attente';
    });
    if (duplicate) return jsonResponse({ error: 'Une demande est déjà en attente pour cette adresse e-mail.' }, 409);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      // La connexion doit être possible en mode lecture seule ; l’accès métier reste
      // verrouillé par pendingDirector jusqu’à l’approbation admin.
      email_confirm: true,
      user_metadata: {
        full_name: `${prenom} ${nom}`,
        nom,
        prenom,
        nomCreche,
        role: 'directeur',
        pendingDirector: true,
      },
    });
    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message || 'Impossible de créer le compte Auth.' }, 400);
    }

    const { error: profileError } = await adminClient
      .from('comptes')
      .insert({
        id: created.user.id,
        data: {
          nom,
          prenom,
          email,
          role: 'directeur',
          approvalStatus: 'pending',
          abonnementActif: false,
          nomCreche,
          dateFinAbonnement: null,
        },
      });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return jsonResponse({ error: profileError.message }, 500);
    }

    const requestId = crypto.randomUUID();
    const requestData = {
      nom,
      prenom,
      email,
      authUserId: created.user.id,
      telephone,
      nomCreche,
      adresse,
      siteWeb: String(body.siteWeb || '').trim(),
      message: String(body.message || '').trim(),
      dateDemande: new Date().toISOString(),
      statut: 'en_attente',
    };
    const { error: insertError } = await adminClient
      .from('demandes_directeur')
      .insert({ id: requestId, data: requestData });
    if (insertError) {
      await adminClient.from('comptes').delete().eq('id', created.user.id);
      await adminClient.auth.admin.deleteUser(created.user.id);
      return jsonResponse({ error: insertError.message }, 500);
    }

    return jsonResponse({ id: requestId, authUserId: created.user.id, status: 'pending' }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erreur inconnue.' }, 500);
  }
});
