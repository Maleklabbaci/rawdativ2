# Environnement Android pour Rawdha+

La documentation officielle Android indique que les applications peuvent être compilées à l’aide des outils en ligne de commande du SDK, installés dans le répertoire `cmdline-tools`, et que les variables ou chemins SDK doivent être configurés pour les builds en ligne de commande. Les composants nécessaires à la compilation incluent les Command-line Tools, Build Tools, Platform Tools et la plateforme Android ciblée.

Source officielle consultée : https://developer.android.com/tools

Pour Rawdha+, le SDK est installé localement dans `/opt/android-sdk`, référencé par `android/local.properties`. Les composants utilisés comprennent la plateforme Android 36, les Build Tools 36.0.0 et 35.0.0, ainsi que les Platform Tools. Le build Android s’appuie sur OpenJDK 21.
