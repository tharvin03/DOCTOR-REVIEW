import { Pool, types, type PoolClient } from "pg";

// COUNT(*) etc. come back as bigint; we only ever deal with small numbers.
types.setTypeParser(20, (v) => parseInt(v, 10));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS specialties (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_specialties_name ON specialties (lower(name));
CREATE TABLE IF NOT EXISTS procedures (
  id SERIAL PRIMARY KEY,
  specialty_id INTEGER NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE (specialty_id, slug)
);
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL CHECK (city IN ('KL','Melaka')),
  address TEXT NOT NULL DEFAULT '',
  UNIQUE (name_norm, city)
);
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  specialty_id INTEGER NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
  short_description TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS doctor_hospitals (
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, hospital_id)
);
CREATE TABLE IF NOT EXISTS doctor_procedures (
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  procedure_id INTEGER NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, procedure_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  review_text TEXT NOT NULL,
  reviewer_name TEXT NOT NULL DEFAULT '',
  review_date TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN
    ('Google review','Article','Forum or social post','Patient submission','Other')),
  source_link TEXT NOT NULL DEFAULT '',
  source_title TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hidden'))
);
CREATE TABLE IF NOT EXISTS removal_requests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  review_link TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews(doctor_id, hidden);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty_id, hidden);
CREATE INDEX IF NOT EXISTS idx_dh_hospital ON doctor_hospitals(hospital_id);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: Row[]; rowCount: number | null }> };

/** Queries are written with `?` placeholders; convert to Postgres `$1, $2, …`. */
const toPg = (sql: string) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

/**
 * Thin async wrapper over a pg pool (or one transaction's client).
 * Nested `tx()` calls become savepoints, so a failing step can roll back alone.
 */
export class Db {
  constructor(
    private q: Queryable,
    private pool: Pool | null,
    private client: PoolClient | null,
    private depth: number,
    private ready: Promise<void>,
  ) {}

  async all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
    await this.ready;
    return (await this.q.query(toPg(sql), params)).rows as T[];
  }
  async get<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return (await this.all<T>(sql, ...params))[0];
  }
  /** Runs a write; returns the number of affected rows. */
  async run(sql: string, ...params: unknown[]): Promise<number> {
    await this.ready;
    return (await this.q.query(toPg(sql), params)).rowCount ?? 0;
  }
  /** Runs an INSERT and returns the new row's id. */
  async insert(sql: string, ...params: unknown[]): Promise<number> {
    const rows = await this.all<{ id: number }>(`${sql} RETURNING id`, ...params);
    return rows[0].id;
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    await this.ready;
    if (this.client) {
      const name = `sp_${this.depth + 1}`;
      await this.client.query(`SAVEPOINT ${name}`);
      try {
        const r = await fn(new Db(this.client, this.pool, this.client, this.depth + 1, this.ready));
        await this.client.query(`RELEASE SAVEPOINT ${name}`);
        return r;
      } catch (e) {
        await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        await this.client.query(`RELEASE SAVEPOINT ${name}`);
        throw e;
      }
    }
    const client = await this.pool!.connect();
    try {
      await client.query("BEGIN");
      const r = await fn(new Db(client, this.pool, client, 0, this.ready));
      await client.query("COMMIT");
      return r;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
}

async function ensureSchema(pool: Pool) {
  const client = await pool.connect();
  try {
    if ((await client.query("SELECT to_regclass('reviews') AS t")).rows[0].t) return;
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(727001)"); // two cold starts must not race
    await client.query(SCHEMA);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Neon's copy button adds channel_binding=require, which node-postgres may not satisfy; drop it. */
export function cleanConnectionString(url: string): string {
  return url.replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");
}

export function openDb(connectionString: string, opts: { schema?: string; max?: number } = {}): Db & { close(): Promise<void> } {
  const pool = new Pool({
    connectionString: cleanConnectionString(connectionString),
    max: opts.max ?? 5,
    idleTimeoutMillis: 10_000,
    ...(opts.schema ? { options: `-c search_path=${opts.schema}` } : {}),
  });
  pool.on("error", () => {}); // an idle connection dropped by the server is not fatal
  const ready = ensureSchema(pool);
  ready.catch(() => {}); // surfaced on first query instead of as an unhandled rejection
  const db = new Db(pool, pool, null, -1, ready) as Db & { close(): Promise<void> };
  db.close = () => pool.end();
  return db;
}

const g = globalThis as unknown as { __doctorReviewDb?: Db };

export function getDb(): Db {
  if (!g.__doctorReviewDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    g.__doctorReviewDb = openDb(url);
  }
  return g.__doctorReviewDb;
}
