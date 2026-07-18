import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { collectionItems, priceHistory } from "@cardtrade/db";
import { addCollectionItemSchema, portfolioHistorySchema } from "@cardtrade/validators";
import { protectedProcedure, router } from "../trpc.js";
import { FREE_LIMITS, getUserPlan } from "../lib/plans.js";

const RANGE_DAYS: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  max: null,
};

export const collectionRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.collectionItems.findMany({
      where: eq(collectionItems.userId, ctx.user.id),
      with: {
        card: { with: { set: { with: { game: true } } } },
        sealedProduct: { with: { set: true } },
      },
      orderBy: desc(collectionItems.createdAt),
    }),
  ),

  add: protectedProcedure
    .input(addCollectionItemSchema)
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.db, ctx.user.id);
      if (plan === "free") {
        const [row] = await ctx.db
          .select({ total: count() })
          .from(collectionItems)
          .where(eq(collectionItems.userId, ctx.user.id));
        if ((row?.total ?? 0) >= FREE_LIMITS.collectionItems) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "PRO_REQUIRED:collection_limit",
          });
        }
      }
      const [created] = await ctx.db
        .insert(collectionItems)
        .values({ ...input, userId: ctx.user.id })
        .returning();
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().min(1).max(9999).optional(),
        forSale: z.boolean().optional(),
        forTrade: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const [updated] = await ctx.db
        .update(collectionItems)
        .set(patch)
        .where(and(eq(collectionItems.id, id), eq(collectionItems.userId, ctx.user.id)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(collectionItems)
        .where(
          and(eq(collectionItems.id, input.id), eq(collectionItems.userId, ctx.user.id)),
        );
      return { ok: true };
    }),

  /**
   * Valeur du portfolio jour par jour sur la période, pour le graphique
   * 1J/7J/1M/3M/6M/MAX. La cote utilisée est le dernier prix connu par
   * (carte × langue × état × foil) sur le marché demandé (eu ou us).
   */
  portfolioHistory: protectedProcedure
    .input(portfolioHistorySchema)
    .query(async ({ ctx, input }) => {
      // Verrous PRO : plages 6M/MAX et cote US réservées aux abonnés.
      if (
        !FREE_LIMITS.chartRanges.includes(input.range) ||
        !FREE_LIMITS.markets.includes(input.market)
      ) {
        const plan = await getUserPlan(ctx.db, ctx.user.id);
        if (plan !== "pro") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: !FREE_LIMITS.markets.includes(input.market)
              ? "PRO_REQUIRED:us_market"
              : "PRO_REQUIRED:chart_range",
          });
        }
      }
      const days = RANGE_DAYS[input.range] ?? null;
      const since = days
        ? sql`and ph.recorded_at >= current_date - ${days}::int`
        : sql``;

      // Somme par jour : quantité × dernier prix connu ce jour-là pour la
      // variante exacte possédée (langue + état + foil + marché).
      const rows = await ctx.db.execute<{ day: string; total_cents: string }>(sql`
        with owned as (
          select ci.card_id, ci.sealed_product_id, ci.card_language, ci.condition,
                 ci.is_foil, ci.quantity
          from ${collectionItems} ci
          where ci.user_id = ${ctx.user.id}
        ),
        daily as (
          select ph.recorded_at as day,
                 o.quantity * ph.price_cents as line_cents,
                 row_number() over (
                   partition by ph.recorded_at,
                     coalesce(ph.card_id, 0), coalesce(ph.sealed_product_id, 0),
                     o.card_language, o.condition, o.is_foil
                   order by ph.id desc
                 ) as rn
          from ${priceHistory} ph
          join owned o
            on (ph.card_id is not distinct from o.card_id)
           and (ph.sealed_product_id is not distinct from o.sealed_product_id)
           and (ph.card_language is not distinct from o.card_language)
           and (ph.condition is not distinct from o.condition)
           and ph.is_foil = o.is_foil
          where ph.market = ${input.market} ${since}
        )
        select day::text, sum(line_cents)::text as total_cents
        from daily where rn = 1
        group by day order by day asc
      `);

      return rows.map((r) => ({
        day: r.day,
        totalCents: Number(r.total_cents),
      }));
    }),
});
