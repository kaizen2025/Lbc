import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  listings,
  offers,
  profiles,
  reviews,
  tradeValidations,
  transactions,
} from "@cardtrade/db";
import {
  createReviewSchema,
  createTransactionSchema,
  validateTradeSchema,
} from "@cardtrade/validators";
import { protectedProcedure, router } from "../trpc.js";

/** Frais de service plateforme en centimes (1 € par défaut, 0 € pour un trade). */
const rawFee = Number(process.env.PLATFORM_FEE_EUR_CENTS ?? 100);
const FEE_CENTS = Number.isFinite(rawFee) && rawFee >= 0 ? Math.round(rawFee) : 100;

function makeValidationCode() {
  // Code court lisible (QR + saisie manuelle), aléatoire crypto.
  return randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export const transactionsRouter = router({
  /**
   * L'acheteur crée la transaction après acceptation de son offre.
   * Trade sans argent (0 €) → séquestre inutile, statut "escrowed" direct.
   * Vente → "pending_payment" jusqu'au paiement Stripe (Phase 2).
   */
  createFromOffer: protectedProcedure
    .input(createTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.db.query.offers.findFirst({
        where: eq(offers.id, input.offerId),
        with: { listing: true },
      });
      if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
      if (offer.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (offer.status !== "accepted") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "L'offre doit être acceptée par le vendeur",
        });
      }
      // L'annonce doit être réservée par CETTE offre (anti double-vente).
      if (offer.listing.status !== "reserved") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "L'annonce n'est plus disponible",
        });
      }

      const amountCents = offer.amountCents ?? offer.listing.priceCents ?? 0;
      const isPureTrade = amountCents === 0;

      // Index unique sur offerId : les appels concurrents ne créent qu'une
      // transaction ; onConflictDoNothing + relecture pour les perdants.
      const [tx] = await ctx.db
        .insert(transactions)
        .values({
          listingId: offer.listingId,
          offerId: offer.id,
          buyerId: offer.buyerId,
          sellerId: offer.listing.sellerId,
          amountCents,
          feeCents: isPureTrade ? 0 : FEE_CENTS,
          currency: offer.listing.currency,
          status: isPureTrade ? "escrowed" : "pending_payment",
        })
        .onConflictDoNothing({ target: transactions.offerId })
        .returning();

      if (!tx) {
        const existing = await ctx.db.query.transactions.findFirst({
          where: eq(transactions.offerId, offer.id),
        });
        if (!existing) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return existing;
      }

      // Un code de validation par partie : chacun montre le sien, scanne l'autre.
      await ctx.db.insert(tradeValidations).values([
        { transactionId: tx.id, userId: tx.buyerId, qrToken: makeValidationCode() },
        { transactionId: tx.id, userId: tx.sellerId, qrToken: makeValidationCode() },
      ]);
      return tx;
    }),

  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.transactions.findMany({
      where: or(
        eq(transactions.buyerId, ctx.user.id),
        eq(transactions.sellerId, ctx.user.id),
      ),
      with: { listing: { with: { card: true, sealedProduct: true } } },
      orderBy: desc(transactions.createdAt),
    }),
  ),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tx = await ctx.db.query.transactions.findFirst({
        where: eq(transactions.id, input.id),
        with: {
          listing: { with: { card: true, sealedProduct: true } },
          validations: true,
        },
      });
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.buyerId !== ctx.user.id && tx.sellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const myValidation = tx.validations.find((v) => v.userId === ctx.user.id);
      const otherValidation = tx.validations.find((v) => v.userId !== ctx.user.id);
      const { validations: _v, stripePaymentIntentId: _s, ...safeTx } = tx;
      return {
        ...safeTx,
        /** Code que JE montre — jamais celui de l'autre partie. */
        myCode: myValidation?.qrToken ?? null,
        /** J'ai scanné/validé le code de l'autre partie. */
        iValidatedOther: otherValidation?.validatedAt != null,
        /** L'autre partie a scanné/validé mon code. */
        otherValidatedMe: myValidation?.validatedAt != null,
      };
    }),

  /**
   * Je saisis/scanne le code de l'AUTRE partie → sa ligne passe validée.
   * Quand les deux lignes sont validées : transaction terminée, annonce
   * clôturée, compteur d'échanges +1 pour chacun. (Phase 2 : transfert Stripe.)
   */
  validate: protectedProcedure
    .input(validateTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const tx = await ctx.db.query.transactions.findFirst({
        where: eq(transactions.id, input.transactionId),
        with: { validations: true },
      });
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.buyerId !== ctx.user.id && tx.sellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (tx.status !== "escrowed" && tx.status !== "meetup_scheduled") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La transaction n'est pas prête à être validée",
        });
      }
      const otherValidation = tx.validations.find(
        (v) => v.userId !== ctx.user.id && v.qrToken === input.code.toUpperCase().trim(),
      );
      if (!otherValidation) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Code invalide" });
      }
      if (!otherValidation.validatedAt) {
        await ctx.db
          .update(tradeValidations)
          .set({ validatedAt: new Date() })
          .where(eq(tradeValidations.id, otherValidation.id));
      }

      // Complétion transactionnelle : l'update conditionné par status <> completed
      // garantit qu'UN SEUL des deux scans simultanés exécute le bloc final
      // (tradeCount, clôture d'annonce) — pas de double incrément.
      const completed = await ctx.db.transaction(async (dbTx) => {
        const all = await dbTx.query.tradeValidations.findMany({
          where: eq(tradeValidations.transactionId, tx.id),
        });
        const bothValidated =
          all.length === 2 && all.every((v) => v.validatedAt != null);
        if (!bothValidated) return false;

        const [closed] = await dbTx
          .update(transactions)
          .set({ status: "completed", completedAt: new Date() })
          .where(
            and(
              eq(transactions.id, tx.id),
              sql`${transactions.status} <> 'completed'`,
            ),
          )
          .returning();
        if (!closed) return true; // déjà complétée par l'autre scan

        await dbTx
          .update(listings)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(listings.id, tx.listingId));
        await dbTx
          .update(profiles)
          .set({ tradeCount: sql`${profiles.tradeCount} + 1` })
          .where(
            or(eq(profiles.userId, tx.buyerId), eq(profiles.userId, tx.sellerId)),
          );
        // Phase 2 : capture/transfert Stripe vers le vendeur ici.
        return true;
      });
      return { completed };
    }),

  review: protectedProcedure
    .input(createReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const tx = await ctx.db.query.transactions.findFirst({
        where: eq(transactions.id, input.transactionId),
      });
      if (!tx || tx.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Avis possible uniquement après un échange terminé",
        });
      }
      if (tx.buyerId !== ctx.user.id && tx.sellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const revieweeId = tx.buyerId === ctx.user.id ? tx.sellerId : tx.buyerId;
      const [review] = await ctx.db
        .insert(reviews)
        .values({
          transactionId: tx.id,
          reviewerId: ctx.user.id,
          revieweeId,
          rating: input.rating,
          comment: input.comment,
        })
        .onConflictDoNothing()
        .returning();

      // Moyenne recalculée sur l'ensemble des avis reçus.
      await ctx.db
        .update(profiles)
        .set({
          ratingAvg: sql`(select avg(rating)::float from ${reviews} where ${and(
            eq(reviews.revieweeId, revieweeId),
          )})`,
        })
        .where(eq(profiles.userId, revieweeId));
      return review ?? null;
    }),
});
