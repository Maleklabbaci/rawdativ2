// supabase/functions/create-account/index.ts
//
// ✅ FIX: l'ancienne version bloquait en CORS car elle ne répondait pas
// correctement à la requête "preflight" OPTIONS envoyée par le navigateur
// avant chaque appel POST. Cette version gère explicitement OPTIONS et
// renvoie les bons headers CORS sur TOUTES les réponses (succès ET erreurs).
//
// Déploiement : supabase functions deploy create-account
// (ou via Supabase Dashboard -> Edge Functions -> create-account -> coller ce code)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ En prod, remplace '*' par ton domaine exact pour plus de sécurité :
// 'https://rawdativ2.vercel.app'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // 1) Requête préliminaire du navigateur : il FAUT répondre 200 + headers CORS,
  //    sinon le navigateur bloque la vraie requête POST qui suit.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2) Vérifie que l'appelant est bien authentifié et qu'il a le droit
    //    de créer des comptes (rôle admin).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client "identité de l'appelant" -> sert uniquement à vérifier qui il est
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Session invalide.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Client "admin" -> service_role, seul capable de créer des utilisateurs Auth
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await adminClient
      .from('comptes')
      .select('data')
      .eq('id', caller.id)
      .maybeSingle();

    if ((callerProfile?.data as any)?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Accès refusé : réservé aux administrateurs.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Lit les données du nouveau compte envoyées par le formulaire
    const body = await req.json();
    const { email, motDePasse, nom, prenom, role, nomCreche, dateFinAbonnement, abonnementActif } = body;

    if (!email || !motDePasse) {
      return new Response(JSON.stringify({ error: 'Email et mot de passe requis.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Crée le vrai utilisateur Supabase Auth (email confirmé directement,
    //    pas besoin que le directeur clique un lien de confirmation)
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: motDePasse,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Erreur lors de la création du compte Auth.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5) Crée la ligne "profil" dans la table comptes, avec le MÊME id que l'utilisateur Auth
    const profileData = {
      nom,
      prenom,
      email: email.toLowerCase().trim(),
      role,
      approvalStatus: 'approved',
      nomCreche: nomCreche || null,
      dateFinAbonnement: dateFinAbonnement || null,
      abonnementActif: abonnementActif !== false,
    };

    const { error: insertError } = await adminClient
      .from('comptes')
      .upsert({ id: created.user.id, data: profileData }, { onConflict: 'id' });

    if (insertError) {
      // Si l'insertion du profil échoue, on annule la création Auth pour ne pas
      // laisser un compte Auth "fantôme" sans profil associé.
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: created.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur inconnue.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
