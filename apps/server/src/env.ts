import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Charge le .env de la racine du monorepo (puis un éventuel .env local).
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
config();
