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

    let authUserId = typeof request.authUserId === 'string' ? request.authUserId : '';
    if (!authUserId) {
      const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) return jsonResponse({ error: usersError.message }, 500);
      const existingUser = usersPage.users.find((item) => item.email?.toLowerCase() === String(request.email || '').toLowerCase());
      authUserId = existingUser?.id || '';
    }

    if (!authUserId) {
      return jsonResponse({
        error: 'Cette demande a été créée avec l’ancien formulaire. Le directeur doit refaire son inscription en choisissant un mot de passe.',
      }, 400);
    }

    const email = String(request.email || '').trim().toLowerCase();
    const { data: existingAccounts, error: existingAccountsError } = await adminClient
      .from('comptes')
      .select('id, data')
      .limit(5000);
    if (existingAccountsError) return jsonResponse({ error: existingAccountsError.message }, 500);
    const conflictingAccount = (existingAccounts || []).find((row) => {
      const account = (row.data || {}) as Record<string, unknown>;
      return row.id !== authUserId && String(account.email || '').trim().toLowerCase() === email;
    });
    if (conflictingAccount) {
      return jsonResponse({ error: 'Cette adresse e-mail appartient déjà à un autre compte Rawdha+.' }, 409);
    }
    const nom = String(request.nom || '').trim();
    const prenom = String(request.prenom || '').trim();
    const nomCreche = String(request.nomCreche || '').trim();

    const { data: authUpdate, error: authUpdateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      email: email || undefined,
      email_confirm: true,
      user_metadata: {
        nom,
        prenom,
        nomCreche,
        role: 'directeur',
        pendingDirector: false,
      },
    });
    if (authUpdateError || !authUpdate.user) {
      return jsonResponse({ error: authUpdateError?.message || 'Impossible d’activer le compte Auth.' }, 400);
    }

    const compteData = {
      nom,
      prenom,
      email,
      role: 'directeur',
      approvalStatus: 'approved',
      abonnementActif: true,
      nomCreche,
      dateFinAbonnement: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };
    const { error: profileError } = await adminClient
      .from('comptes')
      .upsert({ id: authUserId, data: compteData });
    if (profileError) return jsonResponse({ error: profileError.message }, 500);

    const { error: settingsError } = await adminClient
      .from('parametres')
      .upsert({
        id: `creche_${authUserId}`,
        data: {
          crecheName: nomCreche,
          principalEmail: email,
          phoneNumbers: String(request.telephone || ''),
          addressLine: String(request.adresse || ''),
          tuitionFeeRate: 4500,
          siteWeb: String(request.siteWeb || ''),
          logoUrl: '',
        },
      });
    if (settingsError) return jsonResponse({ error: settingsError.message }, 500);

    const updatedRequest = {
      ...request,
      statut: 'acceptee',
      traiteLe: new Date().toISOString(),
      traitePar: caller.id,
      compteId: authUserId,
    };
    const { error: requestUpdateError } = await adminClient
      .from('demandes_directeur')
      .update({ data: updatedRequest })
      .eq('id', requestRow.id);
    if (requestUpdateError) return jsonResponse({ error: requestUpdateError.message }, 500);

    return jsonResponse({ id: authUserId, status: 'accepted' });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erreur inconnue.' }, 500);
  }
});
