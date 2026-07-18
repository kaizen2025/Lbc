import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { listings, offers } from "@cardtrade/db";
import { createOfferSchema, respondOfferSchema } from "@cardtrade/validators";
import { protectedProcedure, router } from "../trpc.js";

export const offersRouter = router({
  create: protectedProcedure.input(createOfferSchema).mutation(async ({ ctx, input }) => {
    const listing = await ctx.db.query.listings.findFirst({
      where: eq(listings.id, input.listingId),
    });
    if (!listing || listing.status !== "active") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Annonce indisponible" });
    }
    if (listing.sellerId === ctx.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Impossible de faire une offre sur sa propre annonce",
      });
    }
    const [created] = await ctx.db
      .insert(offers)
      .values({ ...input, buyerId: ctx.user.id })
      .returning();
    return created;
  }),

  /** Accepter/refuser — réservé au vendeur de l'annonce. */
  respond: protectedProcedure
    .input(respondOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.db.query.offers.findFirst({
        where: eq(offers.id, input.offerId),
        with: { listing: true },
      });
      if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
      if (offer.listing.sellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (offer.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Offre déjà traitée" });
      }
      const status = input.action === "accept" ? "accepted" : "declined";
      const [updated] = await ctx.db
        .update(offers)
        .set({ status })
        .where(eq(offers.id, input.offerId))
        .returning();
      if (status === "accepted") {
        await ctx.db
          .update(listings)
          .set({ status: "reserved", updatedAt: new Date() })
          .where(eq(listings.id, offer.listingId));
        // Phase 2 : créer ici la transaction séquestrée (Stripe PaymentIntent).
      }
      return updated;
    }),

  forListing: protectedProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const listing = await ctx.db.query.listings.findFirst({
        where: eq(listings.id, input.listingId),
      });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      const isSeller = listing.sellerId === ctx.user.id;
      return ctx.db.query.offers.findMany({
        where: isSeller
          ? eq(offers.listingId, input.listingId)
          : and(eq(offers.listingId, input.listingId), eq(offers.buyerId, ctx.user.id)),
        with: { buyer: { with: { profile: true } } },
        orderBy: desc(offers.createdAt),
      });
    }),

  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.offers.findMany({
      where: eq(offers.buyerId, ctx.user.id),
      with: { listing: { with: { card: true, sealedProduct: true } } },
      orderBy: desc(offers.createdAt),
    }),
  ),
});
