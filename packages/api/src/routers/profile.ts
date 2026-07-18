import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { profiles, users } from "@cardtrade/db";
import { updateProfileSchema } from "@cardtrade/validators";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    // Crée user + profil au premier appel après l'inscription Supabase.
    let user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      with: { profile: true },
    });
    if (!user) {
      await ctx.db
        .insert(users)
        .values({ id: ctx.user.id, email: ctx.user.email })
        .onConflictDoNothing();
      await ctx.db
        .insert(profiles)
        .values({
          userId: ctx.user.id,
          username: `user_${ctx.user.id.slice(0, 8)}`,
        })
        .onConflictDoNothing();
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
      const [updated] = await ctx.db
        .update(profiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(profiles.userId, ctx.user.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Profil public : pas de coordonnées exactes, uniquement ville + réputation. */
  byUsername: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.username, input.username),
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      const { latitude: _lat, longitude: _lng, ...publicProfile } = profile;
      return publicProfile;
    }),
});
