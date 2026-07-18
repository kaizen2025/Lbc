import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Langue d'impression de la carte — donnée métier distincte de la langue de l'UI. */
export const cardLanguageEnum = pgEnum("card_language", [
  "en",
  "fr",
  "ja",
  "de",
  "it",
  "es",
  "pt",
  "zh",
  "ko",
]);

export const cardConditionEnum = pgEnum("card_condition", [
  "near_mint",
  "excellent",
  "good",
  "played",
  "poor",
]);

export const listingTypeEnum = pgEnum("listing_type", ["sale", "trade", "wanted"]);

export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "reserved",
  "completed",
  "cancelled",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "pending",
  "accepted",
  "declined",
  "countered",
  "withdrawn",
]);

/**
 * Machine à états d'une transaction séquestrée. Les transitions ne sont
 * autorisées QUE côté serveur (packages/api/src/services/transactions.ts).
 */
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending_payment",
  "escrowed",
  "meetup_scheduled",
  "completed",
  "disputed",
  "refunded",
  "cancelled",
]);

/** Marché de cotation : Europe (Cardmarket) vs international/US (eBay, TCGplayer). */
export const marketEnum = pgEnum("market", ["eu", "us"]);

export const currencyEnum = pgEnum("currency", ["EUR", "USD"]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "resolved_refund",
  "resolved_release",
]);

// ---------------------------------------------------------------------------
// Utilisateurs & profils
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  /** Aligné sur l'UID Supabase Auth. */
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    /** Ville affichée publiquement — jamais l'adresse exacte. */
    city: text("city"),
    countryCode: text("country_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    searchRadiusKm: integer("search_radius_km").notNull().default(25),
    /** Langues parlées par l'utilisateur (codes ISO). */
    spokenLanguages: text("spoken_languages").array().notNull().default(sql`'{}'::text[]`),
    ratingAvg: doublePrecision("rating_avg"),
    tradeCount: integer("trade_count").notNull().default(0),
    stripeAccountId: text("stripe_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_geo_idx").on(t.latitude, t.longitude)],
);

// ---------------------------------------------------------------------------
// Catalogue canonique (jeux → sets → cartes / produits scellés)
// ---------------------------------------------------------------------------

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
});

export const sets = pgTable(
  "sets",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    releaseDate: date("release_date"),
    cardCount: integer("card_count"),
  },
  (t) => [uniqueIndex("sets_game_code_uq").on(t.gameId, t.code)],
);

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    setId: integer("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    /** Numéro dans le set, ex. "303/298" (les showcase dépassent le set). */
    number: text("number").notNull(),
    name: text("name").notNull(),
    rarity: text("rarity"),
    imageUrl: text("image_url"),
  },
  (t) => [
    uniqueIndex("cards_set_number_uq").on(t.setId, t.number),
    index("cards_name_idx").on(t.name),
  ],
);

/** Produits scellés (boosters, displays, coffrets) — cotés et échangeables aussi. */
export const sealedProducts = pgTable(
  "sealed_products",
  {
    id: serial("id").primaryKey(),
    setId: integer("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // booster | display | case | box | deck
    imageUrl: text("image_url"),
  },
  (t) => [uniqueIndex("sealed_set_name_uq").on(t.setId, t.name)],
);

// ---------------------------------------------------------------------------
// Cote & historique de prix — par carte × langue × état × foil × marché
// ---------------------------------------------------------------------------

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id").references(() => cards.id, { onDelete: "cascade" }),
    sealedProductId: integer("sealed_product_id").references(() => sealedProducts.id, {
      onDelete: "cascade",
    }),
    cardLanguage: cardLanguageEnum("card_language"),
    condition: cardConditionEnum("condition"),
    isFoil: boolean("is_foil").notNull().default(false),
    /** eu = Cardmarket (EUR) · us = eBay ventes réalisées / TCGplayer (USD). */
    market: marketEnum("market").notNull(),
    currency: currencyEnum("currency").notNull(),
    priceCents: integer("price_cents").notNull(),
    recordedAt: date("recorded_at").notNull(),
    source: text("source").notNull(), // cardmarket | ebay_sold | tcgplayer | manual
  },
  (t) => [
    index("price_lookup_idx").on(
      t.cardId,
      t.cardLanguage,
      t.condition,
      t.isFoil,
      t.market,
      t.recordedAt,
    ),
    index("price_sealed_idx").on(t.sealedProductId, t.market, t.recordedAt),
  ],
);

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: integer("card_id").references(() => cards.id, { onDelete: "cascade" }),
    sealedProductId: integer("sealed_product_id").references(() => sealedProducts.id, {
      onDelete: "cascade",
    }),
    cardLanguage: cardLanguageEnum("card_language"),
    condition: cardConditionEnum("condition"),
    isFoil: boolean("is_foil").notNull().default(false),
    quantity: integer("quantity").notNull().default(1),
    forSale: boolean("for_sale").notNull().default(false),
    forTrade: boolean("for_trade").notNull().default(false),
    acquiredPriceCents: integer("acquired_price_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collection_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Annonces (vente / échange / recherche)
// ---------------------------------------------------------------------------

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: listingTypeEnum("type").notNull(),
    status: listingStatusEnum("status").notNull().default("active"),
    cardId: integer("card_id").references(() => cards.id),
    sealedProductId: integer("sealed_product_id").references(() => sealedProducts.id),
    cardLanguage: cardLanguageEnum("card_language"),
    condition: cardConditionEnum("condition"),
    isFoil: boolean("is_foil").notNull().default(false),
    quantity: integer("quantity").notNull().default(1),
    /** Prix demandé (ventes) ou budget max (recherches). Null pour un pur trade. */
    priceCents: integer("price_cents"),
    currency: currencyEnum("currency").notNull().default("EUR"),
    description: text("description"),
    /** URLs des photos réelles de la carte (Supabase Storage). */
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    /** Localisation copiée du profil à la création (ville + coordonnées approx.). */
    city: text("city"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listings_geo_idx").on(t.latitude, t.longitude),
    index("listings_card_idx").on(t.cardId, t.status),
    index("listings_seller_idx").on(t.sellerId),
  ],
);

// ---------------------------------------------------------------------------
// Offres & négociation
// ---------------------------------------------------------------------------

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: offerStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents"),
    /** Cartes proposées en échange (ids d'items de la collection de l'offreur). */
    tradeItemIds: jsonb("trade_item_ids").$type<string[]>().notNull().default([]),
    message: text("message"),
    parentOfferId: uuid("parent_offer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("offers_listing_idx").on(t.listingId, t.status)],
);

// ---------------------------------------------------------------------------
// Messagerie
// ---------------------------------------------------------------------------

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Transactions séquestrées & validation en main propre
// ---------------------------------------------------------------------------

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    offerId: uuid("offer_id").references(() => offers.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id),
    status: transactionStatusEnum("status").notNull().default("pending_payment"),
    /** Montant de la vente hors frais. 0 pour un trade sans argent. */
    amountCents: integer("amount_cents").notNull(),
    /** Frais de service plateforme (1 € par défaut). */
    feeCents: integer("fee_cents").notNull().default(100),
    currency: currencyEnum("currency").notNull().default("EUR"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    meetupAt: timestamp("meetup_at", { withTimezone: true }),
    meetupPlace: text("meetup_place"),
    escrowedAt: timestamp("escrowed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_buyer_idx").on(t.buyerId),
    index("transactions_seller_idx").on(t.sellerId),
  ],
);

/** Double validation au RDV : chaque partie scanne le QR de l'autre. */
export const tradeValidations = pgTable(
  "trade_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    qrToken: text("qr_token").notNull().unique(),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("validation_tx_user_uq").on(t.transactionId, t.userId)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    revieweeId: uuid("reviewee_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(), // 1..5, contrainte vérifiée côté validators
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_tx_reviewer_uq").on(t.transactionId, t.reviewerId)],
);

export const disputes = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  openedById: uuid("opened_by_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Alertes ("préviens-moi si cette carte apparaît à moins de X km / X €")
// ---------------------------------------------------------------------------

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: integer("card_id").references(() => cards.id, { onDelete: "cascade" }),
    sealedProductId: integer("sealed_product_id").references(() => sealedProducts.id, {
      onDelete: "cascade",
    }),
    cardLanguage: cardLanguageEnum("card_language"),
    maxPriceCents: integer("max_price_cents"),
    maxDistanceKm: integer("max_distance_km"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alerts_user_idx").on(t.userId, t.active)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  listings: many(listings),
  collectionItems: many(collectionItems),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const gamesRelations = relations(games, ({ many }) => ({ sets: many(sets) }));

export const setsRelations = relations(sets, ({ one, many }) => ({
  game: one(games, { fields: [sets.gameId], references: [games.id] }),
  cards: many(cards),
  sealedProducts: many(sealedProducts),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  set: one(sets, { fields: [cards.setId], references: [sets.id] }),
  prices: many(priceHistory),
}));

export const sealedProductsRelations = relations(sealedProducts, ({ one }) => ({
  set: one(sets, { fields: [sealedProducts.setId], references: [sets.id] }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  card: one(cards, { fields: [priceHistory.cardId], references: [cards.id] }),
  sealedProduct: one(sealedProducts, {
    fields: [priceHistory.sealedProductId],
    references: [sealedProducts.id],
  }),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  user: one(users, { fields: [collectionItems.userId], references: [users.id] }),
  card: one(cards, { fields: [collectionItems.cardId], references: [cards.id] }),
  sealedProduct: one(sealedProducts, {
    fields: [collectionItems.sealedProductId],
    references: [sealedProducts.id],
  }),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  card: one(cards, { fields: [listings.cardId], references: [cards.id] }),
  sealedProduct: one(sealedProducts, {
    fields: [listings.sealedProductId],
    references: [sealedProducts.id],
  }),
  offers: many(offers),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  listing: one(listings, { fields: [offers.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [offers.buyerId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  listing: one(listings, { fields: [conversations.listingId], references: [listings.id] }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  listing: one(listings, { fields: [transactions.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [transactions.buyerId], references: [users.id] }),
  seller: one(users, { fields: [transactions.sellerId], references: [users.id] }),
  validations: many(tradeValidations),
}));

export const tradeValidationsRelations = relations(tradeValidations, ({ one }) => ({
  transaction: one(transactions, {
    fields: [tradeValidations.transactionId],
    references: [transactions.id],
  }),
}));
