# Rawdha+ — Architecture du réseau professionnel privé

## Objectif

La Communauté Rawdha+ est un espace professionnel réservé aux crèches validées. Elle ne doit pas être visible par les parents et ne doit jamais mélanger les publications avec les données opérationnelles privées d’une crèche.

## Accès

| Profil | Lecture du fil | Publication | Commentaire/réaction | Modération |
|---|---:|---:|---:|---:|
| Administrateur Rawdha+ | Oui | Oui, si nécessaire | Oui | Oui |
| Directeur validé | Oui | Oui | Oui | Peut supprimer ses propres contenus |
| Personnel autorisé | Phase ultérieure | Phase ultérieure | Phase ultérieure | Non |
| Parent | Non | Non | Non | Non |

Le MVP applique une règle simple : seuls les comptes `directeur` et `admin` passent les politiques RLS du réseau. Le rôle `parent` est rejeté côté serveur, même s’il tente d’appeler directement l’API.

## Publications du MVP

Une publication possède un auteur, la crèche de l’auteur, une catégorie, un titre optionnel, un contenu, une ville optionnelle, un prix optionnel pour les annonces de vente ou d’échange, une liste d’images encodées temporairement, un statut de modération et des compteurs de réactions. Les catégories initiales sont `activite`, `materiel`, `recrutement`, `formation`, `partenariat` et `vente_echange`.

Les commentaires sont volontairement séparés de la publication dans une table dédiée. Cette séparation évite d’écraser le JSONB complet d’une publication lors d’un commentaire et permettra ensuite d’ajouter la suppression, le signalement et la pagination sans modifier les compteurs historiques.

## Règles de sécurité

La lecture RLS est limitée aux directeurs et administrateurs. La création vérifie que `author_id` et `creche_id` correspondent à la session courante pour un directeur. La modification et la suppression sont réservées à l’auteur de la publication ou à l’administrateur. Les commentaires suivent la même logique d’auteur. L’administrateur peut masquer un contenu en passant son statut à `masquee` sans effacer immédiatement la trace.

Les données sensibles de gestion — enfants, paiements, présences, dossiers d’admission et coordonnées privées des parents — ne doivent jamais être copiées dans une publication communautaire. Les annonces de matériel et de partenariat peuvent utiliser un moyen de contact professionnel fourni par la crèche, sans exposer de données familiales.

## Livraison progressive

La première version doit privilégier un fil fiable : création, lecture, filtres, réactions simples, suppression de son propre contenu et modération administrateur. La messagerie privée, les notifications, la marketplace avec paiement et la gestion de livraison seront développées après validation de l’usage par les crèches.
