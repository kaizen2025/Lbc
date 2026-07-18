import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { cards, listings, profiles, sealedProducts } from "@cardtrade/db";
import {
  createListingSchema,
  searchListingsSchema,
  updateListingSchema,
} from "@cardtrade/validators";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
import { distanceKmSql } from "../lib/geo.js";
import { publicUserWith } from "../lib/publicProfile.js";

/** Arrondi ~1 km : jamais les coordonnées exactes du domicile sur une annonce. */
function fuzzCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Retire les coordonnées d'une ligne annonce avant de la renvoyer au client. */
function stripCoords<T extends { latitude: number | null; longitude: number | null }>(
  listing: T,
): Omit<T, "latitude" | "longitude"> {
  const { latitude: _lat, longitude: _lng, ...safe } = listing;
  return safe;
}

export const listingsRouter = router({
  create: protectedProcedure
    .input(createListingSchema)
    .mutation(async ({ ctx, input }) => {
      // La localisation de l'annonce est copiée du profil : ville + coordonnées
      // approximatives, jamais d'adresse exacte.
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      if (!profile?.latitude || !profile.longitude) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Renseigne ta ville dans ton profil avant de déposer une annonce",
        });
      }
      const [created] = await ctx.db
        .insert(listings)
        .values({
          ...input,
          sellerId: ctx.user.id,
          city: profile.city,
          latitude: fuzzCoordinate(profile.latitude),
          longitude: fuzzCoordinate(profile.longitude),
        })
        .returning();
      return created ? stripCoords(created) : created;
    }),

  update: protectedProcedure
    .input(updateListingSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      if (patch.cardId != null && patch.sealedProductId != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Une annonce référence soit une carte, soit un produit scellé",
        });
      }
      // Anti bait-and-switch : une annonce réservée/terminée ne se modifie plus
      // (le vendeur ne peut ni changer la carte ni la repasser en active).
      const [updated] = await ctx.db
        .update(listings)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(listings.id, id),
            eq(listings.sellerId, ctx.user.id),
            eq(listings.status, "active"),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Annonce introuvable ou plus modifiable",
        });
      }
      return stripCoords(updated);
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const listing = await ctx.db.query.listings.findFirst({
        where: eq(listings.id, input.id),
        with: {
          card: { with: { set: { with: { game: true } } } },
          sealedProduct: true,
          seller: publicUserWith,
        },
      });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      return stripCoords(listing);
    }),

  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.listings.findMany({
      where: eq(listings.sellerId, ctx.user.id),
      with: { card: true, sealedProduct: true },
      orderBy: desc(listings.createdAt),
    }),
  ),

  /**
   * Recherche géolocalisée : filtre par rayon (haversine SQL) et trie par
   * distance croissante — "la personne la plus proche de chez toi" d'abord.
   */
  search: publicProcedure.input(searchListingsSchema).query(async ({ ctx, input }) => {
    let { latitude, longitude } = input;
    if ((latitude == null || longitude == null) && ctx.user) {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      latitude = profile?.latitude ?? undefined;
      longitude = profile?.longitude ?? undefined;
    }

    const filters = [eq(listings.status, "active")];
    if (input.type) filters.push(eq(listings.type, input.type));
    if (input.cardId) filters.push(eq(listings.cardId, input.cardId));
    if (input.cardLanguage) filters.push(eq(listings.cardLanguage, input.cardLanguage));
    if (input.condition) filters.push(eq(listings.condition, input.condition));
    if (input.minPriceCents != null)
      filters.push(gte(listings.priceCents, input.minPriceCents));
    if (input.maxPriceCents != null)
      filters.push(lte(listings.priceCents, input.maxPriceCents));
    if (input.query) {
      filters.push(
        sql`(${listings.cardId} in (select id from ${cards} where name ilike ${"%" + input.query + "%"})
          or ${listings.sealedProductId} in (select id from ${sealedProducts} where name ilike ${"%" + input.query + "%"}))`,
      );
    }

    const hasGeo = latitude != null && longitude != null;
    const distance = hasGeo ? distanceKmSql(latitude!, longitude!) : sql<number>`0`;
    if (hasGeo) filters.push(sql`${distance} <= ${input.radiusKm}`);

    const rows = await ctx.db
      .select({
        listing: listings,
        distanceKm: distance,
      })
      .from(listings)
      .where(and(...filters))
      .orderBy(hasGeo ? sql`${distance} asc` : desc(listings.createdAt))
      .offset(input.cursor)
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    return {
      items: rows.slice(0, input.limit).map(({ listing, distanceKm }) => ({
        listing: stripCoords(listing),
        distanceKm,
      })),
      nextCursor: hasMore ? input.cursor + input.limit : null,
    };
  }),
});
