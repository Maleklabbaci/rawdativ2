# Revue manuelle des factures potentiellement en double

Cette fiche est une **proposition de travail à valider avec le comptable**, pas une règle comptable ou un avis juridique. Les fonctions de facturation décrites ci-dessous sont proposées localement : les migrations ne sont pas installées en production. Les protections ne doivent pas être présumées actives sur la base réelle avant déploiement coordonné et vérification sur staging.

## 1. Mettre la paire en attente

Dans Facturation, ouvrir « Corriger une période ou signaler un doublon suspect », choisir les deux factures du même enfant et saisir la source et le motif du soupçon. Comparer les données et confirmer la vérification. Si l'enregistrement ou la lecture est incertain, recharger et vérifier la facture signalante et son historique avant de recommencer. Ne pas inventer une période pour contourner un conflit.

Le signalement ne prouve pas le doublon. Lorsque la protection serveur proposée est déployée et fonctionne, elle bloque les modifications et la classification des deux factures et les nouvelles factures de l'enfant ; le client masque leurs rappels. Ce n'est pas un verrou de toutes les opérations externes ou privilégiées, ni une garantie que d'autres appareils ont actualisé leur vue. Les factures et leurs montants restent inclus dans les totaux, qui peuvent être erronés. Ne pas utiliser ces totaux comme preuve de dette ou de paiement.

Si plus de deux factures semblent liées, ou si une facture n'est pas visible, ne pas supposer que la paire couvre tout le dossier ; documenter les autres références dans le dossier manuel et demander une revue. L'interface actuelle ne représente qu'une paire par signalement et ne détecte pas tous les doublons.

## 2. Constituer un dossier de vérification

Sans modifier les originaux, recueillir les références des deux factures, les périodes et montants, les dates et les justificatifs disponibles. Comparer les registres pertinents hors de l'application et vérifier les encaissements éventuellement reçus, leur date, montant, référence et affectation, sur la base de pièces indépendantes. Noter explicitement « inconnu » lorsqu'une information ou une preuve manque : un statut « Payé » ne prouve pas un encaissement, et un statut non payé ne prouve pas son absence. Vérifier également si une facture a déjà été communiquée et s'il existe d'autres documents ou opérations liés.

Partager uniquement les informations nécessaires avec les personnes habilitées, par le canal sécurisé retenu par la crèche. L'historique technique contient des instantanés potentiellement sensibles : ne pas le copier intégralement ou l'envoyer sans contrôle. La fiche ci-dessous reste hors de l'application : celle-ci n'enregistre ni ne transmet l'avis du comptable, n'héberge pas de justificatif et ne gère pas la conservation de ce dossier.

## 3. Demander et conserver un avis

Faire examiner le dossier par le comptable compétent, y compris les paiements éventuellement liés et les obligations applicables. Conserver l'avis, la date, le responsable et la référence du dossier dans le système documentaire autorisé de la crèche, selon sa politique de confidentialité et de conservation. Le comptable doit déterminer la procédure appropriée : ne pas supposer qu'une suppression, un avoir, une compensation ou un remboursement est autorisé ou nécessaire.

- **Doublon confirmé ou preuve insuffisante :** maintenir le signalement. Aucune annulation, exclusion des totaux, compensation ou restitution n'est réalisable dans ce parcours. L'avis externe n'est pas enregistré dans l'application ; un traitement ultérieur devra être conçu et validé avant toute opération dans celle-ci.
- **Les pièces établissent qu'il ne s'agit pas d'un doublon :** sur la facture signalante, « Écarter le soupçon » avec une justification et une attestation. Ceci lève la suspension : ne l'utiliser ni pour un doublon confirmé, ni pour contourner un blocage, ni en l'absence de preuves suffisantes.
- **Réponse perdue, erreur de lecture ou situation non couverte :** ne pas présumer qu'une action a échoué ou réussi ; recharger, consulter l'historique de la facture signalante et faire vérifier le dossier avant de poursuivre.

## Fiche externe vierge (à compléter hors du dépôt)

- Référence interne du dossier et date d'ouverture :
- Facture signalante et autre facture (identifiants) ; autres factures à examiner :
- Motif du soupçon, période(s), références des pièces et informations manquantes :
- Encaissement(s) vérifié(s), références des preuves et affectation(s), ou « inconnu » :
- Personne chargée de la vérification et date :
- Comptable consulté, date et référence sécurisée de son avis :
- Conclusion : doublon confirmé / pas un doublon / indéterminé ; justification et pièces :
- Prochaine action manuelle, responsable et date de suivi :

Ne pas conserver de dossier complété dans ce dépôt ni dans un canal non autorisé. Cette fiche n'exécute aucune opération et ne remplace pas les registres ou les pièces originaux.
