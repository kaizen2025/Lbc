# PROMPT AGENT FABLE 5 — Application « CardTrade » (nom provisoire)
## Marketplace locale de cartes TCG : Web + iOS + Android avec UN SEUL code

---

## 🎯 CONTEXTE & VISION

Construis une application complète de type **« Leboncoin des cartes à collectionner (TCG) »** :
une marketplace de proximité où les collectionneurs achètent, vendent et échangent leurs cartes
(Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana, Riftbound/League of Legends, etc.)
**exclusivement en remise en main propre** — aucun envoi postal.

Le modèle économique : la plateforme **séquestre l'argent** de l'acheteur au moment de l'accord,
prélève **1 € de frais de service par transaction**, et ne libère les fonds au vendeur
**qu'après validation du trade en main propre par les deux parties** (double confirmation + QR code).

L'app est **internationale et multilingue** (FR + EN au lancement, architecture prête pour plus),
mais les échanges sont **locaux** : le moteur de recherche indique toujours la personne
**la plus proche de chez toi** qui possède ou recherche la carte.

En plus de la marketplace, chaque utilisateur dispose d'un **portfolio de collection**
(comme l'app Collectr) : valeur totale, cote par carte, graphiques d'évolution, avec des prix
**différenciés par langue d'impression de la carte** (une carte EN ne cote pas comme une FR)
**ET par marché** : la cote européenne (référence Cardmarket) et la cote internationale/US
(référence eBay ventes réalisées / TCGplayer) sont très différentes — à cause des frais
d'envoi et de douane, la cote US est souvent nettement plus haute qu'en Europe sur beaucoup
de cartes. L'app doit afficher les deux.

**Positionnement vs Collectr (l'app de référence visuelle)** : Collectr fait très bien le
portfolio/cote, mais **n'a pas la recherche locale pour acheter ou trader près de chez soi**
(uniquement de l'achat en ligne). C'est exactement notre différenciateur : portfolio + cote
AU SERVICE d'une marketplace de proximité en main propre.

---

## 💰 MONÉTISATION — frais de transaction + CardTrade PRO

Deux sources de revenus complémentaires :

1. **1 € de frais de service** par transaction sécurisée (séquestre) — inchangé.
2. **Abonnement CardTrade PRO** (positionné 5 € sous Collectr PRO à prestations égales) :
   - **Mensuel : 7,99 €/mois**
   - **Annuel : 54,99 €/an** (soit 4,58 €/mois, badge « Économise 43 % », option
     mise en avant et présélectionnée sur le paywall)

### Répartition Gratuit vs PRO

| Fonctionnalité | Gratuit | PRO |
|---|---|---|
| Annonces, recherche locale, messagerie, transactions sécurisées | ✅ illimité | ✅ |
| Collection / portfolio | ✅ jusqu'à 250 items | ✅ illimité |
| Cote **Europe** du jour + graphique 1J/7J/1M/3M | ✅ | ✅ |
| Graphiques **6M / MAX** (historique complet) | — | ✅ |
| Cote **US/internationale** + **écart EU/US** (arbitrage) | — | ✅ |
| Suivi **P&L** (gains réalisés / latents vs prix d'achat) | — | ✅ |
| Alertes de prix / de disponibilité | 1 alerte | ✅ illimitées |
| Filtres avancés + historique de recherche | — | ✅ |
| Export CSV de la collection | — | ✅ |
| Scans de cartes (Phase 4) | 10/mois | ✅ illimités |
| Récap hebdo de performance (notification) | — | ✅ |
| Thèmes exclusifs + badge profil vérifié | — | ✅ |

Le paywall liste les avantages (icônes + titre + sous-titre), montre les deux cartes
de prix côte à côte (l'annuelle sélectionnée par défaut avec le badge d'économie) et
un CTA unique « Rejoindre CardTrade PRO ». Paiement : Stripe Billing sur le web,
In-App Purchase Apple/Google sur mobile (obligatoire pour les stores) — même table
`subscriptions` côté serveur, le champ `provider` distingue la source.

---

## ⚙️ CONTRAINTE TECHNIQUE N°1 — UN SEUL LANGAGE, UN SEUL CODE

**Interdiction de développer deux fois.** Tout le produit — Web, iOS, Android, backend —
est écrit en **TypeScript** dans un **monorepo unique** :

```
cardtrade/
├── apps/
│   ├── mobile-web/        # Expo (React Native) → iOS + Android + Web (react-native-web)
│   │                      # Expo Router pour la navigation (fichiers = routes, web + natif)
│   └── server/            # API tRPC (Node) 
├── packages/
│   ├── api/               # Routers tRPC + logique métier (importé par server ET par le client)
│   ├── db/                # Schéma Drizzle ORM + migrations (PostgreSQL / Supabase)
│   ├── validators/        # Schémas Zod partagés (front + back valident avec le même code)
│   ├── i18n/              # Fichiers de traduction FR/EN + helpers (i18next)
│   └── ui/                # Composants UI cross-platform (React Native + react-native-web)
├── turbo.json             # Turborepo
└── pnpm-workspace.yaml    # pnpm workspaces
```

- **Framework client : Expo SDK 52+ (React Native) avec Expo Router.**
  Une seule base de code rend : app iOS native, app Android native, et site web
  (react-native-web, rendu statique/SSR via Expo Router). C'est LA réponse au besoin
  « un langage commun pour ne pas développer deux fois ».
- **Backend : tRPC + Drizzle ORM + PostgreSQL (Supabase)** — typage bout-en-bout :
  les types des routers sont importés côté client, zéro duplication de contrats d'API.
- **Auth : Supabase Auth** (email + Apple + Google — Apple obligatoire pour l'App Store).
- **State/data : TanStack Query** (intégré au client tRPC).
- **UI : composants React Native stylés cross-platform** (NativeWind ou Tamagui — choisis
  et justifie, critère : rendu web ET natif impeccable, thème sombre par défaut comme les
  maquettes Collectr).
- **Paiement séquestré : Stripe Connect** (charges avec `transfer_data` différé / capture
  manuelle) : l'argent est capturé à l'accord, conservé par la plateforme, transféré au
  vendeur à la double validation, remboursé si le trade est annulé. Frais plateforme : 1 €.
  KYC vendeur géré par Stripe (Connected Accounts Express).
- **Géolocalisation : PostGIS** (extension Supabase) — recherche par rayon, tri par distance.
  Ne jamais exposer l'adresse exacte : ville + distance approximative uniquement.
- **i18n : i18next** — ne JAMAIS comparer `language === 'fr'` strictement (i18next peut
  renvoyer `fr-FR`) : toujours des helpers tolérants type `startsWith`.
- **Notifications push : Expo Notifications** (messages, offres, baisses/hausses de cote).

---

## 📱 FONCTIONNALITÉS

### F1 — Comptes & profils
- Inscription/connexion (email, Apple, Google). Profil : pseudo, avatar, **ville/région**
  (géolocalisée ou saisie), langues parlées, jeux TCG suivis.
- Réputation : note /5 + nombre de trades validés + badges (vendeur vérifié Stripe).

### F2 — Annonces (le « Leboncoin » des cartes)
- Créer une annonce : **vente**, **échange (trade)** ou **recherche** d'une carte ou d'un
  produit scellé (booster, display, coffret).
- Champs : jeu TCG, extension/set, numéro de carte, **langue de la carte**, état
  (Near Mint / Excellent / Good / Played / Poor), foil/holo, photos, prix demandé ou
  cartes acceptées en échange, quantité.
- Catalogue de cartes pré-rempli par jeu (base de données de référence des sets/cartes)
  pour que l'annonce soit liée à une carte canonique → indispensable pour la cote.
- Filtres : jeu, extension, état, langue, prix, **distance** (rayon 5/10/25/50/100 km), type
  (vente/trade/recherche).

### F3 — Moteur de recherche géolocalisé
- Rechercher une carte → résultats triés par **proximité** : « Jimmy à 3 km propose cette
  carte en NM à 45 € ».
- Recherche inversée : « qui recherche mes cartes près de chez moi ? » (matching
  annonces de recherche ↔ collections/annonces de vente).
- Alertes : « préviens-moi si quelqu'un met en vente cette carte à moins de X km / X € ».

### F4 — Messagerie & négociation
- Chat intégré par annonce (temps réel, Supabase Realtime).
- Faire une **offre** (prix ou proposition de trade multi-cartes) → accepter / refuser /
  contre-offre.

### F5 — Transaction sécurisée en main propre (cœur du business)
1. Accord conclu → l'acheteur paie dans l'app (Stripe) : montant + **1 € de frais**.
2. L'argent est **séquestré** par la plateforme. Les deux parties conviennent d'un lieu de RDV.
3. Au RDV : l'acheteur inspecte les cartes, puis chacun **valide** (scan d'un QR code généré
   dans l'app de l'autre + confirmation). 
4. Double validation → les fonds sont transférés au vendeur (moins les frais).
   Annulation/litige → remboursement acheteur, système de litige simple (v1 : formulaire +
   gel de la transaction, arbitrage admin).
- Pour un **trade sans argent**, même flux de double validation QR (sans paiement) pour
  alimenter la réputation.

### F6 — Portfolio de collection (référence visuelle : Collectr, thème sombre)
- Page « Ma collection » : ajouter ses cartes (recherche catalogue ou scan), quantité, état,
  langue, foil.
- **Valeur totale du portfolio** en grand, variation sur 30 jours, **graphique d'évolution**
  (1J / 7J / 1M / 3M / 6M / MAX).
- Liste « Most Valuable », tri par variation de prix (High to Low), badge de hausse/baisse
  par carte (ex. ▲ €363,16 / +54 %).
- **Cote par carte × langue d'impression × marché** : historique de prix stocké en base
  (table `price_history`), alimenté par un job quotidien via une interface `PriceProvider`
  avec plusieurs implémentations :
  - **Marché Europe** : Cardmarket (API si accessible, sinon source configurable) — cote en €.
  - **Marché international/US** : eBay ventes réalisées (« sold listings ») et/ou TCGplayer —
    cote en $. 
  - Affichage : cote EU et cote internationale côte à côte sur la fiche carte, avec
    conversion de devise et **écart EU vs US en %** (opportunité d'arbitrage visible).
  - Sélecteur de devise globale (EUR par défaut, USD disponible) comme sur la maquette.
- Marquer des cartes de sa collection comme « à vendre » / « à trader » → génère l'annonce.
- Export CSV de la collection.

### F7 — Scan de carte (différenciateur)
- **Scan de reconnaissance** : prendre la carte en photo → identification automatique
  (jeu, set, numéro, langue) pour créer l'annonce ou l'ajouter à la collection en 2 secondes.
  Implémentation : caméra Expo + API de reconnaissance spécialisée TCG (ex. Ximilar Card
  Identification) derrière une interface `CardRecognitionProvider` (fallback : recherche
  manuelle). 
- **Scan d'état (v2)** : photos recto/verso guidées → pré-évaluation de l'état
  (défauts visibles ou non). En v1 : simple assistant de photos guidées (coins, tranches,
  surface) joint à l'annonce ; l'analyse automatique viendra ensuite.

### F8 — Multi-langue
- UI complète FR + EN (i18next, fichiers dans `packages/i18n`), formats de dates/monnaies
  localisés, devise affichée selon la région (€ par défaut).
- La **langue de la carte** est une donnée métier distincte de la langue de l'UI.

### F9 — Navigation (mobile ET web, mêmes écrans)
Onglets : **Accueil** (feed local : annonces proches, market movers, « Just For You ») ·
**Recherche** · **Vendre/Scanner** (bouton central) · **Messages** · **Portfolio** · Profil.

---

## 🗄️ SCHÉMA DE DONNÉES (Drizzle — à affiner)
`users`, `profiles` (geo point, ville, rayon), `games` (TCG), `sets`, `cards` (catalogue
canonique, unique par set+numéro), `card_prices` / `price_history` (par carte × langue ×
état × foil × **marché** [eu|us] × devise), `collections` / `collection_items`, `listings` (type vente/trade/recherche,
statut), `offers`, `conversations` / `messages`, `transactions` (statut : pending_payment,
escrowed, meetup_scheduled, completed, disputed, refunded), `trade_validations` (QR),
`reviews`, `alerts`, `disputes`.

---

## 🔒 SÉCURITÉ & CONFORMITÉ
- Jamais d'adresse exacte publique ; RDV conseillés en lieux publics (message in-app).
- RGPD : consentement géoloc, suppression de compte, minimisation des données.
- Stripe gère le KYC et la conformité des fonds séquestrés (ne jamais stocker de données carte).
- Modération : signalement d'annonces/utilisateurs, blocage, rate limiting sur la messagerie.
- Row Level Security Supabase sur toutes les tables sensibles.

---

## 🚀 PLAN DE LIVRAISON (dans l'ordre, chaque phase livrée fonctionnelle et testée)

**Phase 1 — Socle (MVP marketplace)**
Monorepo + CI, auth, profils géolocalisés, catalogue cartes (2 jeux pour commencer :
Pokémon + Riftbound), annonces CRUD avec photos, recherche géolocalisée + filtres,
messagerie temps réel, i18n FR/EN, web + iOS + Android qui buildent depuis le même code.

**Phase 2 — Paiement séquestré**
Stripe Connect (onboarding vendeur, paiement, séquestre, 1 € de frais), flux RDV + double
validation QR, remboursements, litiges v1, réputation/avis.

**Phase 3 — Portfolio & cote**
Collection, PriceProvider + job quotidien de prix, price_history par langue/état/**marché
(cote EU Cardmarket + cote internationale eBay-TCGplayer, écart en %)**, graphiques
d'évolution (portfolio + carte), Most Valuable, tri par variation, sélecteur de devise
EUR/USD, export CSV, alertes de prix.

**Phase 4 — Scan & croissance**
Scan de reconnaissance de carte, assistant photos d'état, matching automatique
(« quelqu'un près de toi vend une carte de ta wishlist »), notifications push, feed social.

---

## ✅ EXIGENCES DE QUALITÉ
- TypeScript strict partout, zéro `any` non justifié.
- Validation Zod partagée front/back (`packages/validators`).
- Tests : unitaires sur la logique métier (offres, machine à états des transactions,
  calculs de cote) + tests E2E du flux transaction (Maestro ou Playwright pour le web).
- La machine à états `transactions` doit être impossible à contourner (transitions
  vérifiées côté serveur uniquement).
- Thème sombre par défaut (référence visuelle Collectr), thème clair disponible.
- Accessibilité de base (labels, contrastes) et performances mobiles (listes virtualisées
  FlashList pour les collections de milliers de cartes).
- Documente dans le README : lancer le web (`expo start --web`), builder iOS/Android
  (EAS Build), déployer le serveur, lancer les migrations.

**Commence par la Phase 1. Avant de coder, produis : (1) le schéma Drizzle complet,
(2) la liste des routers tRPC avec leurs procédures, (3) l'arborescence des écrans
Expo Router — puis implémente.**
