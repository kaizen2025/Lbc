import "./env.js";
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { createClient } from "@supabase/supabase-js";
import { appRouter, createContext, type AuthUser } from "@cardtrade/api";
import { createDb } from "@cardtrade/db";
import { startPriceSyncTimer } from "./jobs/price-sync.js";

const PORT = Number(process.env.PORT ?? 3001);
/** Dossier du build web Expo (recette) — servi par ce même process. */
const WEB_DIST = process.env.WEB_DIST ?? join(process.cwd(), "../mobile-web/dist");

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

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: async ({ req }) => {
    const user = await resolveUser(req.headers.authorization);
    return createContext({ db, user });
  },
});

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function serveStatic(pathname: string, res: http.ServerResponse): boolean {
  if (!existsSync(WEB_DIST)) return false;
  // normalize() neutralise les "../" — jamais de sortie du dossier dist.
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(WEB_DIST, safePath);
  if (!filePath.startsWith(WEB_DIST)) return false;
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA : toute route inconnue renvoie index.html (Expo Router côté client)
    filePath = join(WEB_DIST, "index.html");
    if (!existsSync(filePath)) return false;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": filePath.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname.startsWith("/trpc")) {
    // L'adaptateur standalone attend l'URL sans le préfixe /trpc.
    req.url = req.url!.replace(/^\/trpc/, "") || "/";
    trpcHandler(req, res);
    return;
  }

  if (serveStatic(url.pathname, res)) return;

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT);
console.log(`🃏 CardTrade prêt sur http://localhost:${PORT} (API: /trpc, web: /)`);
if (!supabase) {
  console.warn(
    "⚠️  SUPABASE_URL/SUPABASE_ANON_KEY absents — auth en mode dev (jeton 'dev:<uuid>:<email>')",
  );
}
if (!existsSync(WEB_DIST)) {
  console.warn(`ℹ️  Pas de build web dans ${WEB_DIST} — seule l'API est servie`);
}

startPriceSyncTimer(db);
