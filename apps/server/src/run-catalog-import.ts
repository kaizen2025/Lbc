import "./env.js";
import { createDb } from "@cardtrade/db";
import { importPokemonCatalog } from "./jobs/catalog-import.js";

const onlySetId = process.argv[2];
const db = createDb();
importPokemonCatalog(db, onlySetId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
