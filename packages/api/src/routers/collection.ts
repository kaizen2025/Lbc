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
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.query.collectionItems.findMany({
      where: eq(collectionItems.userId, ctx.user.id),
      with: {
        card: { with: { set: { with: { game: true } } } },
        sealedProduct: { with: { set: true } },
      },
      orderBy: desc(collectionItems.createdAt),
    });
    if (items.length === 0) return [];

    // Dernière cote EU connue par item (variante exacte), en une requête.
    const priced = await ctx.db.execute<{ item_id: string; price_cents: number }>(sql`
      select ci.id as item_id, lp.price_cents
      from ${collectionItems} ci
      join lateral (
        select ph.price_cents
        from ${priceHistory} ph
        where ph.market = 'eu'
          and (ph.card_id is not distinct from ci.card_id)
          and (ph.sealed_product_id is not distinct from ci.sealed_product_id)
          and (ph.card_language is not distinct from ci.card_language)
          and (ph.condition is not distinct from ci.condition)
          and ph.is_foil = ci.is_foil
        order by ph.recorded_at desc, ph.id desc
        limit 1
      ) lp on true
      where ci.user_id = ${ctx.user.id}
    `);
    const priceByItem = new Map(priced.map((row) => [row.item_id, row.price_cents]));

    return items
      .map((item) => {
        const unitPriceCents = priceByItem.get(item.id) ?? null;
        return {
          ...item,
          unitPriceCents,
          valueCents: unitPriceCents != null ? unitPriceCents * item.quantity : null,
        };
      })
      .sort((a, b) => (b.valueCents ?? -1) - (a.valueCents ?? -1));
  }),

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

  /** Export CSV de la collection — fonctionnalité PRO. */
  exportCsv: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.db, ctx.user.id);
    if (plan !== "pro") {
      throw new TRPCError({ code: "FORBIDDEN", message: "PRO_REQUIRED:export" });
    }
    const items = await ctx.db.query.collectionItems.findMany({
      where: eq(collectionItems.userId, ctx.user.id),
      with: {
        card: { with: { set: { with: { game: true } } } },
        sealedProduct: { with: { set: true } },
      },
    });
    // Guillemets échappés + neutralisation des préfixes de formule tableur.
    const escape = (value: string) => {
      const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const header = "game,set,name,number,language,condition,foil,quantity,acquired_price_eur";
    const lines = items.map((item) => {
      const game = item.card?.set.game.name ?? "";
      const set = item.card?.set.name ?? item.sealedProduct?.set.name ?? "";
      const name = item.card?.name ?? item.sealedProduct?.name ?? "";
      const number = item.card?.number ?? "";
      return [
        escape(game),
        escape(set),
        escape(name),
        escape(number),
        item.cardLanguage ?? "",
        item.condition ?? "",
        item.isFoil ? "1" : "0",
        String(item.quantity),
        item.acquiredPriceCents != null
          ? (item.acquiredPriceCents / 100).toFixed(2)
          : "",
      ].join(",");
    });
    return { csv: [header, ...lines].join("\n"), count: items.length };
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

      // Valeur quotidienne = somme(quantité × DERNIER prix connu ≤ jour) pour
      // chaque variante possédée, sur un calendrier continu : une variante
      // sans point de cote un jour donné garde sa dernière valeur (pas de
      // dents de scie), et les quantités d'une même variante sont agrégées.
      const rows = await ctx.db.execute<{ day: string; total_cents: string }>(sql`
        with owned as (
          select ci.card_id, ci.sealed_product_id, ci.card_language, ci.condition,
                 ci.is_foil, sum(ci.quantity) as quantity
          from ${collectionItems} ci
          where ci.user_id = ${ctx.user.id}
          group by ci.card_id, ci.sealed_product_id, ci.card_language,
                   ci.condition, ci.is_foil
        ),
        calendar as (
          select generate_series(
            coalesce(
              (select min(recorded_at) from ${priceHistory} where market = ${input.market}),
              current_date
            ),
            current_date, interval '1 day'
          )::date as day
        ),
        bounded as (
          select day from calendar
          ${days ? sql`where day >= current_date - ${days}::int` : sql``}
        ),
        daily as (
          select b.day, o.quantity * lp.price_cents as line_cents
          from bounded b
          cross join owned o
          left join lateral (
            select ph.price_cents
            from ${priceHistory} ph
            where ph.market = ${input.market}
              and ph.recorded_at <= b.day
              and (ph.card_id is not distinct from o.card_id)
              and (ph.sealed_product_id is not distinct from o.sealed_product_id)
              and (ph.card_language is not distinct from o.card_language)
              and (ph.condition is not distinct from o.condition)
              and ph.is_foil = o.is_foil
            order by ph.recorded_at desc, ph.id desc
            limit 1
          ) lp on true
        )
        select day::text, coalesce(sum(line_cents), 0)::text as total_cents
        from daily
        group by day order by day asc
      `);

      return rows.map((r) => ({
        day: r.day,
        totalCents: Number(r.total_cents),
      }));
    }),
});
