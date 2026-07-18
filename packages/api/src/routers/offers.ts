import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { collectionItems, listings, offers } from "@cardtrade/db";
import { createOfferSchema, respondOfferSchema } from "@cardtrade/validators";
import { protectedProcedure, router } from "../trpc.js";
import { publicUserWith } from "../lib/publicProfile.js";
import { notifyUser } from "../lib/notify.js";

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
    // Les items proposés en échange doivent appartenir à l'offreur.
    if (input.tradeItemIds.length > 0) {
      const owned = await ctx.db
        .select({ id: collectionItems.id })
        .from(collectionItems)
        .where(
          and(
            inArray(collectionItems.id, input.tradeItemIds),
            eq(collectionItems.userId, ctx.user.id),
          ),
        );
      if (owned.length !== input.tradeItemIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Certains items proposés n'appartiennent pas à ta collection",
        });
      }
    }
    // Une contre-offre référence une offre de la même annonce.
    if (input.parentOfferId) {
      const parent = await ctx.db.query.offers.findFirst({
        where: eq(offers.id, input.parentOfferId),
      });
      if (!parent || parent.listingId !== input.listingId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Offre parente invalide" });
      }
    }
    const [created] = await ctx.db
      .insert(offers)
      .values({ ...input, buyerId: ctx.user.id })
      .returning();
    notifyUser(ctx.db, listing.sellerId, {
      title: "CardTrade — nouvelle offre",
      body: input.amountCents
        ? `Offre de ${(input.amountCents / 100).toFixed(2)} € reçue sur ton annonce`
        : "Proposition d'échange reçue sur ton annonce",
      data: { listingId: listing.id },
    });
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
      // Anti double-vente : on ne peut accepter que sur une annonce active.
      if (input.action === "accept" && offer.listing.status !== "active") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Annonce déjà réservée ou clôturée",
        });
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
        // Les autres offres en attente sont refusées automatiquement.
        await ctx.db
          .update(offers)
          .set({ status: "declined" })
          .where(
            and(
              eq(offers.listingId, offer.listingId),
              eq(offers.status, "pending"),
            ),
          );
        // Phase 2 : créer ici la transaction séquestrée (Stripe PaymentIntent).
        notifyUser(ctx.db, offer.buyerId, {
          title: "CardTrade — offre acceptée 🎉",
          body: "Ton offre a été acceptée : organise le rendez-vous dans l'app",
          data: { listingId: offer.listingId },
        });
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
        with: { buyer: publicUserWith },
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
