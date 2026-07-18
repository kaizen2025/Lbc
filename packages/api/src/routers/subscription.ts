import { protectedProcedure, publicProcedure, router } from "../trpc.js";
import { FREE_LIMITS, PRO_PRICING, getUserPlan } from "../lib/plans.js";

export const subscriptionRouter = router({
  /** Tarifs et limites — source de vérité unique affichée par le paywall. */
  plans: publicProcedure.query(() => ({
    pricing: PRO_PRICING,
    freeLimits: FREE_LIMITS,
  })),

  /** Plan effectif de l'utilisateur connecté. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.db, ctx.user.id);
    return { plan, isPro: plan === "pro" };
  }),

  // Phase 2 : checkout Stripe (web) + validation des reçus Apple/Google (mobile),
  // webhooks de renouvellement/annulation → upsert dans la table subscriptions.
});
