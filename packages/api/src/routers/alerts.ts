import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import { alerts } from "@cardtrade/db";
import { protectedProcedure, router } from "../trpc.js";
import { FREE_LIMITS, getUserPlan } from "../lib/plans.js";

const createAlertSchema = z
  .object({
    cardId: z.number().int().positive().optional(),
    sealedProductId: z.number().int().positive().optional(),
    cardLanguage: z.enum(["en", "fr", "ja", "de", "it", "es", "pt", "zh", "ko"]).optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    maxDistanceKm: z.number().int().min(1).max(500).optional(),
  })
  .refine((v) => (v.cardId != null) !== (v.sealedProductId != null), {
    message: "Une alerte cible soit une carte, soit un produit scellé",
  });

export const alertsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.alerts.findMany({
      where: and(eq(alerts.userId, ctx.user.id), eq(alerts.active, true)),
      with: { card: true, sealedProduct: true },
      orderBy: desc(alerts.createdAt),
    }),
  ),

  create: protectedProcedure.input(createAlertSchema).mutation(async ({ ctx, input }) => {
    const plan = await getUserPlan(ctx.db, ctx.user.id);
    if (plan === "free") {
      const [row] = await ctx.db
        .select({ total: count() })
        .from(alerts)
        .where(and(eq(alerts.userId, ctx.user.id), eq(alerts.active, true)));
      if ((row?.total ?? 0) >= FREE_LIMITS.priceAlerts) {
        throw new TRPCError({ code: "FORBIDDEN", message: "PRO_REQUIRED:alerts_limit" });
      }
    }
    const [created] = await ctx.db
      .insert(alerts)
      .values({ ...input, userId: ctx.user.id })
      .returning();
    return created;
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(alerts)
        .where(and(eq(alerts.id, input.id), eq(alerts.userId, ctx.user.id)));
      return { ok: true };
    }),
});
