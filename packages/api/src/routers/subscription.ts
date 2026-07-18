import { and, desc, eq, inArray } from "drizzle-orm";
import { subscriptions } from "@cardtrade/db";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
import { FREE_LIMITS, PRO_PRICING, getUserPlan } from "../lib/plans.js";

export const subscriptionRouter = router({
  /** Tarifs et limites — source de vérité unique affichée par le paywall. */
  plans: publicProcedure.query(() => ({
    pricing: PRO_PRICING,
    freeLimits: FREE_LIMITS,
  })),

  /** Plan effectif + détail de l'abonnement courant (gestion SaaS). */
  status: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.db, ctx.user.id);
    const current = await ctx.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, ctx.user.id),
        inArray(subscriptions.status, ["active", "trialing", "past_due"]),
      ),
      orderBy: desc(subscriptions.currentPeriodEnd),
    });
    return {
      plan,
      isPro: plan === "pro",
      subscription: current
        ? {
            interval: current.interval,
            provider: current.provider,
            priceCents: current.priceCents,
            currency: current.currency,
            currentPeriodEnd: current.currentPeriodEnd,
            cancelAtPeriodEnd: current.cancelAtPeriodEnd,
          }
        : null,
    };
  }),

  /**
   * Résiliation : l'abonnement reste actif jusqu'à la fin de la période
   * payée, puis ne se renouvelle pas. (Phase 2 : répercuter sur Stripe.)
   */
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, ctx.user.id),
          inArray(subscriptions.status, ["active", "trialing"]),
        ),
      );
    return { ok: true };
  }),

  /** Réactivation avant l'échéance : annule la résiliation programmée. */
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, ctx.user.id),
          inArray(subscriptions.status, ["active", "trialing"]),
        ),
      );
    return { ok: true };
  }),

  // Phase 2 : checkout Stripe (web) + validation des reçus Apple/Google (mobile),
  // webhooks de renouvellement/annulation → upsert dans la table subscriptions.
});
