import { sql } from "drizzle-orm";
import { priceHistory } from "@cardtrade/db";
import { cardPriceQuerySchema } from "@cardtrade/validators";
import { publicProcedure, router } from "../trpc.js";

const RANGE_DAYS: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  max: null,
};

export const pricesRouter = router({
  /**
   * Cote d'une carte : historique EU et US côte à côte, filtrable par
   * langue d'impression / état / foil. L'écart EU vs US se calcule côté client
   * à partir des deux dernières valeurs.
   */
  history: publicProcedure.input(cardPriceQuerySchema).query(async ({ ctx, input }) => {
    const days = RANGE_DAYS[input.range] ?? null;
    const conditions = [
      input.cardId != null
        ? sql`ph.card_id = ${input.cardId}`
        : sql`ph.sealed_product_id = ${input.sealedProductId ?? -1}`,
    ];
    if (input.cardLanguage) conditions.push(sql`ph.card_language = ${input.cardLanguage}`);
    if (input.condition) conditions.push(sql`ph.condition = ${input.condition}`);
    if (input.isFoil != null) conditions.push(sql`ph.is_foil = ${input.isFoil}`);
    if (days) conditions.push(sql`ph.recorded_at >= current_date - ${days}::int`);

    const where = sql.join(conditions, sql` and `);
    const rows = await ctx.db.execute<{
      day: string;
      market: "eu" | "us";
      currency: "EUR" | "USD";
      price_cents: number;
    }>(sql`
      select ph.recorded_at::text as day, ph.market, ph.currency,
             avg(ph.price_cents)::int as price_cents
      from ${priceHistory} ph
      where ${where}
      group by ph.recorded_at, ph.market, ph.currency
      order by ph.recorded_at asc
    `);

    return {
      eu: rows.filter((r) => r.market === "eu"),
      us: rows.filter((r) => r.market === "us"),
    };
  }),
});
