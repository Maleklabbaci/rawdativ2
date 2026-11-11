# Validation de la finance sur staging — plan à exécuter, non exécuté

Ce document est une liste de vérifications, pas une preuve de conformité. Aucune migration n'a été appliquée à distance dans cette session. Ne jamais utiliser la production, les données d'enfants réels ou des secrets dans les tests ou dans le dépôt. Le comptable doit valider la procédure des doublons ; ce plan ne décide ni d'une annulation ni d'un remboursement.

## Préparer

1. Créer un projet Supabase **isolé de la production**, identifier explicitement son URL et son environnement dans l'outil de déploiement, et limiter les accès. Ne pas copier de clés dans le dépôt ou dans des captures. Utiliser des enfants, comptes, parents et factures fictifs ; aucune communication réelle vers une famille.
2. Vérifier le schéma effectivement déployé, les dépendances, les triggers et les migrations déjà inscrites. Préparer une sauvegarde et tester sa restauration sur une autre copie. Identifier qui autorise et exécute le déploiement et le retour arrière ; conserver les journaux sans données personnelles inutiles.
3. Vérifier les prérequis des migrations comptes/directeurs et leur impact sur les anciens clients et politiques RLS. Appliquer uniquement sur staging les migrations manquantes dans leur ordre enregistré, dont finance `170000`, revue `180000`, suspicion/correction `190000`, puis précontrôle `200000`, avec le client correspondant. Ne pas modifier les anciennes données pour forcer un préflight. Les migrations prennent des verrous : prévoir une fenêtre et mesurer leur impact.
4. Ne pas rejouer aveuglément `170000` sur des données déjà révisées : la revue conserve l'ancien libellé et peut rendre son préflight incompatible. Tester le mécanisme de restauration *avec son historique de migrations*. Les tables de journal ne doivent pas être effacées pour débloquer l'installation.

## Comptes, autorisations et lectures

- Avec des sessions distinctes, tester directeur propriétaire approuvé, directeur d'une autre crèche, directeur en attente, admin autorisé et anon. Contrôler non seulement les rôles usuels mais aussi les grants hérités, fonctions `SECURITY DEFINER`, triggers et rôles privilégiés.
- Vérifier que les RPC refusent l'autre crèche et les comptes non approuvés, que les rôles applicatifs ne peuvent pas écrire directement dans `paiements` ni appeler les implémentations internes, et que les journaux ne sont pas directement modifiables. Tester également les politiques de **lecture** et les effets d'un transfert d'enfant. Un résultat vide ne prouve pas que les RLS sont correctes.
- Charger plus d'une page de factures fictives, simuler échecs et interruptions de lecture, et vérifier qu'aucun total ni rappel n'est présenté comme confirmé lorsque la lecture échoue. La pagination n'est pas un instantané transactionnel ; les changements simultanés et lignes masquées par RLS restent à étudier.

## Scénarios fonctionnels

- Sur un enfant fictif, tester création, répétition d'une requête identique, conflit de période mensuelle/annuelle, instantané périmé et refus d'une création si une ancienne période manque. Comparer montants, statuts et libellés avant/après.
- Rapprocher une ancienne facture sans deviner sa période ; vérifier source, auteur/horodatage serveur, snapshot et conservation des données. Corriger ensuite la période, tester conflit et historique ; vérifier le comportement pour une facture créée directement.
- Signaler une paire et vérifier les deux références, la suspension des modifications/classifications concernées, des créations pour l'enfant et des rappels sur les deux côtés. Les deux montants restent présents. Écarter uniquement une fausse suspicion justifiée et vérifier la trace. Tester une cible d'une autre crèche et les snapshots périmés.
- Tester le précontrôle `rawdha_check_invoice_reminder` : période historique non classée, paire suspecte, changement de statut/montant/période, nom ou téléphone parent modifié, mauvaise crèche et RPC indisponible. La copie et l'ouverture de l'aperçu doivent échouer sans confirmation serveur. Contrôler qu'il ne renvoie pas les détails d'autres factures et qu'aucun vrai message n'est envoyé.
- Tester un paiement effectivement reçu **hors de l'application** : le statut historique « Payé » seul n'en est pas une preuve. Conserver la paire en attente si le doublon est confirmé ou indéterminé. Il n'existe pas encore de traitement comptable de l'annulation, de reçu ou de remboursement dans ce parcours.

## Concurrence réelle et pannes

Utiliser au moins deux sessions authentifiées distinctes, des transactions contrôlées et des données fictives. Vérifier les résultats réels et les journaux ; les tests PGlite mono-session ne couvrent pas ces cas.

- Faire partir simultanément deux créations pour la même période, puis une annuelle et une mensuelle couvrant le même mois : une seule doit réussir selon les règles applicables, sans perte ou écrasement.
- Entre le chargement et l'écriture, modifier la facture depuis l'autre session : la modification ou revue basée sur l'ancien snapshot doit être refusée. Faire de même pour la facture cible d'un signalement.
- Faire se chevaucher un signalement et une création, une modification ou une classification pour le même enfant, dans les deux ordres. Vérifier qu'une transaction attend les verrous et que le résultat final respecte les contrôles, sans interblocage permanent.
- Faire se chevaucher le précontrôle du rappel avec un signalement, un changement de facture ou de parent dans les deux ordres. Vérifier le résultat à l'instant du contrôle. **Un changement après la réponse reste possible**, notamment avant l'ouverture de WhatsApp ou après copie ; le contrôle ne réserve rien et ne retire aucun message déjà sorti de l'application.
- Couper la connexion avant réponse d'une écriture, puis recharger et consulter les journaux avant toute nouvelle tentative ; vérifier qu'une réponse perdue ne conduit pas à une confirmation fictive ou à une répétition non contrôlée. Pour le précontrôle en lecture, vérifier l'échec fermé et la reprise après rechargement.

## Décision avant production

Consigner les résultats, les versions exactes, les écarts et leur responsable. Les écarts de sécurité, de données ou de concurrence bloquent la mise en production. Définir le plan de déploiement coordonné client/migrations, l'arrêt des anciens clients, les droits, la surveillance, le plan de restauration testé et la procédure comptable validée. Un retour arrière ne doit pas supprimer les journaux ou réécrire les périodes simplement pour faire fonctionner un ancien client. Faire valider explicitement la décision par les responsables compétents.

## Test automatisé local PostgreSQL multi-session

Un complément local reproductible est disponible : `pnpm test:finance-concurrency`. Il exige Node, les dépendances du dépôt et des binaires PostgreSQL (`initdb`, `pg_ctl`, `postgres`, testés ici avec PostgreSQL 15.19) dans le `PATH`, ou dans `TEST_POSTGRES_BIN_DIR` :

```sh
TEST_POSTGRES_BIN_DIR="$(pg_config --bindir)" pnpm test:finance-concurrency
```

Exécuter sous un utilisateur non root sur Linux/macOS. Le script initialise son **propre cluster temporaire**, avec données fictives, socket Unix dans un répertoire privé, sans écoute TCP, sans URL ni connexion à une base existante. Il installe les seules migrations financières dans ce cluster et observe effectivement les verrous entre plusieurs connexions. Le cluster est arrêté et son répertoire supprimé en cas de succès ; en cas d'erreur ou d'arrêt incertain, le chemin est affiché pour inspection et nettoyage manuel après arrêt du serveur. Ne pas pointer les binaires ou le répertoire temporaire vers des sources non fiables.

Les cas testés couvrent notamment créations simultanées sur la même période ou sur mois/année, version périmée, signalement contre création et modification dans les deux ordres, revue historique contre création, vérification du téléphone et précontrôle contre signalement. Le test montre aussi qu'un précontrôle réussi ne réserve pas la facture après la transaction. Il vérifie quelques grants sur des rôles **simulés**, pas les politiques Supabase ni leurs privilèges hérités. Un succès local ne remplace pas les tests de staging ci-dessus, la validation comptable ou le plan de déploiement.

## Isolation enfants et factures : constat et garde proposée, non déployée

Le schéma historique `supabase_schema.sql` contient des politiques permissives « allow all » sur `enfants` et `paiements`. La migration historique `supabase_rls_migration.sql` les remplace si elle a effectivement été exécutée ; **son application distante n'a pas été vérifiée**. Sur une fixture locale reproduisant les politiques permissives, deux directeurs fictifs peuvent lire les données de l'autre avant la garde, même après les migrations financières : ce résultat ne démontre pas une fuite dans un environnement existant. Les politiques permissives se combinent par OR.

La proposition `20261108210000_child_finance_rls_guards.sql` ajoute des politiques **restrictives**, combinées par AND aux politiques existantes. Elles ne confèrent aucun accès : les droits et une politique permissive adaptée doivent déjà exister. Le directeur explicitement approuvé accède à ses enfants et à leurs factures, l'admin peut lire tous les dossiers selon les permissions existantes, les écritures directes de factures et suppressions directes d'enfants restent bloquées. La garde vise PUBLIC pour couvrir aussi les privilèges hérités par des rôles non privilégiés ; l'accès anonyme peut être refusé par erreur de permission plutôt que par résultat vide. Les rôles bypass RLS, propriétaires de table, fonctions privilégiées, autres tables, vues et politiques restent à auditer indépendamment. L'utilisation de SET ROLE, les appartenances et droits indirects, notamment sur `comptes`, doivent être examinés séparément. Ce n'est pas une sécurité globale.

La migration refuse de s'exécuter si RLS est désactivée sur une des deux tables ou si un nom de garde existe déjà. Elle verrouille les tables pendant l'installation, révoque aussi les grants directs de PUBLIC et anon et peut donc casser des flux existants ; elle ne corrige pas les grants hérités eux-mêmes. Évaluer les effets sur l'admission publique, les suppressions, le changement de crèche, les fonctions `SECURITY DEFINER`, les anciens clients et tous les parcours liés avant toute application sur staging. Ne pas appliquer sans inventaire des politiques, grants et propriétaires et sans plan de retour arrière testé. La migration comptes `100000` définit désormais elle-même l'auxiliaire d'approbation explicite, nécessaire à ses politiques avant `110000`. Elle peut restreindre des comptes historiques **avant** que `110000` ne refuse les statuts non revus : inventorier et faire valider ceux-ci avant toute application ; ne jamais les approuver automatiquement. Le client considère également tout statut directeur absent ou inconnu comme en attente, et masque les pages de données pour éviter des zéros trompeurs.

Le test séparé suivant crée un autre cluster PostgreSQL local éphémère, sans TCP ni connexion existante :

```sh
TEST_POSTGRES_BIN_DIR="$(pg_config --bindir)" pnpm test:finance-rls
```

Il reproduit le schéma essentiel et les anciennes politiques, utilise les migrations comptes/approbation et finance proposées, et simule `auth.uid()`, rôles, grants et données fictives. Il teste fuite de la fixture avant garde, deux crèches, compte en attente, admin, anon, droits hérités, changements de propriétaire, écritures directes, RPC financière, refus si RLS désactivée ou garde déjà présente. Ce n'est ni une reproduction complète de Supabase ni un test de tous les flux. Exécuter le plan de staging ci-dessus avec Auth, schéma, rôles et politiques réels du projet isolé avant toute décision.
