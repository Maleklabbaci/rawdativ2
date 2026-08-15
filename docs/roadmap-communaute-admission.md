# Rawdha+ — Réseau professionnel privé et admissions par lien

## Vision produit

Rawdha+ devient un double produit : un logiciel de gestion quotidien pour chaque crèche et un réseau professionnel privé réservé aux crèches validées. Les parents ne voient pas le réseau professionnel. Ils peuvent uniquement accéder à un formulaire d’admission lorsqu’une crèche leur transmet son lien ou son QR code.

## MVP d’admission

Chaque directeur génère un lien privé propre à sa crèche. Le lien contient un jeton aléatoire non devinable et peut être copié, partagé ou affiché sous forme de QR code. Le parent ouvre le lien sans compte Rawdha+, choisit la langue française ou arabe, puis remplit un dossier d’admission complet : identité de l’enfant, date de naissance, genre, informations médicales essentielles, parent ou tuteur légal, contacts, adresse et pièces demandées.

La soumission ne crée jamais immédiatement un enfant actif. Elle crée une demande d’admission avec le statut `en_attente`. La direction consulte uniquement les demandes de sa propre crèche, vérifie les informations, puis accepte ou refuse. À l’acceptation, l’enfant est créé dans la collection de gestion de la crèche et la demande devient `acceptee`. Un refus conserve une trace minimale et le motif saisi par la direction.

## Rôles et confidentialité

| Acteur | Accès |
|---|---|
| Parent invité | Formulaire public lié à une seule crèche ; aucune lecture des autres données |
| Directeur | Gestion de sa crèche, génération de ses liens, consultation et traitement de ses demandes |
| Administrateur Rawdha+ | Supervision globale, gestion des comptes et modération, sans formulaire public de parent |
| Parent avec compte interne | Pas d’accès au réseau professionnel dans le MVP actuel |

## MVP du réseau professionnel

Le réseau est un espace authentifié séparé des écrans de gestion. Seuls les directeurs de crèches validées et l’administrateur peuvent lire et publier. Les catégories initiales sont `activite`, `materiel`, `recrutement`, `formation`, `partenariat` et `vente_echange`.

Une publication de type `vente_echange` peut contenir un titre, une description, une ville, un prix indicatif, l’état du matériel et un moyen de contact professionnel. Le MVP ne traite pas les paiements et ne gère pas la livraison : les crèches se contactent directement. L’administrateur dispose de la modération et du signalement.

## Principes de sécurité

Le jeton du lien d’admission est stocké sous forme de hash côté base de données. La page publique ne peut obtenir que le nom et les informations publiques de la crèche concernée. Elle ne peut jamais lire la table `enfants`, les comptes, les paiements ou les demandes d’une autre crèche. Les écritures publiques passent par une fonction SQL sécurisée qui valide le jeton, contrôle les champs obligatoires et crée uniquement une demande en attente.
