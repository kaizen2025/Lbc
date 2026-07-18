import { router } from "./trpc.js";
import { catalogRouter } from "./routers/catalog.js";
import { listingsRouter } from "./routers/listings.js";
import { offersRouter } from "./routers/offers.js";
import { chatRouter } from "./routers/chat.js";
import { collectionRouter } from "./routers/collection.js";
import { pricesRouter } from "./routers/prices.js";
import { profileRouter } from "./routers/profile.js";

export const appRouter = router({
  catalog: catalogRouter,
  listings: listingsRouter,
  offers: offersRouter,
  chat: chatRouter,
  collection: collectionRouter,
  prices: pricesRouter,
  profile: profileRouter,
});

/** Type du router complet — importé par le client Expo pour le typage bout-en-bout. */
export type AppRouter = typeof appRouter;

export { createContext, type AuthUser, type Context } from "./context.js";
