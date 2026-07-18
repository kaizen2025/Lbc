/**
 * Matching des alertes : croise les annonces actives récentes avec les alertes
 * (carte, langue, prix max, distance max vs position du profil de l'alerteur)
 * et notifie (push + email). Lancé par timer ALERT_MATCH_INTERVAL_HOURS ou
 * `pnpm job:alerts`.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@cardtrade/db";
import { notifyUser } from "@cardtrade/api";

export async function matchAlertsOnce(db: Database, sinceHours = 24): Promise<number> {
  const matches = await db.execute<{
    alert_user_id: string;
    listing_id: string;
    card_name: string | null;
    price_cents: number | null;
    city: string | null;
  }>(sql`
    select a.user_id as alert_user_id, l.id as listing_id,
           c.name as card_name, l.price_cents, l.city
    from cardtrade.alerts a
    join cardtrade.profiles p on p.user_id = a.user_id
    join cardtrade.listings l
      on l.status = 'active'
     and l.seller_id <> a.user_id
     and l.created_at > now() - (${sinceHours} || ' hours')::interval
     and (a.card_id is null or l.card_id = a.card_id)
     and (a.sealed_product_id is null or l.sealed_product_id = a.sealed_product_id)
     and (a.card_language is null or l.card_language = a.card_language)
     and (a.max_price_cents is null or (l.price_cents is not null and l.price_cents <= a.max_price_cents))
    left join cardtrade.cards c on c.id = l.card_id
    where a.active
      and (
        a.max_distance_km is null
        or (p.latitude is not null and l.latitude is not null and
            6371 * acos(greatest(-1.0, least(1.0,
              cos(radians(p.latitude)) * cos(radians(l.latitude))
              * cos(radians(l.longitude) - radians(p.longitude))
              + sin(radians(p.latitude)) * sin(radians(l.latitude))
            ))) <= a.max_distance_km)
      )
  `);

  for (const match of matches) {
    const price =
      match.price_cents != null ? ` à ${(match.price_cents / 100).toFixed(2)} €` : "";
    notifyUser(db, match.alert_user_id, {
      title: "CardTrade — carte trouvée près de chez toi 🔔",
      body: `${match.card_name ?? "Une carte de ta liste"}${price} vient d'être mise en ligne${match.city ? ` à ${match.city}` : ""}`,
      data: { listingId: match.listing_id },
    });
  }
  return matches.length;
}

export function startAlertMatchTimer(db: Database): void {
  const hours = Number(process.env.ALERT_MATCH_INTERVAL_HOURS ?? 0);
  if (!hours) return;
  const run = () =>
    void matchAlertsOnce(db, hours + 1)
      .then((n) => console.log(`🔔 Alertes matchées : ${n}`))
      .catch((error) => console.error("alert-match:", error));
  run();
  setInterval(run, hours * 3600 * 1000);
}
