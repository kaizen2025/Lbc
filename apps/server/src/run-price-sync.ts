import "./env.js";
import { createDb } from "@cardtrade/db";
import { syncPricesOnce } from "./jobs/price-sync.js";

const db = createDb();
syncPricesOnce(db)
  .then((count) => {
    console.log(`✅ ${count} séries de prix prolongées à aujourd'hui`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
