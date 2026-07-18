import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { profiles, users } from "@cardtrade/db";
import { updateProfileSchema } from "@cardtrade/validators";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    // Crée user + profil au premier appel après l'inscription Supabase.
    let user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      with: { profile: true },
    });
    if (!user?.profile) {
      await ctx.db
        .insert(users)
        .values({ id: ctx.user.id, email: ctx.user.email })
        .onConflictDoNothing();
      // Le pseudo auto-généré peut entrer en collision : on réessaie avec suffixe.
      for (let attempt = 0; attempt < 3; attempt++) {
        const suffix = attempt === 0 ? "" : `_${Math.floor(Math.random() * 1000)}`;
        try {
          await ctx.db
            .insert(profiles)
            .values({
              userId: ctx.user.id,
              username: `user_${ctx.user.id.slice(0, 8)}${suffix}`,
            })
            .onConflictDoNothing({ target: profiles.userId });
          break;
        } catch (error) {
          if (!isUniqueViolation(error) || attempt === 2) throw error;
        }
      }
      user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        with: { profile: true },
      });
    }
    return user ?? null;
  }),

  update: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(profiles)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(profiles.userId, ctx.user.id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "Ce pseudo est déjà pris" });
        }
        throw error;
      }
    }),

  /** Profil public : liste blanche stricte — jamais GPS, email ni Stripe. */
  byUsername: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.username, input.username),
        columns: {
          userId: true,
          username: true,
          avatarUrl: true,
          bio: true,
          city: true,
          countryCode: true,
          ratingAvg: true,
          tradeCount: true,
          createdAt: true,
        },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      return profile;
    }),
});
