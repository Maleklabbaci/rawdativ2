# Recherche technique — Notifications push Rawdha+

Les notifications Android natives peuvent être intégrées à l’application Capacitor avec le module officiel `@capacitor/push-notifications`. Sur Android, ce module s’appuie sur Firebase Cloud Messaging (FCM) et demande d’ajouter le fichier `google-services.json` du projet Firebase dans le répertoire Android de l’application. La documentation indique aussi que l’application doit demander explicitement l’autorisation de notification à partir d’Android 13, puis enregistrer le jeton de l’appareil.

La conception doit inclure un canal Android dédié et une icône de notification monochrome afin d’éviter l’affichage générique de l’icône d’application. Le client doit gérer l’enregistrement, les erreurs d’enregistrement, la réception au premier plan et l’action de l’utilisateur sur une notification. Les messages silencieux ou purement data demandent une gestion native complémentaire si l’application est complètement fermée.

FCM nécessite un environnement serveur de confiance pour envoyer les notifications ; Google recommande un serveur applicatif ou Cloud Functions, avec l’Admin SDK ou l’API HTTP v1. Pour Rawdha+, le serveur d’envoi peut être adossé à Supabase : il enregistrerait les jetons appareils par utilisateur et déclencherait les envois depuis une fonction sécurisée.

## Sources

[1] Capacitor, « Push Notifications API » — https://capacitorjs.com/docs/apis/push-notifications

[2] Firebase, « Get started with Firebase Cloud Messaging in Android apps » — https://firebase.google.com/docs/cloud-messaging/android/get-started

[3] Firebase, « Firebase Cloud Messaging » — https://firebase.google.com/docs/cloud-messaging
