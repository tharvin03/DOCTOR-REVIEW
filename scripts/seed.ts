import { openDb } from "../lib/db";
import { seed } from "../lib/seed-data";

const db = openDb(process.env.DATABASE_PATH || "./data/app.db");
console.log(seed(db) ? "Seeded demo data." : "Database already has data; skipped.");
