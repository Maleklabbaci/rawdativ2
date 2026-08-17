# Correctif des notifications au premier plan

## Observation

Le premier envoi Firebase a été accepté et livré au jeton Android BlueStacks, mais aucune entrée n’était visible dans le tiroir système alors que Rawdha+ était ouvert. Dans ce cas, l’application reçoit l’événement de notification au premier plan ; elle doit créer explicitement une alerte locale pour rendre l’information visible à l’utilisateur.

## Décision

Rawdha+ conservera le traitement interne de l’événement Firebase et créera en complément une notification locale Android sur le canal `rawdha_foreground_alerts`. Ce comportement est uniquement exécuté dans l’APK Android, jamais dans le navigateur web.

## Référence officielle

La documentation Capacitor Local Notifications précise que le module permet de créer des notifications locales sur l’appareil et recommande, sur Android, de vérifier puis demander l’autorisation au moyen de `checkPermissions()` et `requestPermissions()` lorsque nécessaire. Sur Android 12 et versions antérieures, aucun dialogue n’est affiché et l’autorisation est retournée comme accordée.

Source : <https://capacitorjs.com/docs/apis/local-notifications> (consultée le 17 août 2026).
