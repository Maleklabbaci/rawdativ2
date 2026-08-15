# Diagnostic Supabase Auth — 15 août 2026

Les trois erreurs « Unsupported provider: provider is not enabled » correspondent à des fournisseurs Auth non activés dans le projet Supabase, et non à une mauvaise syntaxe des appels Rawdha+.

## Constats officiels

- Google OAuth nécessite l’activation du provider Google dans Supabase et un Client ID/Client Secret créés dans Google Auth Platform. L’URL de production Rawdha+ doit être déclarée dans les origines autorisées et l’URL callback Supabase dans les redirect URIs.
- L’authentification e-mail passwordless (Magic Link / OTP) est activée par défaut dans Supabase. Pour afficher un code à six chiffres, le template e-mail doit contenir `{{ .Token }}` ; le lien magique est le comportement par défaut du même appel `signInWithOtp`.
- Le code Rawdha+ utilise `shouldCreateUser: false` pour les boutons Code e-mail et SMS afin de ne pas créer automatiquement un compte sans profil directeur.
- La connexion téléphone nécessite l’activation Phone dans Supabase et un fournisseur SMS configuré, par exemple Twilio, Vonage, MessageBird ou TextLocal.
- La connexion Google, e-mail OTP et téléphone OTP doit être rattachée à un profil `comptes` de rôle `directeur` ou `admin` ; aucun espace parent n’est activé.

## Sources

1. https://supabase.com/docs/guides/auth/social-login/auth-google — Login with Google | Supabase Docs
2. https://supabase.com/docs/guides/auth/auth-email-passwordless — Passwordless email logins | Supabase Docs
3. https://supabase.com/docs/guides/auth/phone-login — Phone Login | Supabase Docs

## Action nécessaire

Le tableau de bord Supabase demandait une reconnexion lors de la dernière vérification. Sans session active, il est impossible d’activer les providers ou d’exécuter la migration SQL directement depuis le dashboard. Le code peut toutefois masquer les méthodes non activées et conserver le mot de passe comme parcours directeur principal.

Ce fichier est une note technique locale et ne doit pas être publié avec les données métier.
