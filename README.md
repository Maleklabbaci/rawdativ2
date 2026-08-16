# Rawdha+

Rawdha+ est une plateforme professionnelle de gestion des crèches. Elle centralise les enfants, les admissions, les classes, les présences, les paiements, le personnel, les activités, les repas et les rapports dans une interface adaptée aux ordinateurs et aux téléphones.

## Développement local

### Prérequis

Node.js 20 ou une version plus récente et pnpm sont nécessaires.

### Installation

```bash
pnpm install --frozen-lockfile
```

### Lancement en développement

```bash
pnpm dev
```

### Vérification TypeScript

```bash
pnpm exec tsc --noEmit
```

### Build de production

```bash
pnpm build
```

## Déploiement

La branche `main` du dépôt `Maleklabbaci/rawdativ2` est reliée au déploiement de production Rawdha+. Les fichiers de configuration PWA sont disponibles dans `public/manifest.webmanifest` et `public/sw.js`.

## Modules principaux

Rawdha+ propose un espace directeur pour la configuration de la crèche, la gestion des enfants et des admissions par QR permanent, les classes, les présences, les paiements, le personnel, les activités, les repas, les rapports et les paramètres de l’établissement.

## Données et sécurité

Les données applicatives sont stockées dans Supabase. Les règles d’accès et les politiques RLS doivent être vérifiées dans le projet Supabase avant toute mise en production d’une nouvelle fonctionnalité.
