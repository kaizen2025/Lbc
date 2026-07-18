/**
 * Seed du catalogue de démo : 2 jeux (Pokémon, Riftbound/League of Legends),
 * un set chacun, quelques cartes et produits scellés, et un historique de prix
 * EU/US sur 30 jours pour faire vivre les graphiques du portfolio.
 *
 * Usage : DATABASE_URL=... pnpm db:seed
 */
import { createDb, cards, games, priceHistory, sealedProducts, sets } from "./index.js";

const db = createDb();

async function main() {
  const [pokemon] = await db
    .insert(games)
    .values({ slug: "pokemon", name: "Pokémon TCG" })
    .onConflictDoUpdate({ target: games.slug, set: { name: "Pokémon TCG" } })
    .returning();
  const [riftbound] = await db
    .insert(games)
    .values({ slug: "riftbound", name: "Riftbound — League of Legends" })
    .onConflictDoUpdate({
      target: games.slug,
      set: { name: "Riftbound — League of Legends" },
    })
    .returning();
  if (!pokemon || !riftbound) throw new Error("seed games failed");

  const [sv151] = await db
    .insert(sets)
    .values({
      gameId: pokemon.id,
      code: "MEW",
      name: "151",
      releaseDate: "2023-09-22",
      cardCount: 165,
    })
    .onConflictDoNothing()
    .returning();
  const [origins] = await db
    .insert(sets)
    .values({
      gameId: riftbound.id,
      code: "OGN",
      name: "Origins",
      releaseDate: "2025-10-01",
      cardCount: 298,
    })
    .onConflictDoNothing()
    .returning();

  if (origins) {
    const originCards = await db
      .insert(cards)
      .values([
        { setId: origins.id, number: "303/298", name: "Ahri - Nine-Tailed Fox (Showcase)", rarity: "Showcase" },
        { setId: origins.id, number: "301/298", name: "Jinx - Loose Cannon (Showcase)", rarity: "Showcase" },
        { setId: origins.id, number: "299/298", name: "Yasuo - Unforgiven (Showcase)", rarity: "Showcase" },
        { setId: origins.id, number: "042/298", name: "Teemo - Swift Scout", rarity: "Common" },
      ])
      .onConflictDoNothing()
      .returning();

    await db
      .insert(sealedProducts)
      .values([
        { setId: origins.id, name: "Origins - Booster Display Case", kind: "case" },
        { setId: origins.id, name: "Origins - Booster Box", kind: "display" },
      ])
      .onConflictDoNothing();

    // 30 jours d'historique EU (€) et US ($) — la cote US est volontairement
    // plus haute (frais d'envoi/douane), c'est l'écart qu'on veut montrer.
    const ahri = originCards.find((c) => c.number === "303/298");
    if (ahri) {
      const today = new Date();
      const rows = [];
      for (let d = 30; d >= 0; d--) {
        const day = new Date(today);
        day.setDate(day.getDate() - d);
        const recordedAt = day.toISOString().slice(0, 10);
        const drift = (30 - d) * 6; // tendance haussière
        rows.push(
          {
            cardId: ahri.id,
            cardLanguage: "en" as const,
            condition: "near_mint" as const,
            isFoil: true,
            market: "eu" as const,
            currency: "EUR" as const,
            priceCents: 21000 + drift * 10,
            recordedAt,
            source: "manual",
          },
          {
            cardId: ahri.id,
            cardLanguage: "en" as const,
            condition: "near_mint" as const,
            isFoil: true,
            market: "us" as const,
            currency: "USD" as const,
            priceCents: 28500 + drift * 12,
            recordedAt,
            source: "manual",
          },
          {
            cardId: ahri.id,
            cardLanguage: "fr" as const,
            condition: "near_mint" as const,
            isFoil: true,
            market: "eu" as const,
            currency: "EUR" as const,
            priceCents: 15500 + drift * 7,
            recordedAt,
            source: "manual",
          },
        );
      }
      await db.insert(priceHistory).values(rows);
    }
  }

  if (sv151) {
    await db
      .insert(cards)
      .values([
        { setId: sv151.id, number: "151/165", name: "Mew ex", rarity: "Double Rare" },
        { setId: sv151.id, number: "006/165", name: "Charizard ex", rarity: "Double Rare" },
        { setId: sv151.id, number: "025/165", name: "Pikachu", rarity: "Common" },
      ])
      .onConflictDoNothing();
  }

  console.log("✅ Seed terminé (Pokémon 151 + Riftbound Origins, prix EU/US 30 jours)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
