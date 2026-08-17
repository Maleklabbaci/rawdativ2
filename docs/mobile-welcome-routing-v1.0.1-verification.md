# Vérification du correctif de transition mobile — v1.0.1

Le parcours mobile a été exécuté sur une fenêtre de 393 × 852 pixels. Après cinq secondes, soit au-delà du délai du fondu et de la redirection automatique, le formulaire de connexion Rawdha+ est affiché normalement. Aucun écran blanc ne subsiste.

Le parcours de la route `/welcome/` a également été contrôlé sur une fenêtre ordinateur de 1 440 × 900 pixels. Il redirige directement vers la page de connexion avec le split layout, sans afficher l’introduction réservée aux téléphones.

L’APK a été régénérée en version 1.0.1 après synchronisation Capacitor. Les fichiers Android embarquent désormais le logo officiel et le bundle web correspondant à ce correctif.
