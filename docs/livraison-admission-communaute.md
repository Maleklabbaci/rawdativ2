# Livraison Rawdha+ — Admission QR et communauté professionnelle privée

## Version publiée

Le commit `82c3e34c13004c7660b8a4f4e2097b28c37513b7` a été poussé sur la branche `main` du dépôt `Maleklabbaci/rawdativ2`.

Le déploiement Vercel production est en état `READY` : [rawdhaplus-777c2fx9g-maleks-projects-e46e19b2.vercel.app](https://rawdhaplus-777c2fx9g-maleks-projects-e46e19b2.vercel.app).

## Admission par QR ou lien privé

Chaque directeur peut créer un lien propre à sa crèche depuis **Admissions par QR**. Le lien possède un jeton non devinable, peut être activé ou désactivé et peut être copié ou transformé en QR code localement.

Le parent ouvre uniquement le lien ou le QR fourni par la crèche, choisit sa langue français/arabe et remplit le dossier complet de l’enfant. La demande reste en attente jusqu’à la décision de la directrice ou du directeur. Une demande acceptée crée le dossier enfant dans la crèche concernée ; une demande refusée reste contrôlée par le statut et le motif.

Les données sont séparées par `crecheId`, les décisions importantes passent par une fonction serveur atomique et les politiques RLS empêchent l’accès aux demandes d’une autre crèche.

## Communauté professionnelle privée

La page **Réseau professionnel** est accessible uniquement aux rôles `directeur` et `admin`. Les parents et les autres rôles ne reçoivent pas l’accès à cette page.

Le MVP comprend un fil bilingue français/arabe avec les catégories **Activités & méthodes**, **Matériel**, **Vente & échange**, **Recrutement**, **Formations** et **Partenariats**. Une crèche peut publier un titre, un contenu, une ville, un prix indicatif et un contact professionnel. Les directeurs peuvent commenter et réagir ; l’administrateur peut masquer, réafficher ou supprimer définitivement les publications et supprimer les commentaires avec confirmation.

Les publications et commentaires ne permettent jamais de partager les données privées d’enfants ou de parents via le formulaire. Les publications masquées ne sont plus visibles aux directeurs, mais restent disponibles dans l’espace de modération admin.

## Sécurité Supabase

Les migrations suivantes ont été appliquées au projet `bbhocbfcjhccabqkngxt` :

- `supabase_admission_migration.sql` pour les liens et demandes d’admission ;
- `supabase_community_migration.sql` pour les publications et commentaires ;
- `supabase_community_reactions_migration.sql` pour les réactions uniques par utilisateur et publication.

Les tables suivent le modèle JSONB de Rawdha+. Les politiques RLS imposent le rôle directeur/admin, l’auteur réel côté session, le rattachement à la crèche et l’absence d’accès parent au réseau privé.

## Vérifications

- `tsc --noEmit` : réussi ;
- `vite build` : réussi ;
- `git diff --check` : réussi ;
- déploiement Vercel production : `READY` ;
- erreurs runtime Vercel sur les 30 dernières minutes : aucune détectée.

## Fichiers principaux

- `src/components/PublicAdmission.tsx` : formulaire parent public bilingue ;
- `src/components/Admissions.tsx` : génération et gestion des QR/liens par le directeur ;
- `src/components/Community.tsx` : fil privé, publication, commentaires, réactions et modération ;
- `src/contexts/DbContext.tsx` : chargement et CRUD optimistes ;
- `supabase_admission_migration.sql` ;
- `supabase_community_migration.sql` ;
- `supabase_community_reactions_migration.sql`.
