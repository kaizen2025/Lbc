# CardTrade — le Leboncoin des cartes TCG

Marketplace **locale** de cartes à collectionner (Pokémon, Riftbound/LoL, Magic, …) :
achat, vente et échange **en remise en main propre uniquement**, argent séquestré par la
plateforme (1 € de frais), portfolio de collection avec cote **EU et US** par carte et par
langue d'impression.

> Spécification produit complète : [`docs/SPEC.md`](docs/SPEC.md)

## Un seul code, trois plateformes

Tout est en **TypeScript** dans un monorepo pnpm/Turborepo. L'app cliente est en
**Expo (React Native) + Expo Router** et produit **iOS, Android et Web** depuis la même
base de code.

```
apps/
  mobile-web/   # Expo → iOS + Android + Web (react-native-web)
  server/       # API tRPC (Node)
packages/
  api/          # Routers tRPC + logique métier (types partagés bout-en-bout)
  db/           # Schéma Drizzle ORM + migrations + seed (PostgreSQL / Supabase)
  validators/   # Schémas Zod partagés front/back
  i18n/         # Traductions FR/EN + helpers
```

## Démarrer

```bash
pnpm install

# 1. Base de données (PostgreSQL avec PostGIS, ex. Supabase)
cp .env.example .env          # remplir DATABASE_URL etc.
pnpm db:generate              # générer les migrations SQL depuis le schéma
pnpm db:migrate               # appliquer les migrations
pnpm db:seed                  # catalogue de démo (Pokémon + Riftbound)

# 2. API
pnpm server                   # http://localhost:3001

# 3. App (web / iOS / Android)
pnpm web                      # web sur http://localhost:8081
pnpm app                      # QR code Expo Go / simulateurs
```

## Builds natifs

Les binaires iOS/Android se construisent avec [EAS Build](https://docs.expo.dev/build/introduction/) :

```bash
cd apps/mobile-web
npx eas build --platform ios
npx eas build --platform android
```

## Vérifications

```bash
pnpm typecheck   # TypeScript strict sur tous les packages
pnpm build       # build de tous les packages
```

## Phases

1. **Socle marketplace** (en cours) : auth, profils géolocalisés, catalogue, annonces,
   recherche par distance, messagerie, i18n FR/EN.
2. **Paiement séquestré** : Stripe Connect, double validation QR au rendez-vous, litiges.
3. **Portfolio & cote** : collection, historique de prix EU (Cardmarket) et US
   (eBay/TCGplayer), graphiques, alertes.
4. **Scan & croissance** : reconnaissance de carte par photo, assistant d'état,
   matching wishlist, push.
