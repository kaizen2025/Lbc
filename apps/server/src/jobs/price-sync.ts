/**
 * Job quotidien de mise à jour des cotes.
 *
 * Phase actuelle : provider "manual" — prolonge chaque série (carte/produit ×
 * langue × état × foil × marché) avec un nouveau point du jour dérivé du
 * dernier prix connu (marche aléatoire bornée ±2 %), pour que les graphiques
 * de la recette vivent. Les providers réels (Cardmarket EU, eBay ventes
 * réalisées / TCGplayer US) remplaceront `nextPrice` derrière la même
 * interface quand les accès API seront en place.
 *
 * Exécution manuelle : pnpm --filter @cardtrade/server job:prices
 * Minuteur intégré : PRICE_SYNC_INTERVAL_HOURS=24 (0 ou absent = désactivé)
 */
import { sql } from "drizzle-orm";
import { priceHistory, type Database } from "@cardtrade/db";

function nextPrice(lastCents: number): number {
  const drift = 1 + (Math.random() - 0.48) * 0.04; // léger biais haussier, ±2 %
  return Math.max(1, Math.round(lastCents * drift));
}

export async function syncPricesOnce(db: Database): Promise<number> {
  // Dernier point de chaque série (toutes variantes confondues).
  const latest = await db.execute<{
    card_id: number | null;
    sealed_product_id: number | null;
    card_language: string | null;
    condition: string | null;
    is_foil: boolean;
    market: "eu" | "us";
    currency: "EUR" | "USD";
    price_cents: number;
    source: string;
  }>(sql`
    select distinct on (card_id, sealed_product_id, card_language, condition, is_foil, market)
      card_id, sealed_product_id, card_language, condition, is_foil,
      market, currency, price_cents, source
    from ${priceHistory}
    order by card_id, sealed_product_id, card_language, condition, is_foil, market,
      recorded_at desc, id desc
  `);

  if (latest.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  for (const row of latest) {
    // Un seul point par série et par jour.
    const existing = await db.execute<{ id: number }>(sql`
      select id from ${priceHistory}
      where recorded_at = ${today}
        and card_id is not distinct from ${row.card_id}
        and sealed_product_id is not distinct from ${row.sealed_product_id}
        and card_language is not distinct from ${row.card_language}
        and condition is not distinct from ${row.condition}
        and is_foil = ${row.is_foil}
        and market = ${row.market}
      limit 1
    `);
    if (existing.length > 0) continue;

    await db.insert(priceHistory).values({
      cardId: row.card_id,
      sealedProductId: row.sealed_product_id,
      cardLanguage: row.card_language as never,
      condition: row.condition as never,
      isFoil: row.is_foil,
      market: row.market,
      currency: row.currency,
      priceCents: nextPrice(row.price_cents),
      recordedAt: today,
      source: "manual",
    });
    inserted += 1;
  }
  return inserted;
}

export function startPriceSyncTimer(db: Database): void {
  const hours = Number(process.env.PRICE_SYNC_INTERVAL_HOURS ?? 0);
  if (!hours) return;
  const run = () =>
    void syncPricesOnce(db)
      .then((n) => console.log(`💹 Cotes mises à jour : ${n} séries`))
      .catch((error) => console.error("price-sync:", error));
  run();
  setInterval(run, hours * 3600 * 1000);
}
