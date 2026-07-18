import type { Database } from "@cardtrade/db";

/** Utilisateur authentifié, résolu par l'adaptateur serveur (JWT Supabase vérifié). */
export interface AuthUser {
  id: string;
  email: string;
}

export interface Context {
  db: Database;
  user: AuthUser | null;
}

export function createContext(opts: { db: Database; user: AuthUser | null }): Context {
  return opts;
}
