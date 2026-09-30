import { openDb } from "../lib/db";
import { seed } from "../lib/seed-data";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL first");
  const db = openDb(url);
  console.log((await seed(db)) ? "Seeded demo data." : "Database already has data; skipped.");
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
