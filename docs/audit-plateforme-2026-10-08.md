# Audit plateforme Rawdha+ — 8 octobre 2026

Audit statique complet du dépôt `Maleklabbaci/rawdativ2` (commit `0b3334a`) : sécurité,
données, performance, build, Android/PWA, robustesse applicative.

**Méthode et limites :** tout a été vérifié par lecture du code, des migrations SQL et par
exécution locale de `tsc --noEmit`, `vite build` et du serveur de développement. Le bac à sable
n'a **aucun accès réseau vers `*.supabase.co`** : l'état réel de la base de production n'a donc
pas pu être interrogé. Les points marqués « à vérifier » ci-dessous dépendent de cet accès et
sont signalés comme tels, jamais comme des faits.

---

## 0. Résumé exécutif

| # | Constat | Gravité | Effort |
|---|---|---|---|
| 1 | L'état RLS de la production n'est **prouvé par aucun document** du dépôt, alors que toute la sécurité repose dessus (la clé `anon` est publique par conception) | 🔴 Critique | Faible (vérification, 15 min) |
| 2 | Une connexion directeur télécharge **toute la table `enfants`**, y compris les documents scannés en base64 (jusqu'à ~10 Mo par enfant) | 🔴 Critique | Élevé |
| 3 | La page publique télécharge **~5 Mo d'images** (logo de 4,09 Mo pour une icône de 20 px) ; ~9,3 Mo pour l'écran de connexion | 🔴 Critique | Faible |
| 4 | `register-director-request` est public, sans rate-limit ni captcha, et écrit avec la clé `service_role` | 🟠 Élevé | Moyen |
| 5 | L'admin télécharge **toutes** les lignes `parametres`, donc tous les logos base64 de toutes les crèches, à chaque connexion | 🟠 Élevé | Moyen |
| 6 | Les erreurs Supabase sont avalées en silence et renvoyées sous forme de tableau vide (`[]`) | 🟠 Élevé | Faible |
| 7 | `.env` est versionné dans Git malgré `.gitignore` | 🟡 Moyen | Faible |
| 8 | Aucune réinitialisation de mot de passe ; aucune CI ; aucun test ; `npm ci` est cassé | 🟡 Moyen | Moyen |
| 9 | `updateCollectionDocument` fait un *fetch-merge-write* non atomique → écrasement silencieux | 🟡 Moyen | Moyen |
| 10 | `public/favicon.svg` est un PNG de 1 Mo déguisé, jamais référencé, servi avec le mauvais type MIME | 🟢 Faible | Faible |

---

## 1. Sécurité — l'état RLS en production est le point aveugle n°1

### Le contexte

`src/supabase.ts` charge la clé `anon` depuis `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
C'est le modèle normal de Supabase : **la clé `anon` est publique par conception**. Décodée, celle
du projet (`ref: bbhocbfcjhccabqkngxt`) porte bien `"role": "anon"`. Sa présence dans le bundle
n'est donc pas une fuite.

Tout dépend donc du RLS : si les politiques sont permissives, la clé publique devient une clé
d'administration générale sur les données de toutes les crèches.

### Ce que le dépôt montre

`supabase_schema.sql` crée les 10 tables avec des politiques `allow all … using (true)` et
documente explicitement qu'il faut ensuite lancer `supabase_rls_migration.sql`, qui les remplace
par une isolation par `crecheId`.

Or :

- `docs/livraison-admission-communaute.md` liste les migrations appliquées au projet
  `bbhocbfcjhccabqkngxt` : `supabase_admission_migration.sql`,
  `supabase_community_migration.sql`, `supabase_community_reactions_migration.sql`.
  **`supabase_rls_migration.sql` n'y figure pas.**
- `RUNBOOK.md` le présente comme une opération manuelle dans le SQL Editor, avec une étape de
  migration des comptes vers Supabase Auth **avant**.
- `SUPABASE_AUTH_PROVIDER_FINDINGS.md` indique que le tableau de bord Supabase demandait une
  reconnexion et que « sans session active, il est impossible […] d'exécuter la migration SQL
  directement depuis le dashboard ».
- Les migrations présentes dans `supabase/migrations/` (donc appliquées par la CLI) datent du
  21–23 août et ne concernent que les achats, la communauté, le centre admin et les
  communications — **aucune ne touche les politiques des tables métier**.

Autrement dit : le durcissement principal est peut-être appliqué, mais rien dans le dépôt ne
l'atteste, et plusieurs indices suggèrent qu'il ne l'est pas.

### À vérifier (à exécuter, 15 minutes)

```sql
-- 1) Politiques réellement en place sur les tables métier
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('enfants','presences','paiements','comptes','parametres',
                    'classes','personnel','activites','repas','discussion_messages')
order by tablename, policyname;
```

Si une ligne contient `using (true)` dans `qual`, la table est ouverte.

```sql
-- 2) Privilèges résiduels du rôle anon
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name, privilege_type;
```

```bash
# 3) Test à froid depuis l'extérieur : doit renvoyer [] ou 401, jamais des données
curl -s "https://bbhocbfcjhccabqkngxt.supabase.co/rest/v1/enfants?select=id&limit=3" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>"
```

Le test n°3 est le plus parlant : s'il renvoie des identifiants d'enfants, la base est ouverte à
n'importe qui sur Internet.

> **Note :** les fichiers `supabase_security_hardening.sql`, `supabase_security_hardening_fix.sql`,
> `supabase_security_hardening_helpers.sql` et
> `supabase_pending_director_read_only_migration.sql` (35 politiques) sont eux aussi à appliquer
> manuellement et ne sont pas référencés dans les documents de livraison. Même incertitude.

### Ce qui est solide, en revanche

Le travail de sécurité lui-même est de bonne qualité :

- Les jetons de lien d'admission sont stockés **hachés en SHA-256** (`supabase_admission_migration.sql:125`),
  comparés côté serveur, avec contrôle d'activation et d'expiration.
- `rawdha_submit_admission` est `security definer`, valide chaque champ, tronque les longueurs,
  exige le consentement (`supabase_qr_security_migration.sql:191`), détecte les doublons
  (index unique partiel + contrôle applicatif) et applique un **rate-limit** via
  `rawdha_admission_rate_limit`.
- Les cinq Edge Functions sensibles (`create-account`, `approve-director-request`,
  `reject-director-request`, `send-push-notification`) vérifient toutes le rôle `admin` de
  l'appelant avant d'utiliser la clé `service_role`. Aucune n'est un relais ouvert.
- Les RPC de la communauté ont été explicitement révoquées pour `anon` et `public`
  (`supabase/migrations/20260823065000_community_rpc_anon_revoke.sql`).

---

## 2. Sécurité — points restants

### 2.1 `register-director-request` : endpoint public sans limite d'usage 🟠

`supabase/register-director-request/index.ts` est appelé par le formulaire public « Demander un
accès ». Il est volontairement non authentifié (c'est le principe), mais il crée un utilisateur
Supabase Auth **confirmé** avec la clé `service_role`, une ligne `comptes`, une ligne
`parametres` et une ligne `demandes_directeur`.

Il n'y a ni captcha, ni rate-limit, ni protection contre les doublons côté serveur. Un script peut
donc créer des milliers de comptes en attente, ce qui :

- consomme du quota d'utilisateurs Supabase Auth (limite du plan) ;
- gonfle `comptes` et `parametres` — tables entièrement téléchargées par l'admin ;
- pollue la file de validation de l'admin jusqu'à la rendre inutilisable.

Deux défauts annexes :

- La détection de doublon fait `.select('id, data').limit(500)` puis filtre en JavaScript
  (lignes 71–80). Au-delà de 500 demandes, **plus aucun doublon n'est détecté**.
- Si l'e-mail existe déjà, `createUser` renvoie le message Supabase tel quel
  (« A user with this email address has already been registered »), ce qui permet d'**énumérer
  les comptes** existants.

**Correctif suggéré :** compteur de demandes par IP/empreinte stocké dans une table dédiée (même
modèle que `admission_rate_limits`), plafond global de demandes en attente, filtre de doublon en
SQL, et messages d'erreur génériques.

### 2.2 `.env` versionné 🟡

`.env` est suivi par Git (`git ls-files` le confirme, `.gitignore` ne s'applique pas aux fichiers
déjà indexés). Il a été introduit par le commit initial `0b3334a`, seul commit du dépôt — donc
aucune écriture d'historique compliquée n'est nécessaire.

**Gravité réelle : faible en soi.** Le contenu est :

| Variable | Valeur | Sensibilité |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://bbhocbfcjhccabqkngxt.supabase.co` | Publique |
| `VITE_SUPABASE_ANON_KEY` | JWT `role: anon`, exp. 2036 | **Publique par conception** |
| `VITE_GEMINI_API_KEY` | `test` | Placeholder |
| `VITE_APP_URL` | URL de prod | Publique |

Aucun secret réel n'est exposé. Le risque est ailleurs : **si quelqu'un ajoute un jour une clé
`service_role` ou une vraie clé Gemini dans ce fichier, elle partira directement dans l'historique
public.** C'est la raison de le retirer maintenant, pas dans six mois.

⚠️ **Attention avant d'agir :** le build Vercel lit ce fichier. `src/supabase.ts:15` lève une
exception si la configuration manque en production. Il faut donc **d'abord** définir
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel → Settings → Environment Variables,
**vérifier qu'un déploiement passe**, puis seulement retirer le fichier du suivi :

```bash
git rm --cached .env
git commit -m "chore(security): untrack .env (secrets fournis par l'environnement)"
```

En complément, `android/app/google-services.json` (clé API Firebase) et
`firebase-applet-config.json` (même clé) sont versionnés. Les clés API Firebase Android sont
publiques par conception et protégées par les restrictions de package/empreinte dans Google Cloud
Console — **à condition que ces restrictions soient en place**. À vérifier dans la console.

### 2.3 Politiques de mot de passe hétérogènes 🟢

- `register-director-request` impose 8 caractères minimum.
- `create-account` (création par un admin) ne valide **aucune** longueur.

Alignez les deux, et fixez la longueur minimale dans Supabase → Authentication → Policies.

---

## 3. Poids des ressources — le problème le plus visible pour vos clients

### 3.1 Images non optimisées 🔴

| Fichier | Taille | Usage réel |
|---|---|---|
| `public/rawdah-logo.png` | **4 185 Ko** (1920 × 1920) | icône de 20 px (`App.tsx:606`), logo 40 px (`LandingPage.tsx:85`), favicon (`App.tsx:324`), avatar de chaque publication de la communauté |
| `public/login-nursery-hero-a.jpg` | **4 167 Ko** | fond d'écran de connexion (`SignIn.tsx:289`, `MobileWelcome.tsx:53`) |
| `public/favicon.svg` | **1 026 Ko** | **jamais référencé** — et ce n'est pas un SVG : le fichier commence par les octets magiques d'un PNG (`89 50 4E 47`) |

Ces formats sont déjà compressés : gzip ne les réduit quasiment pas (4 185 Ko → 3 864 Ko).

**Conséquence chiffrée pour un visiteur anonyme ouvrant `https://rawdativ2.vercel.app/` :**

| Ressource | Taille transférée |
|---|---|
| `index-*.js` | 263 Ko (gzip) |
| `index-*.css` | ~20 Ko (gzip) |
| `rawdah-logo.png` | **4 185 Ko** |
| `favicon.png` | 32 Ko |
| **Total** | **≈ 4,5 Mo** |

Sur l'écran de connexion, la bannière ajoute 4 167 Ko : **≈ 8,7 Mo** avant même de saisir un
identifiant. Sur une connexion mobile algérienne à 1 Mb/s, c'est plus d'une minute d'attente pour
afficher un formulaire avec un logo de 20 pixels — alors que le bundle JavaScript complet ne pèse
que 263 Ko. **Les images représentent 97 % du poids.**

**Correctif :**

```bash
# Outils : cwebp/ImageMagick, ou un script Node avec sharp
# Cible : logo 512×512 (~30 Ko), hero 1600 px de large en WebP qualité 80 (~150 Ko)
```

Découpez en plusieurs variantes (`logo-64.png`, `logo-512.png`) et servez la bonne selon le
contexte ; gardez une seule version lourde pour les factures PDF si nécessaire.

### 3.2 Le cache HTTP ne couvre pas ces images 🟠

`vercel.json` définit `Cache-Control: public, max-age=31536000, immutable` uniquement pour
`/assets/(.*)` — c'est-à-dire les fichiers produits par Vite avec empreinte dans le nom.
Les fichiers de `public/` (`/rawdah-logo.png`, `/login-nursery-hero-a.jpg`) n'ont **aucun en-tête
de cache**. Ils sont donc revalidés à chaque visite : le visiteur retélécharge 4 Mo à chaque
ouverture du site.

Le service worker ne les met pas en cache non plus : `public/sw.js` ne traite que `/assets/`.

**Correctif :** ajouter une règle d'en-têtes pour les images statiques (après les avoir allégées,
sinon vous figez 4 Mo en cache client).

### 3.3 Manifeste PWA non conforme 🟡

`public/manifest.webmanifest` déclare une seule icône : `favicon.png`, 219 × 256, avec
`sizes: "any"` et `purpose: "any maskable"`.

- L'image n'est pas carrée, donc le rendu « maskable » sera rogné de travers.
- Chrome demande au minimum des icônes 192 × 192 et 512 × 512 pour proposer l'installation.
- `start_url: "/"` et `scope: "/"` sont corrects.

**Correctif :** produire `icon-192.png`, `icon-512.png` (carrés) et une variante
`icon-maskable-512.png` avec 10 % de marge de sécurité.

### 3.4 Bundle principal 🟡

`index-azFfmJSP.js` pèse 917 Ko (263 Ko gzip). Les écrans métier sont correctement découpés en
*chunks* paresseux depuis le correctif `lazyWithRecovery`, mais `LandingPage`, `SignIn`,
`Dashboard` et la coquille applicative restent dans le bundle initial. C'est acceptable pour
l'instant ; le poste le plus rentable reste les images.

### 3.5 Dépôt et historique Git 🟢

37 Mo de `.git` et 20 Mo d'images dans `android/app/src/main/res` (16 variantes de splash,
jusqu'à 4,3 Mo chacune). Les splashs Android sont générés depuis `resources/` ; envisagez de ne
versionner que les sources et de générer les variantes au build (`@capacitor/assets`).

---

## 4. Architecture des données

### 4.1 Tout est téléchargé à la connexion 🔴

`src/contexts/DbContext.tsx` charge les tables entières en deux vagues (lignes 409–462). En
s'appuyant sur le RLS, un directeur ne récupère que sa crèche — mais **il la récupère
intégralement**, sans pagination ni projection de colonnes :

```
comptes, enfants, presences, presence_journees, paiements, personnel   (vague 1, bloquante)
classes, activites, repas, achats, discussion_messages, avis, signalements,
community_posts, community_comments, community_reactions,
community_features, inscription_liens, demandes_admission, notifications (vague 2, silencieuse)
```

Le point le plus lourd : `select('id, data')` ramène **tout le JSONB**, sans possibilité
d'exclure les champs volumineux.

### 4.2 Les fichiers binaires sont stockés en base64 dans le JSONB 🔴

| Contenu | Où | Redimensionné ? | Limite |
|---|---|---|---|
| Logo de la crèche | `parametres.logoUrl` (`Parametres.tsx:97-112`) | ❌ Non | 2 Mo → ~2,7 Mo en base64 |
| Pièces justificatives enfant | `enfants.documentsFichiers` (`Enfants.tsx:345-360`) | ❌ Non | 2 Mo × 4 types ≈ **10,7 Mo par enfant** |
| Pièces d'admission | `demandes_admission.documentsFichiers` (`PublicAdmission.tsx:95-113`) | ❌ Non | 2 Mo × 4 |
| Images de publication | `community_posts` (`Community.tsx:290-318`) | ✅ Oui, canvas + JPEG 0.84 | 8 Mo en entrée |

**L'effet combiné est le vrai problème :** la table `enfants` est téléchargée en entier à chaque
connexion, et le RLS ne filtre pas les colonnes. Une crèche de 100 enfants dont chaque dossier
contient un justificatif scanné de 1 Mo télécharge donc **~133 Mo à chaque ouverture de session**.
Au-delà, Supabase limite la réponse HTTP (et l'utilisateur n'aura qu'un écran vide, puisque les
erreurs sont avalées — voir §5.1).

L'admin, lui, appelle `getCollectionData('parametres')` (`DbContext.tsx:419`) : la politique
`parametres_select` l'autorise à lire **toutes** les lignes. Il télécharge donc le logo base64 de
**chaque** crèche, à chaque connexion. Cinquante crèches à 1 Mo de logo = 50 Mo.

**Correctif recommandé (par ordre d'impact) :**

1. **Sortir les binaires du JSONB.** Utiliser Supabase Storage, et ne garder en base qu'un chemin
   d'objet + un `select` qui l'exclut du chargement de liste. C'est la correction structurelle.
2. **Redimensionner côté client avant l'encodage**, comme le fait déjà bien `Community.tsx` :
   les justificatifs se lisent à l'écran, ils n'ont pas besoin de 2 Mo. 1600 px / JPEG 0.8 suffit.
3. **Filtrer côté serveur** : `.select('id, data')` → colonnes ciblées, ou RPC paginée.
   `RUNBOOK.md` identifie déjà ce chantier ; cet audit en confirme l'urgence.
4. Pour l'admin, remplacer `getCollectionData('parametres')` par une RPC qui ne renvoie que les
   champs nécessaires (nom, téléphone) sans les logos.

### 4.3 Écriture non atomique 🟡

`updateCollectionDocument` (`src/supabase.ts`) procède en deux temps : `select` de la ligne, fusion
en mémoire, puis `update` avec le JSONB complet. Deux écritures concurrentes sur la même ligne
(par exemple le directeur qui modifie une fiche enfant pendant que l'admin agit, ou deux onglets
ouverts) ⇒ **la seconde écrase la première sans avertissement**.

C'est le point le plus fragile du modèle « une colonne JSONB par entité » : Postgres ne sait pas
fusionner partiellement un JSONB dans cette configuration. Pistes :

- une fonction SQL `security definer` qui fait l'update en une seule instruction
  (`data = data || p_patch::jsonb`), ce qui rend la fusion atomique ;
- ou un champ `updatedAt` + contrôle de version optimiste, avec message d'erreur explicite.

---

## 5. Robustesse applicative

### 5.1 Les erreurs deviennent des listes vides 🟠

`getCollectionData` (`src/supabase.ts`) attrape **toutes** les erreurs — panne réseau, expiration
de jeton, refus RLS, dépassement des 7 s — journalise dans la console et **retourne `[]`**.

Conséquence : un directeur dont la session vient d'expirer ou dont la politique RLS bloque la
lecture voit un tableau de bord **vide**, sans aucun message. Il peut en conclure que ses données
ont été supprimées. Aucun écran ne distingue « la crèche n'a pas encore d'enfants » de « la
requête a échoué ».

**Correctif :** remonter un état d'erreur au lieu d'un tableau vide, et afficher un bandeau du type
« Impossible de charger les données — vérifiez votre connexion » avec un bouton Réessayer. Le
garde-fou de timeout de 7 s est une bonne idée, mais il doit être **visible** par l'utilisateur.

### 5.2 Aucun ErrorBoundary 🟠

Aucun composant du projet n'implémente `componentDidCatch` ni d'`ErrorBoundary`. Une exception
pendant le rendu (donnée inattendue venue de la base, par exemple) démonte tout l'arbre React et
laisse une **page blanche**, sans message ni bouton. Le mécanisme `lazyWithRecovery` d'`App.tsx`
ne couvre que l'échec de chargement d'un *chunk*, pas les erreurs de rendu.

**Correctif :** un `ErrorBoundary` racine avec un écran de reprise (« Recharger l'application ») et
un journal d'erreur. C'est une vingtaine de lignes et cela transforme un incident bloquant en
incident gérable.

### 5.3 Aucune réinitialisation de mot de passe 🟠

Aucun appel à `resetPasswordForEmail` dans le projet, et `shouldCreateUser: false` est utilisé
partout ailleurs. Un directeur qui oublie son mot de passe **ne peut pas se dépanner seul** : il
faut qu'un administrateur lui en crée un nouveau via `create-account`.

Pour une plateforme payante destinée à des clients non techniques, c'est un point de friction
commercial, pas seulement technique. À noter : `SUPABASE_AUTH_PROVIDER_FINDINGS.md` indique que
le fournisseur e-mail est disponible par défaut dans Supabase — la brique existe donc déjà côté
service, il ne manque que le parcours dans l'interface.

### 5.4 Mise à jour de l'approbation : interrogations répétées 🟢

`AuthContext.tsx` surveille l'approbation d'un directeur en attente par **abonnement Realtime
*et* sondage toutes les 10 s**. C'est robuste, mais le sondage maintient une charge inutile
pendant toute la durée d'attente (qui peut se compter en heures). Le Realtime suffit sur un réseau
stable ; un sondage de 60 s en secours suffirait.

---

## 6. Build, dépendances et déploiement

### 6.1 `npm ci` est cassé 🟡

```
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: @capacitor/local-notifications@8.3.1 from lock file
npm error Missing: @capacitor/push-notifications@8.1.3 from lock file
```

Deux fichiers de verrouillage coexistent : `package-lock.json` (désynchronisé) et
`pnpm-lock.yaml` (correct, `pnpm install --frozen-lockfile` passe). `README.md` recommande pnpm,
donc le chemin documenté fonctionne — mais tout build automatisé qui détecte `package-lock.json`
et lance `npm ci` échouera.

**Correctif :** supprimer `package-lock.json` et déclarer le gestionnaire de paquets :

```json
"packageManager": "pnpm@10.34.6"
```

dans `package.json`.

### 6.2 Aucune intégration continue 🟡

Pas de dossier `.github/` : aucun workflow. Rien n'empêche aujourd'hui de pousser du code qui ne
compile pas. Les vérifications `tsc --noEmit`, `vite build` et `git diff --check` sont mentionnées
dans les documents de livraison, mais **exécutées à la main**.

**Correctif :** un workflow minimal (lint + build) sur chaque `push` et chaque pull request. En
pratique c'est dix minutes de mise en place et cela sécurise toutes les livraisons suivantes.

### 6.3 Aucun test

Aucun fichier `*.test.*` ni `*.spec.*`, aucune dépendance de test. Les documents de livraison
s'appuient sur des vérifications manuelles (« erreurs runtime Vercel sur les 30 dernières minutes :
aucune détectée »). C'est légitime à ce stade, mais les fonctions les plus risquées mériteraient
des tests avant d'être retouchées : `normalizeEnfantData`, `normalizeCommunityPost`,
`hydrateAccountsWithCrechePhone`, `commandCenterRules`, et le formatage des montants dans
`utils/format.ts`.

### 6.4 Points mineurs

- `index.html` déclare `<html lang="en">` alors que l'application est francophone/arabophone.
  `LanguageContext.tsx:12-13` corrige `lang` et `dir` au démarrage côté client, mais le HTML
  initial et les robots d'indexation voient « en ».
- Pas de balise `description` dans `index.html` : les partages de lien (WhatsApp, Facebook) ne
  produiront pas d'aperçu riche. Vu que les admissions circulent par lien, une paire
  `og:title` / `og:description` aurait un vrai intérêt commercial.
- `vercel.json` contient trois règles de réécriture dont les deux premières (`/admission`,
  `/admission/:path*`) sont **désormais redondantes** avec la règle générale `/(.*)`. Le bug de
  page 404 documenté dans `console_audit_2026-08-16.md` est bien corrigé.

### 6.5 Santé du code

- `pnpm exec tsc --noEmit` : **0 erreur**, aucun `TODO`/`FIXME` dans `src/`.
- `vite build` : **réussi** en ~5 s, 20 *chunks*, découpage paresseux effectif.
- Toutes les vues sont protégées par un contrôle de rôle dans `App.tsx` (`comptes` et `admin`
  redirigés vers `dashboard` pour un directeur) : la navigation est cohérente avec le RLS.
- Le support RTL est traité sérieusement (attribut `dir`, classes `rtl:` Tailwind, `Facture.tsx`
  génère son HTML avec `dir` et `lang` corrects).
- Les traductions FR/AR couvrent tous les écrans métier sauf quelques composants utilitaires
  (`ToastContainer`, `SkeletonLoader`), ce qui est normal.

---

## 7. Android et Capacitor

| Point | État |
|---|---|
| `minSdkVersion` 24 / `targetSdkVersion` 36 | ✅ À jour (exigence Play : API 35+) |
| `allowMixedContent: false` | ✅ Correct |
| `allowBackup="true"` | ⚠️ Sur Android, cela autorise la sauvegarde automatique du stockage applicatif. Comme la session Supabase est persistée dans le stockage local du WebView, le jeton de session peut partir dans une sauvegarde cloud. À restreindre via `dataExtractionRules` / `fullBackupContent`. |
| Permissions | ✅ Minimales : `INTERNET`, `POST_NOTIFICATIONS`, `WAKE_LOCK`. Rien de superflu. |
| `FileProvider` avec `exported="false"` | ✅ Correct |
| `minifyEnabled false` en release | 🟢 Non bloquant : l'APK n'est pas minifié (taille et lisibilité du code). À activer une fois l'application stable. |
| Signature release | ⚠️ `android/app/build.gradle` lit `keystore.properties` s'il existe, mais **aucun keystore n'est versionné** — c'est le bon choix. Le fichier `RAWDHA_ANDROID_UPLOAD_KEY.txt` est déjà exclu par `.gitignore`. Vérifiez que la sauvegarde hors dépôt existe bien : **perdre cette clé rend impossible toute mise à jour de l'application sur le Play Store**. |
| Push FCM | `android/app/google-services.json` est présent. `docs/firebase-setup-status.md` évoque une clé de compte de service pour l'envoi côté serveur — cette clé ne doit **jamais** être versionnée (mention explicite dans le document, à respecter). |

---

## 8. Ce qui est solide et à ne pas casser

Il serait injuste de ne lister que des problèmes. Plusieurs choix de ce projet sont au-dessus de la
moyenne pour une application de cette taille :

1. **Le parcours d'admission publique est bien pensé.** Jeton haché SHA-256, jamais stocké en
   clair, comparaison serveur, expiration, désactivation, consentement tracé avec version de
   politique, anti-doublon, rate-limit, et une fonction `security definer` unique qui valide tout.
   C'est le module le plus mature du dépôt.
2. **Les Edge Functions privilégiées vérifient systématiquement le rôle** avant d'utiliser la clé
   `service_role`. Le piège classique de l'élévation de privilèges est évité.
3. **La gestion des jetons expirés** (`withAuthRetry` dans `supabase.ts`) rafraîchit la session
   une fois puis rejoue la requête : un détail qu'on oublie souvent.
4. **La normalisation défensive des données** (`normalizeEnfantData` et consorts) reconstruit les
   objets champ par champ plutôt que de faire du *spread* : les enregistrements anciens ou
   incomplets ne provoquent pas d'erreur `undefined` à l'affichage.
5. **Le découpage paresseux avec récupération des *chunks* périmés** (`lazyWithRecovery`) règle un
   vrai problème de déploiement, que peu d'équipes anticipent : un onglet ouvert avant un
   déploiement demande un fichier qui n'existe plus.
6. **La documentation opérationnelle existe** : `RUNBOOK.md` décrit l'ordre exact des opérations de
   migration, avec un avertissement explicite sur les conséquences d'une inversion d'ordre.
7. **Le redimensionnement des images de la communauté** via canvas est correctement implémenté —
   il ne reste qu'à appliquer la même approche aux logos et aux pièces justificatives.

---

## 9. Plan d'action priorisé

### Cette semaine — faible effort, fort impact

1. **Vérifier l'état réel du RLS** (§1) et appliquer ce qui manque, dans l'ordre du `RUNBOOK.md`.
   C'est la seule action à faire avant toutes les autres.
2. **Alléger les images** (§3.1) : objectif < 200 Ko au total pour le logo et la bannière, contre
   8,4 Mo aujourd'hui. Supprimer `public/favicon.svg` (1 Mo, PNG déguisé, jamais utilisé).
3. **Ajouter une règle de cache** dans `vercel.json` pour les images de `public/` (§3.2).
4. **Rendre les erreurs visibles** (§5.1) : ne plus renvoyer `[]` silencieusement, afficher un
   état d'erreur avec un bouton Réessayer.
5. **Ajouter un `ErrorBoundary` racine** (§5.2).

### Ce mois-ci — corrections structurelles

6. **Sortir les binaires du JSONB vers Supabase Storage** (§4.2) et redimensionner les pièces
   justificatives côté client. C'est le chantier qui décide de la capacité à monter en charge.
7. **Rendre l'écriture atomique** (§4.3) : patch JSONB fusionné en SQL.
8. **Protéger `register-director-request`** : rate-limit, plafond global, doublons en SQL,
   messages d'erreur génériques (§2.1).
9. **Mettre en place la réinitialisation de mot de passe** (§5.3).
10. **Définir les variables d'environnement dans Vercel, puis retirer `.env` du suivi Git** (§2.2).
11. **Nettoyer les verrous de paquets et ajouter la CI** (§6.1, §6.2).

### Trimestre — fond

12. **Requêtes filtrées et paginées** côté serveur (RPC + pagination) plutôt que le téléchargement
    complet des tables (§4.1).
13. **Restreindre `allowBackup`** sur Android (§7).
14. **Premiers tests automatisés** sur les fonctions de normalisation et de calcul (§6.3).
15. **Icônes PWA conformes** et métadonnées de partage (§3.3, §6.4).

---

## Annexe — vérifications exécutées

| Vérification | Résultat |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ Réussi |
| `pnpm exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm build` | ✅ Réussi, 20 *chunks*, 4,79 s |
| `npm ci` | ❌ Échec — `package-lock.json` désynchronisé |
| Routes SPA (`/dashboard`, `/admission`) | ✅ Répondent 200 via la réécriture Vercel |
| Démarrage du serveur de développement | ✅ Port 3000, réponse 200 |
| Accès réseau vers `*.supabase.co` depuis le bac à sable | ⛔ Bloqué — état de la base non vérifiable |
