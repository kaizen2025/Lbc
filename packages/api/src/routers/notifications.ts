import { z } from "zod";
import { pushTokens, reports } from "@cardtrade/db";
import { protectedProcedure, router } from "../trpc.js";

export const notificationsRouter = router({
  /** Enregistre (upsert) le token push Expo du device courant. */
  registerPushToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(10).max(200),
        platform: z.enum(["ios", "android"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(pushTokens)
        .values({ userId: ctx.user.id, ...input })
        .onConflictDoUpdate({
          target: pushTokens.token,
          set: { userId: ctx.user.id, updatedAt: new Date() },
        });
      return { ok: true };
    }),

  /** Signalement d'annonce ou d'utilisateur (modération manuelle v1). */
  report: protectedProcedure
    .input(
      z
        .object({
          listingId: z.string().uuid().optional(),
          reportedUserId: z.string().uuid().optional(),
          reason: z.string().min(5).max(1000),
        })
        .refine((v) => v.listingId != null || v.reportedUserId != null, {
          message: "Cible du signalement manquante",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(reports).values({ ...input, reporterId: ctx.user.id });
      return { ok: true };
    }),
});
