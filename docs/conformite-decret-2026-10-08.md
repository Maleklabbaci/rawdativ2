# Rawdha+ — Conformité réglementaire (crèche / jardin d'enfants)

**Date :** 8 octobre 2026
**Branche :** `arena/95a8c425-rawdativ2`
**Objet :** couverture des 7 obligations imposées par le décret et contrôlées lors des inspections de la DAS.

---

## 1. Ce qui est installé

### Point 1 — Dossiers administratifs enfants & tuteurs ✅
- **Six pièces obligatoires** suivies par enfant : certificat médical, carnet de vaccination, extrait de naissance, contrat d'accueil, justificatif de domicile, photo d'identité. Compteur de complétude visible et alerte sur le tableau de bord.
- **Personnes autorisées à récupérer l'enfant** : liste nominative par enfant, avec lien de parenté, téléphone et activation/désactivation d'une autorisation.
- **Autorisation de sortie signée** enregistrée au dossier.
- **Matricule** attribué automatiquement à l'admission (compteur propre à chaque crèche, affiché sous la forme `N° 0042`).
- **Section réglementaire** de l'enfant : nourrissons 3–12 mois, petite, moyenne et grande section.

### Point 2 — Dossier médical & suivi santé ✅
- Données de santé au dossier : groupe sanguin, allergies, régime alimentaire, médecin traitant, vaccinations, notes.
- **Registre de suivi santé** par enfant, six types d'événements : prise de médicament (produit, dose, ordonnance, administré par), incident (description, gravité, localisation, soins donnés, parents prévenus), soin, visite médicale, visite psychologique, rappel médical programmé.
- Journal chronologique avec badges (Grave / Parents prévenus / Rappel à venir) et suppression ligne par ligne.

> **Action à faire une seule fois :** coller le contenu de
> `supabase/migrations/20261008090000_sante_evenements.sql` dans l'éditeur SQL de Supabase.
> Avant cette étape, l'onglet « Suivi santé » s'ouvre normalement mais le registre reste vide.

### Point 3 — Capacité d'accueil & groupes ✅
- **Plafond d'agrément** saisi dans Paramètres, borné au maximum légal national de 150 enfants.
- **Blocage de l'inscription** dès que le nombre d'enfants actifs atteint le plafond, avec message explicite à la directrice.
- Alerte visible lorsque la capacité est atteinte ou dépassée, et rappel de la capacité dans l'en-tête des Paramètres.

### Point 4 — Personnel & plannings ✅
- **Dossier RH par agent** : diplômes et qualifications (liste), référence des diplômes, certificat médical d'aptitude, extrait de casier judiciaire, rôle d'encadrement.
- **Badges de conformité** sur chaque fiche du personnel (diplômes, aptitude, casier) et compteur de dossiers incomplets.
- **Ratio d'encadrement réel** : enfants actifs ÷ encadrants actifs, avec alerte au-delà du seuil indicatif. (Le « 1 : 5 » affiché auparavant était une valeur fixe décorative, elle a été remplacée par le calcul réel.)
- **Registre des gardes & permanences** : week-ends (vendredi et samedi) et jours fériés nationaux fixes détectés automatiquement, affectation d'un agent en un clic, horaire et observation, registre mensuel imprimable avec colonne d'émargement et visas.

### Point 5 — Pointage & registres légaux ✅
- Pointage quotidien enrichi : heure d'arrivée, **nom de la personne qui dépose l'enfant**, heure de départ, personne qui récupère, **contrôle de l'autorisation de récupération**, température.
- **Registre d'appel imprimable** pour la journée choisie : présents/absents, dépôt et retrait nominatifs, colonne « autorisation », colonnes de signature dépôt et retrait, visas direction et inspection.
- **Registre matricule imprimable** de tous les enfants admis : matricule, identité, date de naissance, section, date d'admission, pièces au dossier, nombre d'autorisations, statut.

### Point 6 — Facturation, tarifs & paiements ✅
- **Paramètres tarifaires complets** : frais de scolarité mensuel, frais d'inscription (une fois), tarif cantine journalier, pénalité de retard (pourcentage par mois ou montant fixe), délai de grâce, devise.
- **Grille tarifaire imprimable** à remettre aux familles : tous les montants, les modalités de règlement et les cases de signature. C'est la pièce qui matérialise la transparence tarifaire.
- **Type de facture « Frais d'inscription »** alimenté directement par les Paramètres.
- **Pénalités de retard calculées** sur les factures impayées (mois de retard × barème, après le délai de grâce), affichées sur la carte de facture et dans le reçu, avec **total à régler**, et rappelées dans la relance WhatsApp.

> Les reçus et factures PDF existaient déjà (`Facture.tsx`), ils ont été complétés par la ligne de pénalité et le total dû.

### Point 7 — Cantine, hygiène & programmes ✅
- **Menu de la semaine** : vue hebdomadaire (dimanche → samedi) croisant déjeuner et goûter, compteur de jours couverts, et **affichage imprimable** à poser en salle de restauration (allergènes, apport calorique, bio, hydratation).
- **Planning des activités d'éveil** : chaque atelier porte désormais un **domaine d'éveil** (éveil sensoriel, psychomotricité, langage & comptines, motricité fine, arts plastiques, vie pratique & autonomie, jeux libres), avec horaire, compétence visée, groupe, lieu et encadrant.
- **Planning hebdomadaire imprimable** (grille jour par jour), compteur d'ateliers programmés et de domaines couverts, visas direction et inspection.

---

## 2. Où trouver chaque chose dans l'application

| Fonction | Écran |
|---|---|
| Pièces du dossier, personnes autorisées, section, matricule | Enfants → ouvrir une fiche enfant |
| Registre de suivi santé | Enfants → fiche enfant → onglet « Suivi santé » |
| Plafond d'agrément, tarifs, frais d'inscription, pénalités, grille tarifaire | Paramètres → Coordonnées & Tarifs, Agrément |
| Dossier RH, ratio d'encadrement, gardes & permanences | Personnel |
| Registre d'appel imprimable | Présences → bouton « Registre d'appel » |
| Registre matricule imprimable | Enfants → bouton « Registre matricule » |
| Menu de la semaine | Repas → « Menu de la semaine » / « Imprimer le menu » |
| Planning des activités | Activités → « Planning de la semaine » / « Imprimer le planning » |
| Factures, pénalités, relances | Paiements |

---

## 3. Reste à faire de votre côté

1. **Coller une fois** `supabase/migrations/20261008090000_sante_evenements.sql` dans l'éditeur SQL Supabase (aucune autre migration n'est nécessaire pour les autres points : tout le reste s'appuie sur les colonnes JSONB existantes).
2. **Renseigner les Paramètres** : plafond d'agrément, frais d'inscription, barème de pénalité, délai de grâce. Les écrans de conformité affichent « — » tant que ces valeurs ne sont pas saisies, plutôt que d'inventer des montants.
3. **Imprimer la grille tarifaire** et la remettre aux familles à l'inscription ; afficher le menu de la semaine et le planning d'activités dans les salles.

---

## 4. Points de vigilance identifiés pendant le chantier

- **Valeurs par défaut fabriquées** : sur les fiches d'atelier anciennes, l'application complète à l'affichage les champs vides (compétence, horaire, lieu, encadrant) par des valeurs d'exemple. Un contrôle pédagogique pourrait lire ces valeurs comme déclaratives. Les ateliers créés depuis cette version stockent les vraies saisies ; il reste à reprendre les anciens.
- **Ratio d'encadrement** : le seuil d'alerte retenu (8 enfants par encadrant) est un repère de travail. Le seuil opposable est celui fixé par votre agrément de wilaya — à ajuster si votre arrêté prévoit une valeur différente.
- **Jours fériés** : seuls les jours fériés nationaux à date fixe (1er janvier, Yennayer, 1er mai, 5 juillet, 1er novembre) sont détectés automatiquement. Les fêtes religieuses, dont la date varie chaque année, se déclarent manuellement en choisissant le type « Jour férié » sur la date concernée.
- **Registre des gardes** : les gardes sont enregistrées sur la fiche de l'agent. Un agent supprimé du personnel emporte ses lignes de registre ; à nettoyer avant tout départ si vous conservez l'historique imprimé.
