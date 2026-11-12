# Inscription et SQL — préparation test, non déployée

## Situation constatée

Le projet test identifié par l'utilisateur contient des données fictives. L'utilisateur a exécuté manuellement la migration classes `20261108090000` et la migration comptes `20261108100000`, avec un ajout manuel qui met en `pending` une directrice test sans statut. Ces exécutions SQL Editor ne sont pas nécessairement inscrites dans `supabase_migrations.schema_migrations`. Ne pas les rejouer automatiquement. L'ancien document de 28 migrations ne contient pas la nouvelle migration `20261108370000` : ne pas l'exécuter en bloc.

## Objectif et périmètre

Le parcours proposé crée un compte sans carte, 15 jours d'essai, les paramètres et le début de l'onboarding. La certification reste indépendante. Les modifications locales concernent la fonction d'inscription, pas l'écran de connexion. La version locale n'est pas déployée ni testée sur le vrai Supabase.

La fonction Auth prépare un profil `pending`, puis la fonction serveur d'inscription appelle un RPC qui initialise compte, paramètres et onboarding dans une transaction. L'identité Auth et cette transaction ne sont pas atomiques ensemble : la suppression compensatoire en cas d'échec est best effort et peut échouer. Son alerte ne contient pas d'identifiants ; un mécanisme de surveillance et de réconciliation des comptes incomplets reste à concevoir avant production.

Une limite globale de 20 tentatives valides par minute dans la base est un garde-fou simple, pas une protection complète : un attaquant peut saturer la limite et bloquer les inscriptions. Prévoir un filtrage en amont fiable, des limites par source et une surveillance des abus, sans faire confiance aux en-têtes IP fournis par le navigateur. Elle est fail-closed : la fonction d'inscription échoue si la migration du quota n'est pas installée.

Le choix produit est l'accès immédiat, avec une future vérification séparée. La nouvelle table `director_email_verification` distingue ce statut : il reste non vérifié à l'inscription et ne peut pas être modifié par la directrice. Aucun lien ni mécanisme de vérification n'est encore implémenté. Ne jamais utiliser `auth.users.email_confirmed_at` comme preuve de possession pour ces inscriptions.

**Sécurité bloquante avant production** : l'API Auth admin crée actuellement un utilisateur avec `email_confirm: true` sans vérifier qu'il possède l'adresse. L'accès immédiat a été demandé, mais cela ne constitue pas une preuve de propriété de l'adresse et peut permettre l'occupation d'une adresse tierce. Il faut implémenter la vérification différée et une protection anti-abus sérieuse avant ouverture publique ; ne pas présenter ce parcours comme sécurisé ou prêt pour la production.

## Ordre de test conseillé — uniquement sur une copie/instance isolée après sauvegarde

1. Confirmer le projet et que l'application existante peut être interrompue. Faire une sauvegarde et vérifier sa restauration. Inventorier les versions, politiques, triggers et fonctions réellement installés, y compris les scripts manuels et les prérequis antérieurs à `20261108090000`. Les migrations préparées ont été testées localement, pas contre ce projet Supabase.
2. Prévoir une fenêtre où l'inscription est fermée ou inaccessible : la migration `20261108110000_explicit_director_approval.sql` modifie le hook Auth existant et, sans la fonction d'inscription correspondante, les nouveaux profils peuvent rester en attente. Ne pas l'appliquer isolément sur une application ouverte. La migration comprend un précontrôle des comptes existants : ne pas approuver automatiquement les comptes historiques pour le contourner.
3. Dans cet environnement de test, appliquer les prérequis vérifiés, dont la table onboarding `20261108270000_director_onboarding.sql`, puis la migration de quota et d'initialisation `20261108370000_director_signup_initialization.sql`, et le hook Auth `20261108110000_explicit_director_approval.sql` si ses autres prérequis et son impact ont été validés. Déployer la fonction `register-director-request` correspondante et le client correspondant dans la même fenêtre. L'ordre volontaire n'est pas celui de toutes les migrations complètes : toute installation exhaustive nécessite l'analyse de leurs dépendances et un plan séparé.
4. Tester avec des identités fictives : succès et essai de 15 jours, absence de carte requise, disponibilité de l'onboarding, unicité de l'adresse, limite de requêtes, compte pending existant, échec d'initialisation et compensation, erreurs réseau, et connexion de comptes préexistants. Vérifier les droits effectifs et l'accès à Rawdha Connect. Tester un vrai Supabase Auth, pas seulement les mocks locaux.
5. Préparer les autres migrations par groupes, vérifier leurs préconditions et données ; celles sur présence/finance prennent des verrous, valident les anciennes données et peuvent bloquer les anciens clients. Ne pas supprimer ou réécrire les données pour contourner un précontrôle. Ne pas marquer manuellement comme appliquée une migration non entièrement vérifiée.

Les tests locaux utilisent PGlite et une simulation Auth ; ils ne remplacent pas les tests de sécurité, de concurrence, réseau et restauration sur Supabase réel. La version SQL de test et la fonction Edge doivent être publiées ensemble ; ne jamais mettre de clé service dans le navigateur, le SQL à partager ou les logs.
