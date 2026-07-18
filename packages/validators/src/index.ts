import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums métier — miroir des enums PostgreSQL de @cardtrade/db
// ---------------------------------------------------------------------------

export const cardLanguageSchema = z.enum([
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
export type CardLanguage = z.infer<typeof cardLanguageSchema>;

export const cardConditionSchema = z.enum([
  "near_mint",
  "excellent",
  "good",
  "played",
  "poor",
]);
export type CardCondition = z.infer<typeof cardConditionSchema>;

export const listingTypeSchema = z.enum(["sale", "trade", "wanted"]);
export type ListingType = z.infer<typeof listingTypeSchema>;

export const marketSchema = z.enum(["eu", "us"]);
export type Market = z.infer<typeof marketSchema>;

export const currencySchema = z.enum(["EUR", "USD"]);
export type Currency = z.infer<typeof currencySchema>;

// ---------------------------------------------------------------------------
// Profils
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Caractères autorisés : lettres, chiffres, _ . -")
    .optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  countryCode: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  searchRadiusKm: z.number().int().min(1).max(500).optional(),
  spokenLanguages: z.array(z.string().min(2).max(5)).max(10).optional(),
  avatarUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

const listingBase = z.object({
  type: listingTypeSchema,
  cardId: z.number().int().positive().optional(),
  sealedProductId: z.number().int().positive().optional(),
  cardLanguage: cardLanguageSchema.optional(),
  condition: cardConditionSchema.optional(),
  isFoil: z.boolean().default(false),
  quantity: z.number().int().min(1).max(999).default(1),
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  currency: currencySchema.default("EUR"),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(10).default([]),
});

export const createListingSchema = listingBase.refine(
  (v) => (v.cardId != null) !== (v.sealedProductId != null),
  { message: "Une annonce référence soit une carte, soit un produit scellé (exactement un des deux)" },
);

export const updateListingSchema = listingBase.partial().extend({
  id: z.string().uuid(),
  status: z.enum(["active", "cancelled"]).optional(),
});

export const searchListingsSchema = z.object({
  query: z.string().max(200).optional(),
  gameId: z.number().int().positive().optional(),
  setId: z.number().int().positive().optional(),
  cardId: z.number().int().positive().optional(),
  type: listingTypeSchema.optional(),
  cardLanguage: cardLanguageSchema.optional(),
  condition: cardConditionSchema.optional(),
  minPriceCents: z.number().int().min(0).optional(),
  maxPriceCents: z.number().int().min(0).optional(),
  /** Centre de recherche — par défaut la position du profil. */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().int().min(1).max(500).default(25),
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(20),
});

// ---------------------------------------------------------------------------
// Offres
// ---------------------------------------------------------------------------

export const createOfferSchema = z
  .object({
    listingId: z.string().uuid(),
    amountCents: z.number().int().min(0).max(10_000_000).optional(),
    tradeItemIds: z.array(z.string().uuid()).max(50).default([]),
    message: z.string().max(1000).optional(),
    parentOfferId: z.string().uuid().optional(),
  })
  .refine((v) => v.amountCents != null || v.tradeItemIds.length > 0, {
    message: "Une offre contient un montant, des cartes en échange, ou les deux",
  });

export const respondOfferSchema = z.object({
  offerId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

// ---------------------------------------------------------------------------
// Messagerie
// ---------------------------------------------------------------------------

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  /** Pour démarrer une conversation depuis une annonce. */
  listingId: z.string().uuid().optional(),
  body: z.string().min(1).max(4000),
});

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export const addCollectionItemSchema = z
  .object({
    cardId: z.number().int().positive().optional(),
    sealedProductId: z.number().int().positive().optional(),
    cardLanguage: cardLanguageSchema.optional(),
    condition: cardConditionSchema.optional(),
    isFoil: z.boolean().default(false),
    quantity: z.number().int().min(1).max(9999).default(1),
    forSale: z.boolean().default(false),
    forTrade: z.boolean().default(false),
    acquiredPriceCents: z.number().int().min(0).optional(),
  })
  .refine((v) => (v.cardId != null) !== (v.sealedProductId != null), {
    message: "Un item référence soit une carte, soit un produit scellé",
  });

export const portfolioHistorySchema = z.object({
  range: z.enum(["1d", "7d", "1m", "3m", "6m", "max"]).default("1m"),
  market: marketSchema.default("eu"),
});

// ---------------------------------------------------------------------------
// Cote
// ---------------------------------------------------------------------------

export const cardPriceQuerySchema = z.object({
  cardId: z.number().int().positive().optional(),
  sealedProductId: z.number().int().positive().optional(),
  cardLanguage: cardLanguageSchema.optional(),
  condition: cardConditionSchema.optional(),
  isFoil: z.boolean().optional(),
  range: z.enum(["1d", "7d", "1m", "3m", "6m", "max"]).default("1m"),
});

// ---------------------------------------------------------------------------
// Avis
// ---------------------------------------------------------------------------

export const createReviewSchema = z.object({
  transactionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
