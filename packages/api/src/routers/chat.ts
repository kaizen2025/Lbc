import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  conversationParticipants,
  conversations,
  listings,
  messages,
} from "@cardtrade/db";
import { sendMessageSchema } from "@cardtrade/validators";
import { protectedProcedure, router } from "../trpc.js";
import { publicUserWith } from "../lib/publicProfile.js";
import { notifyUser } from "../lib/notify.js";

async function assertParticipant(
  ctx: { db: import("@cardtrade/db").Database },
  conversationId: string,
  userId: string,
) {
  const membership = await ctx.db.query.conversationParticipants.findFirst({
    where: and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.userId, userId),
    ),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}

export const chatRouter = router({
  conversations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, ctx.user.id));
    const ids = memberships.map((m) => m.conversationId);
    if (ids.length === 0) return [];
    return ctx.db.query.conversations.findMany({
      where: inArray(conversations.id, ids),
      with: {
        listing: { with: { card: true, sealedProduct: true } },
        participants: { with: { user: publicUserWith } },
        messages: { orderBy: desc(messages.createdAt), limit: 1 },
      },
      orderBy: desc(conversations.createdAt),
    });
  }),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertParticipant(ctx, input.conversationId, ctx.user.id);
      // Les 200 PLUS RÉCENTS (desc), remis en ordre chronologique pour le fil.
      const recent = await ctx.db.query.messages.findMany({
        where: eq(messages.conversationId, input.conversationId),
        orderBy: desc(messages.createdAt),
        limit: 200,
      });
      return recent.reverse();
    }),

  send: protectedProcedure.input(sendMessageSchema).mutation(async ({ ctx, input }) => {
    let conversationId = input.conversationId;

    if (!conversationId) {
      if (!input.listingId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "conversationId ou listingId requis",
        });
      }
      const listing = await ctx.db.query.listings.findFirst({
        where: eq(listings.id, input.listingId),
      });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      if (listing.sellerId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Impossible de se contacter soi-même",
        });
      }
      // Réutilise la conversation existante acheteur × annonce s'il y en a une.
      const mine = await ctx.db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .innerJoin(
          conversations,
          eq(conversations.id, conversationParticipants.conversationId),
        )
        .where(
          and(
            eq(conversationParticipants.userId, ctx.user.id),
            eq(conversations.listingId, input.listingId),
          ),
        )
        .limit(1);
      if (mine[0]) {
        conversationId = mine[0].conversationId;
      } else {
        conversationId = await ctx.db.transaction(async (tx) => {
          const [conversation] = await tx
            .insert(conversations)
            .values({ listingId: input.listingId })
            .returning();
          if (!conversation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          await tx.insert(conversationParticipants).values([
            { conversationId: conversation.id, userId: ctx.user.id },
            { conversationId: conversation.id, userId: listing.sellerId },
          ]);
          return conversation.id;
        });
      }
    } else {
      await assertParticipant(ctx, conversationId, ctx.user.id);
    }

    const [message] = await ctx.db
      .insert(messages)
      .values({ conversationId, senderId: ctx.user.id, body: input.body })
      .returning();

    // Push + email au destinataire (best-effort, hors chemin critique).
    const others = await ctx.db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    for (const participant of others) {
      if (participant.userId !== ctx.user.id) {
        notifyUser(ctx.db, participant.userId, {
          title: "CardTrade — nouveau message",
          body: input.body.slice(0, 120),
          data: { conversationId },
        });
      }
    }
    return message;
  }),
});
