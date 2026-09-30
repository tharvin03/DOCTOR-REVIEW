import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS procedures (
  id INTEGER PRIMARY KEY,
  specialty_id INTEGER NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  slug TEXT NOT NULL,
  UNIQUE (specialty_id, slug)
);
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL CHECK (city IN ('KL','Melaka')),
  address TEXT NOT NULL DEFAULT '',
  UNIQUE (name_norm, city)
);
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY,
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
  id INTEGER PRIMARY KEY,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hidden'))
);
CREATE TABLE IF NOT EXISTS removal_requests (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  review_link TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews(doctor_id, hidden);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty_id, hidden);
CREATE INDEX IF NOT EXISTS idx_dh_hospital ON doctor_hospitals(hospital_id);
`;

export type DB = Database.Database;

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const g = globalThis as unknown as { __doctorReviewDb?: DB };

export function getDb(): DB {
  if (!g.__doctorReviewDb) g.__doctorReviewDb = openDb(process.env.DATABASE_PATH || "./data/app.db");
  return g.__doctorReviewDb;
}
