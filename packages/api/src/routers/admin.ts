import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import {
  disputes,
  listings,
  profiles,
  reports,
  transactions,
  users,
} from "@cardtrade/db";
import { protectedProcedure, router } from "../trpc.js";

/** Emails admin (CSV) — vérifié côté serveur à chaque appel. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "kevin.bivia@gmail.com")
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!adminEmails().includes(ctx.user.email.toLowerCase())) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export const adminRouter = router({
  /** Sert aussi de test d'accès : FORBIDDEN → pas de lien admin dans l'app. */
  stats: adminProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.execute<{
      users: number;
      listings_active: number;
      transactions_completed: number;
      reports_open: number;
      disputes_open: number;
    }>(sql`
      select
        (select count(*)::int from ${users}) as users,
        (select count(*)::int from ${listings} where status = 'active') as listings_active,
        (select count(*)::int from ${transactions} where status = 'completed') as transactions_completed,
        (select count(*)::int from ${reports} where status = 'open') as reports_open,
        (select count(*)::int from ${disputes} where status = 'open') as disputes_open
    `);
    return row;
  }),

  reports: adminProcedure.query(({ ctx }) =>
    ctx.db.query.reports.findMany({
      where: eq(reports.status, "open"),
      orderBy: desc(reports.createdAt),
      limit: 50,
    }),
  ),

  resolveReport: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        action: z.enum(["reviewed", "dismissed"]),
        /** Optionnel : retirer l'annonce signalée en même temps. */
        cancelListing: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.query.reports.findFirst({
        where: eq(reports.id, input.id),
      });
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db
        .update(reports)
        .set({ status: input.action })
        .where(eq(reports.id, input.id));
      if (input.cancelListing && report.listingId) {
        await ctx.db
          .update(listings)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(listings.id, report.listingId));
      }
      return { ok: true };
    }),

  disputes: adminProcedure.query(({ ctx }) =>
    ctx.db.query.disputes.findMany({
      where: eq(disputes.status, "open"),
      orderBy: desc(disputes.createdAt),
      limit: 50,
    }),
  ),

  /** Arbitrage : remboursement acheteur ou libération vendeur. */
  resolveDispute: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        action: z.enum(["resolved_refund", "resolved_release"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dispute = await ctx.db.query.disputes.findFirst({
        where: eq(disputes.id, input.id),
      });
      if (!dispute) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(disputes)
          .set({ status: input.action, resolvedAt: new Date() })
          .where(eq(disputes.id, input.id));
        await tx
          .update(transactions)
          .set({
            status: input.action === "resolved_refund" ? "refunded" : "completed",
            completedAt: new Date(),
          })
          .where(eq(transactions.id, dispute.transactionId));
        // Phase 2 : refund / transfert Stripe correspondant.
      });
      return { ok: true };
    }),

  recentUsers: adminProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        userId: profiles.userId,
        username: profiles.username,
        city: profiles.city,
        tradeCount: profiles.tradeCount,
        createdAt: profiles.createdAt,
        email: users.email,
      })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .orderBy(desc(profiles.createdAt))
      .limit(50),
  ),
});
