# 📖 CardTrade — Mode d'emploi complet

> Ce guide explique **tout** : ce que fait l'application, comment elle est construite,
> comment la lancer sur ton ordinateur, et comment modifier chaque partie sans rien casser.
> Aucune connaissance préalable n'est supposée — les termes techniques sont expliqués
> dans le [glossaire](#-glossaire) en bas de page.

---

## 1. 🎯 C'est quoi CardTrade ?

CardTrade est **le Leboncoin des cartes à collectionner (TCG)** : Pokémon, Riftbound
(League of Legends), Magic, etc.

### Les 3 idées fondatrices

1. **Tout se passe près de chez toi.** Quand tu cherches une carte, l'app te montre
   **la personne la plus proche** qui la vend ou l'échange. Pas d'envoi postal, pas
   d'arnaque au colis : **remise en main propre uniquement**.

2. **L'argent est sécurisé par la plateforme.** L'acheteur paie dans l'app, CardTrade
   **garde l'argent en séquestre** (comme un coffre-fort) et prélève **1 € de frais**.
   Au rendez-vous, chacun scanne le **QR code** de l'autre pour valider l'échange →
   l'argent est alors versé au vendeur. Si ça se passe mal → remboursement.

3. **Ta collection a une valeur, suis-la.** Chaque utilisateur a un **portfolio**
   (comme l'app Collectr) : valeur totale, graphique qui monte/descend, cote de chaque
   carte. Et surtout, la cote est suivie **par langue de la carte** (une carte anglaise
   ne vaut pas une française) **et par marché** : cote **Europe** (Cardmarket, en €) et
   cote **US/internationale** (eBay/TCGplayer, en $) — l'écart entre les deux est affiché.

### Ce qui nous différencie de Collectr

Collectr fait très bien le portfolio, mais **on ne peut rien y acheter localement**.
CardTrade = portfolio **+** marketplace de proximité en main propre. C'est le cœur du projet.

---

## 2. 🗺️ Les fonctionnalités et leur état d'avancement

Le projet se construit en **4 phases** :

| Phase | Contenu | État |
|---|---|---|
| **1 — Socle marketplace** | Comptes, profils géolocalisés, catalogue de cartes, annonces (vente/échange/recherche), recherche par distance, messagerie, app FR/EN sur iOS + Android + Web | ✅ Fonctionnel : connexion/inscription, profil avec position GPS, dépôt d'annonce, fiche annonce, offres, conversations |
| **2 — Paiement sécurisé** | Paiement Stripe, séquestre, 1 € de frais, double validation QR au rendez-vous, litiges, avis/réputation | 🟡 Démarré : machine à états des transactions + double validation par code au rendez-vous + avis déjà en place (trades sans argent opérationnels) ; il reste le paiement Stripe |
| **3 — Portfolio & cote** | Collection, prix EU/US automatiques quotidiens, graphiques 1J→MAX, alertes de prix, export CSV | ⏳ À venir (API et base déjà prêtes, données de démo incluses) |
| **4 — Scan & croissance** | Scanner une carte avec l'appareil photo pour l'identifier, assistant photos d'état, notifications, matching wishlist | ⏳ À venir |

Les 6 onglets de l'app : **Accueil** (annonces proches, tendances) · **Recherche** ·
**Vendre** · **Messages** · **Portfolio** · **Profil**.

---

## 3. 🏗️ Comment c'est construit (la grande idée)

### Un seul code pour tout

Le problème classique : développer une app iPhone, PUIS une app Android, PUIS un site web
= 3 fois le travail. CardTrade évite ça :

- **Un seul langage** : TypeScript (du JavaScript avec des garde-fous).
- **Un seul code d'interface** : grâce à **Expo (React Native)**, le même code produit
  l'app iPhone, l'app Android **et** le site web.
- **Un seul contrat entre l'app et le serveur** : grâce à **tRPC**, si on change quelque
  chose côté serveur, l'app le sait immédiatement (erreur à la compilation au lieu d'un
  bug en production).

### La carte du projet (qui fait quoi)

```
Lbc/
├── docs/
│   ├── SPEC.md          ← la spécification produit complète
│   └── GUIDE.md         ← ce guide
│
├── apps/
│   ├── mobile-web/      ← L'APPLICATION (iOS + Android + Web, un seul code)
│   │   ├── app/             ← les écrans (1 fichier = 1 écran)
│   │   │   ├── _layout.tsx      ← enveloppe générale (connexion à l'API, thème)
│   │   │   └── (tabs)/          ← les 6 onglets
│   │   │       ├── index.tsx        ← Accueil
│   │   │       ├── search.tsx       ← Recherche
│   │   │       ├── sell.tsx         ← Vendre
│   │   │       ├── messages.tsx     ← Messages
│   │   │       ├── portfolio.tsx    ← Portfolio
│   │   │       └── profile.tsx      ← Profil
│   │   └── src/
│   │       ├── theme.ts         ← LES COULEURS ET ESPACEMENTS (à modifier ici !)
│   │       ├── components/ui.tsx← briques d'interface réutilisables
│   │       └── lib/             ← branchements techniques (API, langues)
│   │
│   └── server/          ← LE SERVEUR (reçoit les demandes de l'app)
│       └── src/main.ts      ← démarrage, vérification de l'identité des utilisateurs
│
└── packages/            ← briques partagées entre l'app et le serveur
    ├── db/              ← LA BASE DE DONNÉES
    │   ├── src/schema.ts    ← la liste de TOUTES les tables (18 tables)
    │   ├── src/seed.ts      ← données de démo (Pokémon 151, Riftbound Origins)
    │   └── drizzle/         ← migrations SQL générées automatiquement
    ├── api/             ← LA LOGIQUE MÉTIER (routers tRPC)
    │   └── src/routers/     ← catalog, listings, offers, chat, collection, prices, profile
    ├── validators/      ← les règles de validation (ex : un pseudo fait 3-30 caractères)
    └── i18n/            ← LES TEXTES DE L'APP EN FRANÇAIS ET ANGLAIS
        └── src/locales/     ← fr.json et en.json
```

### Le trajet d'une action (exemple : « je cherche une carte »)

1. Jimmy tape « Ahri » dans l'onglet Recherche (`app/(tabs)/search.tsx`).
2. L'app appelle le serveur via tRPC : `catalog.searchCards({ query: "Ahri" })`.
3. Le serveur (`packages/api/src/routers/catalog.ts`) interroge la base PostgreSQL.
4. Les résultats reviennent **typés** : si demain on renomme un champ, l'app
   refusera de compiler tant qu'elle n'est pas mise à jour. Zéro décalage possible.

### Les technologies (et pourquoi)

| Brique | Techno | Pourquoi |
|---|---|---|
| App (3 plateformes) | Expo + React Native + Expo Router | 1 seul code pour iOS/Android/Web |
| Serveur API | tRPC + Node.js | typage bout-en-bout, zéro doublon |
| Base de données | PostgreSQL (hébergé chez Supabase) + Drizzle | robuste, migrations versionnées |
| Comptes utilisateurs | Supabase Auth | email + Apple + Google, sécurisé |
| Paiement séquestré | Stripe Connect (Phase 2) | gère le séquestre ET la conformité légale (KYC) |
| Traductions | i18next | FR/EN, extensible à d'autres langues |

---

## 4. 💻 Installer et lancer le projet chez toi

### Prérequis (une seule fois)

1. **Node.js 20 ou plus** : télécharger sur [nodejs.org](https://nodejs.org) (version LTS).
2. **pnpm** (le gestionnaire de paquets du projet) : dans un terminal :
   ```bash
   npm install -g pnpm
   ```
3. **Git** : [git-scm.com](https://git-scm.com) (souvent déjà installé sur Mac).
4. Sur téléphone : installer l'app **Expo Go** (App Store / Play Store) pour tester
   sans rien compiler.

### Récupérer et installer le projet

```bash
git clone https://github.com/kaizen2025/Lbc.git
cd Lbc
pnpm install
```

### Configurer la base de données (une seule fois)

**La base existe déjà** : les 18 tables CardTrade sont installées dans le **schéma
`cardtrade`** du projet Supabase existant (isolé du reste du projet, non exposé par
l'API publique), avec les données de démo déjà chargées (Pokémon 151, Riftbound Origins,
30 jours de prix EU/US).

Il ne reste qu'à créer ton fichier de configuration :

```bash
cp .env.example .env
```

puis ouvrir `.env` : les URL et clés Supabase sont **déjà pré-remplies**. Il manque
uniquement le **mot de passe de la base** dans `DATABASE_URL` (remplacer
`<MOT_DE_PASSE>`) — demande-le à Kevin, ou récupère-le dans le dashboard Supabase
(**Settings → Database**, bouton « Reset database password »).

> Si un jour on modifie les tables (`schema.ts`) : `pnpm db:generate` puis
> `pnpm db:migrate` applique les changements. `pnpm db:seed` recharge la démo.

### Lancer (à chaque session de travail)

Ouvrir **2 terminaux** à la racine du projet :

```bash
# Terminal 1 — le serveur API
pnpm server        # → « CardTrade API prête sur http://localhost:3001 »

# Terminal 2 — l'application
pnpm web           # version web → s'ouvre sur http://localhost:8081
# OU
pnpm app           # affiche un QR code → le scanner avec Expo Go sur ton téléphone
```

> 💡 Sans base de données configurée, l'app se lance quand même : les écrans s'affichent,
> seules les données ne se chargent pas. Pratique pour travailler sur le design.

---

## 5. 🔧 Le guide des ajustements — « je veux changer… »

> **Règle d'or** : après CHAQUE modification, lance `pnpm typecheck` à la racine.
> Si c'est vert, tu n'as rien cassé structurellement. Si c'est rouge, le message
> indique le fichier et la ligne exacts du problème.

### 5.1 …un texte de l'app (ou corriger une traduction)

📁 `packages/i18n/src/locales/fr.json` (français) et `en.json` (anglais)

Exemple — changer le slogan de la remise en main propre :
```json
"handDeliveryOnly": "Remise en main propre uniquement — aucun envoi"
```
→ remplace la valeur, sauvegarde, l'app se recharge toute seule.
**Toujours modifier les DEUX fichiers** (fr + en) pour la même clé.

### 5.2 …les couleurs, le thème

📁 `apps/mobile-web/src/theme.ts`

```ts
accent: "#2DD4BF",      // la couleur turquoise principale → mets ce que tu veux
background: "#0B0F0E",  // le fond sombre
positive: "#34D399",    // vert des hausses de prix
negative: "#F87171",    // rouge des baisses
```
Tous les écrans utilisent ces variables : changer une valeur ici change TOUTE l'app
(web, iOS et Android d'un coup).

### 5.3 …un écran (déplacer une section, changer un titre…)

📁 `apps/mobile-web/app/(tabs)/` — un fichier par onglet (voir la carte du projet).

Les écrans sont composés de briques simples définies dans
`apps/mobile-web/src/components/ui.tsx` (`<Card>`, `<SectionTitle>`, `<Muted>`…).
Le plus simple : copier une `<Card>` existante et adapter son contenu.

### 5.4 …ajouter un jeu TCG, un set ou des cartes

📁 `packages/db/src/seed.ts` — suis le modèle existant :

```ts
const [onePiece] = await db.insert(games)
  .values({ slug: "one-piece", name: "One Piece Card Game" })
  .onConflictDoUpdate({ target: games.slug, set: { name: "One Piece Card Game" } })
  .returning();
```
Puis relance `pnpm db:seed`. (À terme, le catalogue sera importé automatiquement
depuis des sources officielles — Phase 3.)

### 5.5 …le montant des frais de service (le fameux 1 €)

- 📁 `.env` : `PLATFORM_FEE_EUR_CENTS=100` (100 centimes = 1 €). Mets `150` pour 1,50 €.
- Le champ `feeCents` de la table `transactions` (`packages/db/src/schema.ts`) a la
  même valeur par défaut (`default(100)`).

### 5.6 …le rayon de recherche par défaut (25 km actuellement)

- 📁 `packages/validators/src/index.ts` → `radiusKm: z.number()...default(25)`
  (et le maximum : `.max(500)`).
- 📁 `packages/db/src/schema.ts` → `searchRadiusKm` (profil) `default(25)`.

### 5.7 …ajouter une langue à l'application (ex. espagnol)

1. 📁 `packages/i18n/src/locales/` : dupliquer `en.json` → `es.json` et tout traduire.
2. 📁 `packages/i18n/src/index.ts` :
   - ajouter `es` dans `resources` et `supportedLanguages`;
   - ajouter le cas dans `normalizeLanguage` (`startsWith("es")`).
> ⚠️ Ne jamais tester une langue avec `language === "es"` strictement : les téléphones
> renvoient souvent `es-ES` ou `es-MX`. Toujours passer par `normalizeLanguage`.

### 5.8 …les langues de CARTES ou les états proposés

📁 `packages/db/src/schema.ts` → `cardLanguageEnum` / `cardConditionEnum`
📁 `packages/validators/src/index.ts` → les mêmes listes côté validation
📁 `packages/i18n/src/locales/*.json` → les libellés affichés (`listing.condition.*`)
Après modification du schéma : `pnpm db:generate` puis `pnpm db:migrate`.

### 5.9 …ajouter un champ à une annonce (exemple complet, la chaîne entière)

Mettons que tu veuilles un champ « édition limitée » (case à cocher) :

1. **Base** — `packages/db/src/schema.ts`, dans la table `listings` :
   ```ts
   isLimitedEdition: boolean("is_limited_edition").notNull().default(false),
   ```
2. **Migration** — `pnpm db:generate` puis `pnpm db:migrate`.
3. **Validation** — `packages/validators/src/index.ts`, dans `listingBase` :
   ```ts
   isLimitedEdition: z.boolean().default(false),
   ```
4. **Rien à faire côté API** : `listings.create` accepte automatiquement le champ validé.
5. **Écran** — afficher/saisir le champ dans l'app.
6. `pnpm typecheck` → vert = chaîne complète cohérente. C'est LA force du projet :
   impossible d'oublier une étape sans que TypeScript te le signale.

### 5.10 …la logique métier (offres, recherche, etc.)

📁 `packages/api/src/routers/` — un fichier par domaine, en français dans les messages
d'erreur. Exemples de règles déjà en place que tu peux ajuster :
- interdiction de faire une offre sur sa propre annonce (`offers.ts`);
- une annonce acceptée passe en `reserved` (`offers.ts`);
- le tri « le plus proche d'abord » (`listings.ts`, fonction `search`).

### 5.11 Ce qu'il ne faut PAS toucher sans en parler

- ⚠️ `packages/db/drizzle/` : fichiers générés — ne jamais éditer à la main.
- ⚠️ La **machine à états des transactions** (quand l'argent bouge) : toute la sécurité
  du séquestre en dépend. On la code en Phase 2 côté serveur uniquement.
- ⚠️ `pnpm-lock.yaml`, `.npmrc` : garantissent que tout le monde a les mêmes versions.
- ⚠️ Les coordonnées GPS exactes ne doivent **jamais** être exposées publiquement
  (le profil public les retire déjà — garder ce comportement).

---

## 6. ✅ Vérifier qu'on n'a rien cassé

```bash
pnpm typecheck    # vérifie TOUT le projet (app + serveur + briques partagées)
```

- **Vert** → structurellement sain.
- **Rouge** → lis le message : `fichier(ligne,colonne): explication`. Corrige, relance.

Pour tester « en vrai » : lance `pnpm server` + `pnpm web` et clique partout.

---

## 6bis. 🌐 La recette = la version web

La stratégie de mise en production : **le site web sert d'environnement de
recette** (tests réels entre nous), et les apps iOS/Android ne seront soumises
aux stores qu'au dernier moment, une fois tout validé sur le web.

- Un seul process Node sert l'API (`/trpc`) **et** le site web (`/`) — voir
  `deploy/VPS_SETUP.md` pour l'installation one-time sur le VPS.
- Ensuite, chaque push sur `main` déploie automatiquement la recette
  (workflow « Deploy recette web to VPS », mêmes secrets GitHub que Loqato).
- Vérification rapide après déploiement : `https://<domaine>/health` → `{"ok":true}`.
- Les cotes se mettent à jour toutes les 24 h (`PRICE_SYNC_INTERVAL_HOURS=24`).

## 7. 🚀 Enregistrer et publier ses modifications

### Sauvegarder son travail (Git en 4 commandes)

```bash
git status                          # voir ce qui a changé
git add -A                          # tout préparer
git commit -m "Change la couleur d'accent en violet"   # enregistrer avec un message clair
git push                            # envoyer sur GitHub
```

> Conseil : une modification = un commit. Petit et souvent, plutôt que gros et rare.

### Publier les vraies apps iOS / Android

Quand on voudra mettre l'app sur les stores (compte Apple Developer + Google Play requis) :
```bash
cd apps/mobile-web
npx eas build --platform ios
npx eas build --platform android
```
EAS (le service de build d'Expo) compile dans le cloud — pas besoin de Mac.
Le site web, lui, se génère avec `npx expo export --platform web` (dossier statique
à héberger n'importe où).

---

## 8. 🆘 Dépannage (les pannes classiques)

| Symptôme | Cause probable | Solution |
|---|---|---|
| `DATABASE_URL manquant` au lancement du serveur | `.env` absent ou vide | `cp .env.example .env` puis remplir (section 4) |
| L'app s'affiche mais aucune donnée | Le serveur (`pnpm server`) n'est pas lancé, ou pas de seed | lancer le serveur ; `pnpm db:seed` |
| `port 3001 already in use` | Un ancien serveur tourne encore | fermer l'autre terminal, ou changer `PORT` dans `.env` |
| L'app affiche d'anciens écrans | Cache du bundler | arrêter, relancer avec `pnpm web -- --clear` |
| `pnpm: command not found` | pnpm pas installé | `npm install -g pnpm` |
| Page blanche sur le web après une modif | Erreur JavaScript | ouvrir la console du navigateur (F12) : l'erreur y est affichée |
| Textes en anglais alors que le téléphone est en français | Cache de langue | vérifier `normalizeLanguage` — et ne jamais comparer `=== "fr"` |

---

## 9. 📚 Glossaire

- **Monorepo** : un seul dossier Git qui contient l'app, le serveur et les briques
  partagées. Tout avance ensemble, une seule version de la vérité.
- **TypeScript** : JavaScript + vérification des types. Si l'app attend un prix en
  centimes et qu'on lui envoie du texte, ça refuse de compiler au lieu de planter chez
  l'utilisateur.
- **Expo / React Native** : la techno qui transforme un code unique en app iPhone,
  Android et site web.
- **tRPC** : le « téléphone rouge » entre l'app et le serveur. Les deux partagent les
  mêmes définitions : impossible qu'ils se parlent mal.
- **PostgreSQL / Supabase** : la base de données (PostgreSQL) et l'hébergeur qui la
  fournit avec les comptes utilisateurs (Supabase).
- **Drizzle** : l'outil qui décrit les tables en TypeScript (`schema.ts`) et génère les
  **migrations**.
- **Migration** : un fichier SQL qui fait évoluer la base d'une version à la suivante
  (ajout d'une colonne, d'une table…). Versionné, rejouable, réversible.
- **Seed** : script qui remplit la base avec des données de démonstration.
- **Séquestre (escrow)** : l'argent de l'acheteur est bloqué par la plateforme et n'est
  versé au vendeur qu'après validation par les deux parties.
- **KYC** : vérification d'identité des vendeurs, exigée par la loi pour les paiements.
  Stripe s'en charge pour nous.
- **Zod (validators)** : les règles de validation des données (« un pseudo fait entre 3
  et 30 caractères ») — écrites une fois, appliquées côté app ET côté serveur.
- **i18n** : l'internationalisation — le système de traduction FR/EN de l'interface.
- **QR code de validation** : au rendez-vous, chaque partie scanne le code de l'autre ;
  les deux scans déclenchent le versement de l'argent.

---

## 10. 📌 Récap express (à imprimer)

```bash
# Installer (une fois)
git clone https://github.com/kaizen2025/Lbc.git && cd Lbc && pnpm install
cp .env.example .env    # puis remplir DATABASE_URL etc.
pnpm db:migrate && pnpm db:seed

# Travailler (à chaque fois)
pnpm server             # terminal 1 : l'API
pnpm web                # terminal 2 : l'app web (ou `pnpm app` pour le téléphone)

# Vérifier
pnpm typecheck

# Sauvegarder
git add -A && git commit -m "message clair" && git push
```

| Je veux changer… | Fichier |
|---|---|
| Un texte / une traduction | `packages/i18n/src/locales/fr.json` + `en.json` |
| Les couleurs | `apps/mobile-web/src/theme.ts` |
| Un écran | `apps/mobile-web/app/(tabs)/…` |
| Les jeux / cartes de démo | `packages/db/src/seed.ts` |
| Les frais (1 €) | `.env` → `PLATFORM_FEE_EUR_CENTS` |
| Les prix de l'abonnement PRO et les limites du gratuit | `packages/api/src/lib/plans.ts` |
| Le rayon de recherche | `packages/validators/src/index.ts` |
| Une règle métier | `packages/api/src/routers/…` |
| Les tables de la base | `packages/db/src/schema.ts` (+ `pnpm db:generate` + `pnpm db:migrate`) |
