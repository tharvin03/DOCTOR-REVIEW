import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import ExcelJS from "exceljs";
import { ensureSchema, openDb } from "../lib/db";
import { seed } from "../lib/seed-data";
import { isSimilar, normalizeDoctorName, normalizeHospitalName, slugify } from "../lib/normalize";
import { cleanYears, createDoctor, createHospital, createSourceType, deleteSourceType, insertReview, prepareReview, updateSourceType } from "../lib/repo";
import { buildTemplate, parseWorkbook, runImport, type RawRow } from "../lib/import";
import * as q from "../lib/queries";

const URL = process.env.DATABASE_URL_TEST || "postgres://app:app@localhost:5432/doctors_test";
const admin = new Pool({ connectionString: URL, max: 1 });
const made: string[] = [];
const dbs: { close(): Promise<void> }[] = [];

/** Fresh, isolated schema per test so tests never see each other's rows. */
async function freshDb(withSeed = true) {
  const schema = "t_" + Math.random().toString(36).slice(2, 10);
  await admin.query(`CREATE SCHEMA ${schema}`);
  made.push(schema);
  const db = openDb(URL, { schema, max: 3 });
  dbs.push(db);
  if (withSeed) await seed(db);
  return db;
}
const count = async (db: Awaited<ReturnType<typeof freshDb>>, t: string) => (await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t}`))!.c;

after(async () => {
  for (const d of dbs) await d.close();
  for (const s of made) await admin.query(`DROP SCHEMA ${s} CASCADE`);
  await admin.end();
});

test("normalizeDoctorName strips Dr / Dr. and spaces", () => {
  for (const n of ["Dr Tan  Wei", "dr. tan wei", "DR.Tan Wei", "  Dr. Dr Tan   Wei "])
    assert.equal(normalizeDoctorName(n), "tan wei");
  assert.equal(normalizeDoctorName("Drake Lim"), "drake lim");
  assert.equal(normalizeHospitalName("  Hospital   ABC "), "hospital abc");
  assert.equal(slugify("Dr Tan Wei-Ming"), "dr-tan-wei-ming");
});

test("similarity warnings", () => {
  assert.ok(isSimilar("tan wei ming", "tan wei mng"));
  assert.ok(isSimilar("wei ming tan", "tan wei ming"));
  assert.ok(!isSimilar("tan wei ming", "lim ah kow"));
});

test("doctor/hospital uniqueness", async () => {
  const db = await freshDb();
  const spec = (await db.get<{ id: number }>("SELECT id FROM specialties"))!.id;
  await assert.rejects(createDoctor(db, { name: "dr. TAN   example", specialtyId: spec }), /already exists/);
  await assert.rejects(createHospital(db, { name: "example specialist hospital kl", city: "KL" }), /already exists/);
  assert.ok(await createHospital(db, { name: "Example Specialist Hospital KL", city: "Melaka" })); // other city is fine
  const a = await createDoctor(db, { name: "Dr Same Slug", specialtyId: spec });
  const b = await createDoctor(db, { name: "Dr Same-Slug", specialtyId: spec });
  assert.notEqual(a, b);
  // The database itself also refuses duplicates (guards against races between two requests).
  await assert.rejects(
    db.run("INSERT INTO doctors (name, name_norm, slug, specialty_id) VALUES ('x','tan example','other-slug',?)", spec),
    /duplicate key/,
  );
  await assert.rejects(db.run("INSERT INTO specialties (name, slug) VALUES ('ORTHOPEDICS','orthopedics-2')"), /duplicate key/);
});

test("review validation: driven by the managed source-type list", async () => {
  const db = await freshDb(false);
  const base = { text: "x", sourceType: "Google review" };
  await assert.rejects(prepareReview(db, base), /link is required/);
  assert.equal(await prepareReview(db, { ...base, sourceType: "patient SUBMISSION" }), "Patient submission"); // no link needed, canonical name
  await assert.rejects(prepareReview(db, { ...base, sourceLink: "javascript:alert(1)" }), /valid http/);
  assert.equal(await prepareReview(db, { ...base, sourceLink: "https://a.com/x" }), "Google review");
  await assert.rejects(prepareReview(db, { ...base, sourceType: "TikTok video", sourceLink: "https://t.com/1" }), /Unknown source type/);
  await createSourceType(db, "TikTok video", true); // admin adds it once, then it works
  assert.equal(await prepareReview(db, { ...base, sourceType: "tiktok video", sourceLink: "https://t.com/1" }), "TikTok video");
  await assert.rejects(createSourceType(db, "TIKTOK video", true), /already exists/);
});

test("source types: rename cascades to reviews, delete blocked while in use", async () => {
  const db = await freshDb();
  const gid = (await db.get<{ id: number }>("SELECT id FROM source_types WHERE name = 'Google review'"))!.id;
  await updateSourceType(db, gid, "Google Maps review", true);
  assert.equal((await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM reviews WHERE source_type = 'Google Maps review'"))!.c, 1);
  assert.equal((await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM reviews WHERE source_type = 'Google review'"))!.c, 0);
  await assert.rejects(deleteSourceType(db, gid), /used by 1 review/);
  const other = (await db.get<{ id: number }>("SELECT id FROM source_types WHERE name = 'Other'"))!.id;
  await deleteSourceType(db, other); // unused, fine
  await assert.rejects(updateSourceType(db, gid, "article", true), /already exists/);
});

test("doctor profile: optional years are cleaned, empty fields stay empty", async () => {
  assert.equal(cleanYears(""), null);
  assert.equal(cleanYears("abc"), null);
  assert.equal(cleanYears("-3"), null);
  assert.equal(cleanYears("200"), null);
  assert.equal(cleanYears("12"), 12);
  assert.equal(cleanYears("0"), 0);
  const db = await freshDb();
  (globalThis as unknown as { __doctorReviewDb: unknown }).__doctorReviewDb = db;
  const plain = (await q.getDoctorPage("dr-tan-example"))!;
  assert.equal(plain.qualifications, "");
  assert.equal(plain.years_experience, null);
  await db.run("UPDATE doctors SET qualifications = 'MBBS, MS Ortho', years_experience = 15 WHERE slug = 'dr-tan-example'");
  const full = (await q.getDoctorPage("dr-tan-example"))!;
  assert.equal(full.qualifications, "MBBS, MS Ortho");
  assert.equal(full.years_experience, 15);
});

test("migration: a version-1 database upgrades in place and keeps its reviews", async () => {
  const schema = "t_" + Math.random().toString(36).slice(2, 10);
  await admin.query(`CREATE SCHEMA ${schema}`);
  made.push(schema);
  const raw = new Pool({ connectionString: URL, max: 2, options: `-c search_path=${schema}` });
  try {
    await ensureSchema(raw); // latest shape...
    // ...then rewind it to how the first release looked
    await raw.query(`
      DROP TABLE schema_migrations;
      ALTER TABLE doctors DROP COLUMN qualifications, DROP COLUMN years_experience;
      DROP TABLE source_types;
      ALTER TABLE reviews ADD CONSTRAINT reviews_source_type_check CHECK (source_type IN
        ('Google review','Article','Forum or social post','Patient submission','Other'));
      INSERT INTO specialties (name, slug) VALUES ('Orthopedics','orthopedics');
      INSERT INTO doctors (name, name_norm, slug, specialty_id) VALUES ('Dr Old','old','dr-old',1);
      INSERT INTO hospitals (name, name_norm, slug, city) VALUES ('H','h','h-kl','KL');
      INSERT INTO reviews (doctor_id, hospital_id, review_text, source_type, source_link, source_title)
        VALUES (1, 1, 'old review', 'Other', 'https://x.com/1', 'GOOGLE REIVIE');`);
    await ensureSchema(raw);
    await ensureSchema(raw); // idempotent
    const r = (await raw.query("SELECT source_type FROM reviews")).rows;
    assert.deepEqual(r, [{ source_type: "Other" }]);
    assert.ok((await raw.query("SELECT 1 FROM source_types WHERE name = 'Instagram post'")).rowCount);
    await raw.query("INSERT INTO reviews (doctor_id, hospital_id, review_text, source_type) VALUES (1,1,'new','Instagram post')"); // CHECK gone
    await raw.query("UPDATE doctors SET qualifications = 'x', years_experience = 3");
    assert.equal((await raw.query("SELECT max(version) AS v FROM schema_migrations")).rows[0].v, 2);
  } finally {
    await raw.end();
  }
});

test("import: preview rolls back, commit reuses and reports failures", async () => {
  const db = await freshDb();
  const rows: RawRow[] = [
    { _row: 2, doctor_name: "Dr. tan example", hospital_name: "Example Specialist Hospital KL", city: "KL", review_text: "new text A", source_type: "Article", source_link: "https://a.com/1" },
    { _row: 3, doctor_name: "Dr New Person", specialty: "Orthopedics", hospital_name: "Brand New Hospital", city: "Melaka", review_text: "text B", source_type: "Google review", source_link: "https://a.com/2", procedures: "Knee replacement" },
    { _row: 4, doctor_name: "Dr New Person", hospital_name: "Brand New Hospital", city: "Melaka", review_text: "text C", source_type: "Google review" },
    { _row: 5, doctor_name: "Dr Bad", specialty: "Nope", hospital_name: "X", city: "KL", review_text: "t", source_type: "Other", source_link: "https://a.com/3" },
  ];
  const before = { d: await count(db, "doctors"), h: await count(db, "hospitals"), r: await count(db, "reviews") };
  const preview = await runImport(db, rows, false);
  assert.deepEqual(preview.map((p) => p.status), ["matched", "new", "error", "error"]);
  assert.deepEqual({ d: await count(db, "doctors"), h: await count(db, "hospitals"), r: await count(db, "reviews") }, before);
  const done = await runImport(db, rows, true);
  assert.equal(done.filter((x) => x.status !== "error").length, 2);
  assert.equal(await count(db, "doctors"), before.d + 1);
  assert.equal(await count(db, "hospitals"), before.h + 1);
  assert.equal(await count(db, "reviews"), before.r + 2);
  assert.ok((await runImport(db, rows, true)).slice(0, 2).every((x) => x.status === "error")); // re-import = duplicates
  assert.equal(await count(db, "reviews"), before.r + 2);
});

test("template round-trips through the parser", async () => {
  const db = await freshDb();
  const rows = await parseWorkbook(await buildTemplate(db));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].doctor_name, "Dr Example Name");
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Reviews").addRow(["foo"]);
  await assert.rejects(parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())), /Missing required/);
});

test("public queries: hidden never shown, filters, name search", async () => {
  const db = await freshDb();
  (globalThis as unknown as { __doctorReviewDb: unknown }).__doctorReviewDb = db;
  const ortho = (await q.getSpecialtyBySlug("orthopedics"))!;
  const kl = await q.searchDoctors({ city: "KL", specialtyId: ortho.id });
  assert.deepEqual(kl.map((d) => d.name).sort(), ["Dr Lim Sample", "Dr Tan Example"]); // hidden doctor excluded
  assert.deepEqual((await q.searchDoctors({ city: "Melaka", specialtyId: ortho.id })).map((d) => d.name).sort(), ["Dr Aziz Demo", "Dr Lim Sample"]);
  const lig = (await q.getProcedureBySlug(ortho.id, "knee-ligament-surgery"))!;
  assert.deepEqual((await q.searchDoctors({ city: "KL", specialtyId: ortho.id, procedureId: lig.id })).map((d) => d.name), ["Dr Tan Example"]);
  const hs = await q.hospitalsFor("KL", ortho.id);
  assert.deepEqual(hs.map((h) => h.city), ["KL"]);
  assert.equal((await q.searchDoctors({ city: "KL", specialtyId: ortho.id, hospitalSlug: hs[0].slug })).length, 2);
  assert.equal((await q.searchDoctorsByName("dr. TAN")).length, 1);
  assert.equal((await q.searchDoctorsByName("hidden")).length, 0);
  assert.equal((await q.searchDoctorsByName("%")).length, 0); // LIKE wildcard is escaped

  const tan = (await q.getDoctorPage("dr-tan-example"))!;
  assert.equal(tan.review_count, 2);
  assert.equal(tan.reviews[0].review_date, "2025-06-02"); // newest first
  assert.equal(await q.getDoctorPage("dr-hidden-example"), undefined);
  await db.run("UPDATE reviews SET hidden = 1 WHERE doctor_id = ?", tan.id);
  const after = (await q.getDoctorPage("dr-tan-example"))!;
  assert.equal(after.reviews.length, 0);
  assert.equal(after.review_count, 0);
  assert.match(q.doctorMeta(tan).title, /^Dr Tan Example, Orthopedic Knee Specialist, Example Specialist Hospital KL \| Patient Reviews$/);
  assert.deepEqual((await q.allVisibleDoctorSlugs()).map((d) => d.slug).sort(), ["dr-aziz-demo", "dr-lim-sample", "dr-tan-example"]);
});

test("a failed transaction rolls back everything", async () => {
  const db = await freshDb();
  const before = await count(db, "hospitals");
  await assert.rejects(db.tx(async (t) => {
    await createHospital(t, { name: "Temp Hospital", city: "KL" });
    throw new Error("boom");
  }), /boom/);
  assert.equal(await count(db, "hospitals"), before);
  const id = await insertReview(db, { doctorId: 1, hospitalId: 1, text: "t", sourceType: "Patient submission" });
  assert.equal((await db.get<{ hidden: number }>("SELECT hidden FROM reviews WHERE id=?", id))!.hidden, 0);
});

test("connection string: Neon's channel_binding parameter is dropped", async () => {
  const { cleanConnectionString: c } = await import("../lib/db");
  assert.equal(c("postgresql://u:p@h/db?sslmode=require&channel_binding=require"), "postgresql://u:p@h/db?sslmode=require");
  assert.equal(c("postgresql://u:p@h/db?channel_binding=require&sslmode=require"), "postgresql://u:p@h/db?sslmode=require");
  assert.equal(c("postgresql://u:p@h/db?channel_binding=require"), "postgresql://u:p@h/db");
  assert.equal(c("postgresql://u:p@h/db?sslmode=require"), "postgresql://u:p@h/db?sslmode=require");
});
