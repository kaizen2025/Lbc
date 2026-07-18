/**
 * Import du catalogue canonique depuis les sources publiques par jeu.
 * Implémenté : Pokémon via pokemontcg.io (gratuit, images incluses ;
 * clé optionnelle POKEMONTCG_API_KEY pour un rate limit confortable).
 *
 * Usage :
 *   pnpm --filter @cardtrade/server job:catalog             # tous les sets Pokémon
 *   pnpm --filter @cardtrade/server job:catalog sv3pt5      # un set précis (id pokemontcg)
 *
 * Idempotent : upsert par (jeu, code de set) et (set, numéro de carte).
 */
import { eq, sql } from "drizzle-orm";
import { cards, games, sets, type Database } from "@cardtrade/db";

const API = "https://api.pokemontcg.io/v2";

interface PtcgSet {
  id: string;
  name: string;
  releaseDate?: string;
  total?: number;
}
interface PtcgCard {
  number: string;
  name: string;
  rarity?: string;
  images?: { small?: string; large?: string };
}

async function ptcgFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (process.env.POKEMONTCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  const response = await fetch(`${API}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`pokemontcg.io ${path} → HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function importPokemonCatalog(
  db: Database,
  onlySetId?: string,
): Promise<{ sets: number; cards: number }> {
  const [pokemon] = await db
    .insert(games)
    .values({ slug: "pokemon", name: "Pokémon TCG" })
    .onConflictDoUpdate({ target: games.slug, set: { name: "Pokémon TCG" } })
    .returning();
  if (!pokemon) throw new Error("upsert du jeu pokemon impossible");

  const { data: allSets } = await ptcgFetch<{ data: PtcgSet[] }>("/sets?pageSize=250");
  const targets = onlySetId ? allSets.filter((s) => s.id === onlySetId) : allSets;
  if (onlySetId && targets.length === 0) {
    throw new Error(`Set pokemontcg.io introuvable : ${onlySetId}`);
  }

  let cardCount = 0;
  for (const remoteSet of targets) {
    const [localSet] = await db
      .insert(sets)
      .values({
        gameId: pokemon.id,
        code: remoteSet.id,
        name: remoteSet.name,
        releaseDate: remoteSet.releaseDate?.replaceAll("/", "-") ?? null,
        cardCount: remoteSet.total ?? null,
      })
      .onConflictDoUpdate({
        target: [sets.gameId, sets.code],
        set: { name: remoteSet.name, cardCount: remoteSet.total ?? null },
      })
      .returning();
    if (!localSet) continue;

    for (let page = 1; ; page++) {
      const { data: pageCards } = await ptcgFetch<{ data: PtcgCard[] }>(
        `/cards?q=set.id:${remoteSet.id}&page=${page}&pageSize=250&select=number,name,rarity,images`,
      );
      if (pageCards.length === 0) break;
      for (const remoteCard of pageCards) {
        await db
          .insert(cards)
          .values({
            setId: localSet.id,
            number: remoteCard.number,
            name: remoteCard.name,
            rarity: remoteCard.rarity ?? null,
            imageUrl: remoteCard.images?.large ?? remoteCard.images?.small ?? null,
          })
          .onConflictDoUpdate({
            target: [cards.setId, cards.number],
            set: {
              name: remoteCard.name,
              rarity: remoteCard.rarity ?? null,
              imageUrl: remoteCard.images?.large ?? remoteCard.images?.small ?? null,
            },
          });
        cardCount += 1;
      }
      if (pageCards.length < 250) break;
    }
    console.log(`  ✓ ${remoteSet.name} (${remoteSet.id})`);
  }

  const [{ total }] = (await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cards)
    .innerJoin(sets, eq(cards.setId, sets.id))
    .where(eq(sets.gameId, pokemon.id))) as [{ total: number }];
  console.log(`✅ Pokémon : ${targets.length} sets traités, ${total} cartes en base`);
  return { sets: targets.length, cards: cardCount };
}
