# État de configuration Firebase — Rawdha+

- Date : 17 août 2026.
- Projet Firebase demandé et créé en cours : **Rawdha Notifications**.
- Finalité : notifications push Android de Rawdha+ via Firebase Cloud Messaging (FCM).
- Services facultatifs laissés désactivés : Google Developer Program, Gemini dans Firebase et Google Analytics.
- Étape actuelle : la console Firebase affiche « Préparation de votre projet, veuillez patienter » après la soumission de création.
- Prochaine étape : enregistrer l’application Android avec l’identifiant `com.rawdhaplus.app`, télécharger `google-services.json`, puis intégrer la réception de notifications Capacitor et le stockage sécurisé des jetons dans Supabase.

> Aucun secret Firebase ni jeton d’appareil n’est enregistré dans ce document.

## Observation d’initialisation

Deux vérifications successives de la console indiquent que le projet est encore en cours de préparation. Aucune action de configuration applicative n’est lancée tant que cette initialisation n’est pas terminée.

## Accès au projet

La console est accessible à l’adresse du projet `rawdha-notifications`. Le tableau de bord est encore en chargement, ce qui indique que la création ou l’initialisation des ressources Firebase est toujours en cours.

## Projet et application Android

Le projet Firebase `Rawdha Notifications` est prêt sur le forfait Spark sans frais. L’assistant d’ajout d’application Android est ouvert avec le package réel `dz.rawdha.plus` et le pseudo `Rawdha+ Android`.

## Validation de l’application

Le package `dz.rawdha.plus` est marqué valide par le formulaire Firebase. Le bouton d’enregistrement reste néanmoins désactivé ; une validation asynchrone de la console est en cours de diagnostic avant toute modification de l’identifiant d’application.

## Enregistrement Firebase

L’application Android `Rawdha+ Android` portant l’identifiant `dz.rawdha.plus` a été enregistrée dans le projet Firebase `rawdha-notifications`. L’assistant est passé à l’étape de téléchargement du fichier de configuration Android.

## Configuration Android

Le fichier `google-services.json` a été demandé depuis Firebase. Il sera placé dans le module `android/app` de Rawdha+ afin de relier l’APK au projet de notifications.

## Compte de service d’envoi

Le projet Firebase `rawdha-notifications` est actif au forfait Spark sans Analytics. L’application Android `dz.rawdha.plus` est enregistrée. Une clé de compte de service a été explicitement autorisée pour l’envoi sécurisé côté serveur et ne doit jamais être distribuée dans l’APK ni versionnée dans Git.

## Identifiants publics de configuration

- Projet Firebase : `rawdha-notifications`
- Numéro de projet : `512177384592`
- Application Android : `dz.rawdha.plus`
- Identifiant d’application Firebase : `1:512177384592:android:4415bda42c972491097c15`

L’onglet « Comptes de service » est en cours de chargement pour la création de la clé privée autorisée. Cette clé ne sera pas inscrite dans ce document.
