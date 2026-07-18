import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@cardtrade/api";

/** Client tRPC typé bout-en-bout — les types viennent directement du serveur. */
export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

/** Jeton d'auth injecté par le provider de session (Supabase). */
let currentToken: string | null = null;
export function setAuthToken(token: string | null) {
  currentToken = token;
}

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        transformer: superjson,
        headers() {
          return currentToken ? { authorization: `Bearer ${currentToken}` } : {};
        },
      }),
    ],
  });
}
