import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant — voir .env.example à la racine du monorepo");
  }
  // prepare:false requis pour le pooler Supabase (transaction mode)
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}
