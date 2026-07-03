# RAWDATI v2 — Correction sécurité : mode d'emploi

⚠️ Fais ça d'abord sur une copie/staging de ton projet Supabase si possible.
Si tu n'en as pas et que tu dois le faire en direct sur la prod : préviens tes
clients qu'il peut y avoir 2-3 minutes d'interruption, et fais un backup avant
(Supabase Dashboard → Database → Backups, ou Table Editor → Export CSV table par table).

## Pourquoi cet ordre précis

Si tu inverses l'ordre, tout le monde (y compris toi) sera bloqué dehors, ou pire,
la base restera ouverte à tous plus longtemps que nécessaire. Suis les étapes
1 → 2 → 3 → 4 → 5 sans sauter.

---

## Étape 1 — Backup

Dashboard Supabase → Table Editor → table "comptes" → menu export → CSV.
Garde ce fichier en lieu sûr, hors GitHub.

## Étape 2 — Migrer les comptes vers Supabase Auth

Fichier : `migrate-accounts-to-auth.mjs`

```powershell
npm install @supabase/supabase-js
$env:SUPABASE_URL = "https://TON_PROJECT_ID.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "ta_service_role_key"   # Dashboard -> Settings -> API -> service_role
node migrate-accounts-to-auth.mjs
```

Ferme PowerShell après (pour ne pas laisser la clé secrète traîner dans l'historique de session).

Vérifie le résumé affiché : "Échecs : 0" avant de continuer.

## Étape 3 — Lancer les scripts SQL, DANS L'ORDRE

Dashboard Supabase → SQL Editor → colle et exécute :
1. `sql/01_add_columns_and_helpers.sql`
2. `sql/02_secure_rls_policies.sql`

## Étape 4 — Déployer l'Edge Function de création de compte

```powershell
npx supabase login
npx supabase link --project-ref TON_PROJECT_ID
npx supabase functions deploy create-account
```

## Étape 5 — Mettre à jour le code de l'app

Remplace ces fichiers dans ton projet par les versions corrigées fournies :
- `src/contexts/AuthContext.tsx`
- `src/contexts/DbContext.tsx`
- `src/components/SignIn.tsx`

Puis :
```powershell
git add -A
git commit -m "fix: vraie authentification Supabase Auth + RLS scopées par crèche"
git push
```

Vercel redéploie automatiquement.

## Étape 6 — Tester

- Connecte-toi avec un compte directeur existant (même mot de passe qu'avant, ça doit
  marcher directement puisque le mot de passe a été repris tel quel dans Supabase Auth)
- Vérifie qu'un directeur ne voit QUE ses propres enfants/classes (pas ceux des autres crèches)
- Crée un nouveau compte parent depuis l'interface, vérifie qu'il peut se connecter

## Ce qui reste à améliorer après ça (pas urgent, mais à prévoir)

- `DbContext.tsx` télécharge encore les données en entier au lieu de faire des requêtes
  filtrées côté serveur (`.eq('creche_id', ...)` avec pagination). Ça marchera très bien
  tant que le volume reste raisonnable, mais si tu montes à 50+ crèches actives, il faudra
  passer les fetchs `enfants`, `presences`, `paiements` etc. en filtrés + paginés plutôt
  que "tout télécharger puis filtrer côté navigateur".
- Une fois tout ça stable, LE test de charge (loader.io ou k6) redevient pertinent — 
  à ce moment il te donnera des résultats représentatifs de ta vraie capacité.
