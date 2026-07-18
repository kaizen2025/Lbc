import { and, eq, gt, inArray } from "drizzle-orm";
import { subscriptions, type Database } from "@cardtrade/db";

/**
 * Tarifs CardTrade PRO — alignés sur le marché (Collectr PRO).
 * L'annuel est présélectionné sur le paywall avec le badge d'économie.
 */
export const PRO_PRICING = {
  currency: "EUR" as const,
  monthly: { priceCents: 799, interval: "month" as const },
  yearly: {
    priceCents: 5999,
    interval: "year" as const,
    /** 59,99 €/an ≈ 4,99 €/mois — affiché sous le prix annuel. */
    equivalentMonthlyCents: 499,
    savingsPercent: 38,
  },
} as const;

/** Limites du plan gratuit (le plan PRO n'a aucune limite). */
export const FREE_LIMITS = {
  collectionItems: 250,
  priceAlerts: 1,
  scansPerMonth: 10,
  /** Plages de graphique accessibles sans PRO. */
  chartRanges: ["1d", "7d", "1m", "3m"] as readonly string[],
  /** Marchés de cotation accessibles sans PRO (US = PRO). */
  markets: ["eu"] as readonly string[],
} as const;

export type Plan = "free" | "pro";

/**
 * Plan effectif d'un utilisateur : "pro" s'il a un abonnement actif ou en
 * essai dont la période courante n'est pas expirée.
 */
export async function getUserPlan(db: Database, userId: string): Promise<Plan> {
  const active = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["active", "trialing"]),
        gt(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .limit(1);
  return active.length > 0 ? "pro" : "free";
}
