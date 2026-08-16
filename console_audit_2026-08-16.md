# Audit console Rawdha+ — 16 août 2026

## Version publique

- URL testée : https://rawdativ2.vercel.app/
- La page de connexion se charge correctement.
- Première lecture de console : aucune sortie ni erreur.
- Après rechargement : aucune sortie ni erreur.
- Le bundle public observé est `assets/index-B7GJzyIM.js`.

## Page admission publique

- URL testée : https://rawdativ2.vercel.app/admission
- Sans token, l’interface affiche correctement « Lien non disponible ».
- Lecture de console : aucune sortie ni erreur.

## Ressources observées

- `index-B7GJzyIM.js`
- `index-wQcKHpW4.css`
- `manifest.webmanifest`
- `favicon.png`

Le navigateur supporte les service workers. La vérification initiale n’a pas encore confirmé une registration active, car le résultat asynchrone de `getRegistrations()` n’a pas été déroulé dans la première commande.

## Limite actuelle

Le parcours directeur authentifié n’est pas testable sans ouvrir une session réelle. Les prochaines vérifications doivent donc distinguer les erreurs publiques déjà exclues des erreurs éventuelles liées au compte, aux permissions Supabase ou aux données de la crèche.

## Bug découvert pendant l’audit

L’ouverture directe de `https://rawdativ2.vercel.app/dashboard` renvoie une page Vercel `404: NOT_FOUND`, alors que la navigation SPA depuis `/` fonctionne. La configuration actuelle de `vercel.json` ne réécrit que `/admission` et `/admission/:path*` vers `index.html`. Il faut ajouter un fallback SPA général vers `index.html`, en veillant à conserver le service des fichiers statiques et des assets hashés.

La registration du service worker a ensuite été confirmée active avec le scope `https://rawdativ2.vercel.app/`. Le manifeste, le service worker, le bundle JavaScript et la feuille CSS répondent tous en HTTP 200.
