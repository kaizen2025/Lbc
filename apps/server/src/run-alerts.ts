import "./env.js";
import { createDb } from "@cardtrade/db";
import { matchAlertsOnce } from "./jobs/alert-match.js";

const db = createDb();
matchAlertsOnce(db)
  .then((count) => {
    console.log(`✅ ${count} alertes notifiées`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
