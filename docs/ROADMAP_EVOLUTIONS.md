# Audit d'évolution — juillet 2026

Où investir maintenant, classé par **impact produit / effort**, en trois
horizons : ce qui bloque l'ouverture de la recette à de vrais utilisateurs,
ce qui fait décoller l'usage, ce qui prépare l'échelle.

## État des lieux (acquis)

Parcours complet fonctionnel : compte → profil géolocalisé → annonce →
offre → chat → rendez-vous → double validation par code → réputation.
Portfolio avec cote EU/US par langue, paywall PRO, alertes, export CSV,
recherche par distance, FR/EN, un seul code pour web/iOS/Android, serveur
de recette unifié, CI, audit sécurité passé. **Le squelette est complet ;
ce qui suit est de la chair.**

---

## Horizon 1 — Avant d'inviter de vrais utilisateurs sur la recette

### 1.1 Photos d'annonces (❗ le manque le plus visible)
Le champ `photos` existe partout… mais aucune UI d'upload. Une marketplace
de cartes sans photo des cartes n'est pas crédible ; c'est aussi la base de
l'évaluation d'état en main propre.
**Faire** : `expo-image-picker` → upload Supabase Storage (bucket `listings`,
policies par user) → miniatures dans les cartes d'annonce et galerie sur la
fiche. *Effort : 1 jour. Impact : énorme.*

### 1.2 Graphique réel du portfolio et de la fiche carte
Les données de courbe existent (portfolioHistory, prices.history) mais rien
n'est tracé — or c'est LE wow-effect Collectr (captures de référence).
**Faire** : sparkline/aire en `react-native-svg` (léger, cross-platform),
courbe teal sur fond sombre, plage sélectionnée. Ajouter l'écran
**fiche carte** : cote EU vs US côte à côte, écart en %, historique, bouton
« qui la vend près de chez moi » (lien recherche) et « créer une alerte ».
*Effort : 1-2 jours. Impact : énorme (cœur du différenciateur).*

### 1.3 Paiement réel (Stripe) — débloque le business model
Tout est prêt côté données (machine à états, `pending_payment`, table
subscriptions par provider). Sans ça, seuls les trades 0 € fonctionnent.
**Faire** : (a) séquestre : PaymentIntent à `createFromOffer` (capture
manuelle), capture au double scan, refund à l'annulation ; webhook
`payment_intent.*` ; (b) abonnement PRO web : Stripe Checkout + customer
portal + webhooks → upsert `subscriptions`. IAP mobiles seulement au moment
des stores. **Prérequis : clés Stripe dans le coffre `integration_secrets`.**
*Effort : 2-3 jours. Impact : revenus.*

### 1.4 Notifications (la marketplace doit rappeler à toi)
Rien ne prévient : ni nouveau message, ni offre, ni alerte déclenchée.
**Faire** : push Expo (token par device, table `push_tokens`) + fallback
email via **Brevo (clé déjà dans le coffre)** pour : message reçu, offre
reçue/acceptée, alerte carte déclenchée (job quotidien qui matche
`alerts` × nouvelles annonces dans le rayon), rappel de RDV.
*Effort : 2 jours. Impact : rétention directe.*

### 1.5 Conformité minimale avant vrais utilisateurs (RGPD)
Manquent : **suppression de compte** (obligatoire), CGU/politique de
confidentialité (obligatoire dès qu'il y a séquestre d'argent), signalement
d'annonce/utilisateur + blocage.
**Faire** : `profile.deleteAccount` (cascade DB + suppression auth Supabase),
écrans CGU statiques, bouton signaler → table `reports` + revue manuelle.
*Effort : 1 jour. Impact : légalement bloquant sinon.*

### 1.6 Offres d'échange réelles
`tradeItemIds` est plombé côté serveur mais l'UI ne permet pas de proposer
des cartes de sa collection dans une offre (et le flux contre-offre existe
en base sans UI).
**Faire** : sélecteur multi-cartes de sa collection dans le formulaire
d'offre + affichage des cartes proposées côté vendeur + contre-offre.
*Effort : 1-2 jours. Impact : c'est la moitié « trade » du concept.*

---

## Horizon 2 — Croissance de l'usage

### 2.1 Catalogue complet auto-importé (le plafond de verre actuel)
7 cartes en base : on ne peut rien vendre d'autre. Chaque jeu a une source :
- Pokémon : pokemontcg.io (API gratuite, images incluses)
- Magic : Scryfall (bulk data JSON quotidien, gratuit)
- Riftbound/Lorcana/One Piece : imports communautaires/CSV
**Faire** : `CatalogProvider` par jeu + job d'import idempotent (upsert par
set+numéro) + images. C'est aussi ce qui rend le **scan** utile ensuite.
*Effort : 2-3 jours. Impact : débloque tout le reste.*

### 2.2 Cotes réelles (remplacer le provider "manual")
L'interface `PriceProvider` est prête. Options par ordre de faisabilité :
Cardmarket API (candidature nécessaire), TCGplayer API, eBay ventes
réalisées (Browse API). Commencer par UN jeu et UN marché fiable.
*Effort : 2 jours par source. Impact : crédibilité du portfolio.*

### 2.3 Scan de carte (Phase 4 de la spec — différenciateur de Jimmy)
Caméra Expo + Ximilar Card Identification (ou équivalent) derrière
`CardRecognitionProvider`, fallback recherche manuelle. Nécessite le
catalogue complet (2.1) pour matcher.
*Effort : 2-3 jours + coût API. Impact : magique en démo, viral.*

### 2.4 Boucles de rétention/acquisition
- **Matching wishlist** : « quelqu'un près de toi vend une carte de ta
  recherche » (croisement alerts/wanted × nouvelles annonces) — déjà à
  moitié couvert par 1.4.
- **Partage** : deep links `cardtrade://listing/x` + Open Graph sur le web
  (image de la carte, prix) pour les partages WhatsApp/Discord.
- **SEO web** : pages carte/annonce indexables (Expo Router rend le statique),
  sitemap — le web-recette devient canal d'acquisition gratuit.
- **Parrainage** (plus tard) : code parrain → 1er trade sans frais.

### 2.5 Internationalisation élargie
« Ça pourrait mieux marcher ailleurs qu'en France » (Jimmy) : ES/DE/IT sont
à ~1 h chacune vu l'architecture (fichier de locale + `normalizeLanguage`).
Prioriser l'Allemagne (plus gros marché TCG d'Europe, patrie de Cardmarket).

---

## Horizon 3 — Échelle & robustesse

- **Chat temps réel** : remplacer le polling 5 s par Supabase Realtime
  (broadcast par conversation) — trivial vu l'infra déjà Supabase.
- **PostGIS** : passer la recherche haversine sur index géographique quand
  les annonces se comptent en dizaines de milliers.
- **Tests** : unitaires sur la machine à états des transactions et les
  quotas PRO (les deux endroits qui coûtent cher en cas de régression),
  Playwright sur le parcours web complet.
- **Observabilité** : Sentry (app + serveur) + alertes Telegram (bot déjà
  dans le coffre) sur erreurs serveur et échecs de déploiement.
- **Infra** : projet Supabase dédié (sortir du schéma partagé New-Life),
  rate limiting Redis si multi-process, sauvegardes vérifiées.
- **Stores** : builds EAS + review guidelines (Apple exige l'IAP pour le PRO,
  compte Google Play à créer) — au dernier moment, comme convenu.

---

## Ordre recommandé (résumé exécutif)

| # | Évolution | Effort | Impact |
|---|---|---|---|
| 1 | Photos d'annonces | 1 j | ⭐⭐⭐⭐⭐ |
| 2 | Graphiques + fiche carte EU/US | 1-2 j | ⭐⭐⭐⭐⭐ |
| 3 | Catalogue auto-importé (Pokémon d'abord) | 2-3 j | ⭐⭐⭐⭐⭐ |
| 4 | Notifications push + email (Brevo) | 2 j | ⭐⭐⭐⭐ |
| 5 | RGPD : suppression compte, CGU, signalement | 1 j | ⭐⭐⭐⭐ (bloquant légal) |
| 6 | Stripe (séquestre + PRO web) | 2-3 j | ⭐⭐⭐⭐ (revenus) |
| 7 | Offres d'échange UI + contre-offres | 1-2 j | ⭐⭐⭐⭐ |
| 8 | Cotes réelles (1 source) | 2 j | ⭐⭐⭐ |
| 9 | Scan de carte | 2-3 j | ⭐⭐⭐ |
| 10 | Realtime, SEO, langues, tests | continu | ⭐⭐⭐ |

Avec les points 1-5, la recette est **montrable et testable par de vrais
collectionneurs** ; avec 6-7, elle est **vendable**.
