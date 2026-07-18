import { z } from "zod";
import { asc, eq, ilike, or } from "drizzle-orm";
import { cards, games, sealedProducts, sets } from "@cardtrade/db";
import { publicProcedure, router } from "../trpc.js";

export const catalogRouter = router({
  games: publicProcedure.query(({ ctx }) =>
    ctx.db.select().from(games).orderBy(asc(games.name)),
  ),

  setsByGame: publicProcedure
    .input(z.object({ gameId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(sets)
        .where(eq(sets.gameId, input.gameId))
        .orderBy(asc(sets.releaseDate)),
    ),

  searchCards: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        setId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(({ ctx, input }) => {
      const pattern = `%${input.query}%`;
      const nameOrNumber = or(ilike(cards.name, pattern), ilike(cards.number, pattern));
      return ctx.db.query.cards.findMany({
        where: (c, { and, eq: eq_ }) =>
          input.setId ? and(nameOrNumber, eq_(c.setId, input.setId)) : nameOrNumber,
        with: { set: { with: { game: true } } },
        limit: input.limit,
      });
    }),

  cardById: publicProcedure
    .input(z.object({ cardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.db.query.cards.findFirst({
        where: (c, { eq: eq_ }) => eq_(c.id, input.cardId),
        with: { set: { with: { game: true } } },
      });
      return card ?? null;
    }),

  sealedBySet: publicProcedure
    .input(z.object({ setId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(sealedProducts)
        .where(eq(sealedProducts.setId, input.setId))
        .orderBy(asc(sealedProducts.name)),
    ),
});
