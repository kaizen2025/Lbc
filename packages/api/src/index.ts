import { router } from "./trpc.js";
import { alertsRouter } from "./routers/alerts.js";
import { catalogRouter } from "./routers/catalog.js";
import { listingsRouter } from "./routers/listings.js";
import { offersRouter } from "./routers/offers.js";
import { chatRouter } from "./routers/chat.js";
import { collectionRouter } from "./routers/collection.js";
import { pricesRouter } from "./routers/prices.js";
import { profileRouter } from "./routers/profile.js";
import { notificationsRouter } from "./routers/notifications.js";
import { subscriptionRouter } from "./routers/subscription.js";
import { transactionsRouter } from "./routers/transactions.js";

export const appRouter = router({
  alerts: alertsRouter,
  catalog: catalogRouter,
  listings: listingsRouter,
  offers: offersRouter,
  chat: chatRouter,
  collection: collectionRouter,
  prices: pricesRouter,
  profile: profileRouter,
  notifications: notificationsRouter,
  subscription: subscriptionRouter,
  transactions: transactionsRouter,
});

/** Type du router complet — importé par le client Expo pour le typage bout-en-bout. */
export type AppRouter = typeof appRouter;

export { createContext, type AuthUser, type Context } from "./context.js";
export { notifyUser } from "./lib/notify.js";
