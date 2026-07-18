import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createClient } from "@supabase/supabase-js";
import { appRouter, createContext, type AuthUser } from "@cardtrade/api";
import { createDb } from "@cardtrade/db";

const PORT = Number(process.env.PORT ?? 3001);

const db = createDb();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/** Résout l'utilisateur depuis le JWT Supabase du header Authorization. */
async function resolveUser(authorization: string | undefined): Promise<AuthUser | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);

  // Mode dev sans Supabase configuré : jeton "dev:<uuid>:<email>" accepté.
  if (!supabase) {
    const [prefix, id, email] = token.split(":");
    if (prefix === "dev" && id && email && process.env.NODE_ENV !== "production") {
      return { id, email };
    }
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

const server = createHTTPServer({
  router: appRouter,
  middleware: (req, res, next) => {
    // CORS pour le web (Expo web tourne sur un autre port en dev)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    next();
  },
  createContext: async ({ req }) => {
    const user = await resolveUser(req.headers.authorization);
    return createContext({ db, user });
  },
});

server.listen(PORT);
console.log(`🃏 CardTrade API prête sur http://localhost:${PORT}`);
if (!supabase) {
  console.warn(
    "⚠️  SUPABASE_URL/SUPABASE_ANON_KEY absents — auth en mode dev (jeton 'dev:<uuid>:<email>')",
  );
}
