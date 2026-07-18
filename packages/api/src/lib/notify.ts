import { eq } from "drizzle-orm";
import { pushTokens, users, type Database } from "@cardtrade/db";

/**
 * Notification best-effort : push Expo vers tous les devices de l'utilisateur
 * + email Brevo en parallèle. Ne bloque JAMAIS la mutation appelante
 * (fire-and-forget, erreurs loggées).
 * Env requis : BREVO_API_KEY + BREVO_SENDER_EMAIL pour l'email (sinon push seul).
 */
export function notifyUser(
  db: Database,
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): void {
  void (async () => {
    const tokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));

    if (tokens.length > 0) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tokens.map(({ token }) => ({
            to: token,
            title: payload.title,
            body: payload.body,
            data: payload.data ?? {},
            sound: "default",
          })),
        ),
      });
    }

    const apiKey = process.env.BREVO_API_KEY;
    const sender = process.env.BREVO_SENDER_EMAIL;
    if (apiKey && sender) {
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (user) {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: sender, name: "CardTrade" },
            to: [{ email: user.email }],
            subject: payload.title,
            htmlContent: `<p>${payload.body}</p>`,
          }),
        });
      }
    }
  })().catch((error) => console.error("notifyUser:", error));
}
