import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { openDb } from "../lib/db";
import { seed } from "../lib/seed-data";
import { isSimilar, normalizeDoctorName, normalizeHospitalName, slugify } from "../lib/normalize";
import { createDoctor, createHospital, insertReview, validateReview } from "../lib/repo";
import { buildTemplate, parseWorkbook, runImport, type RawRow } from "../lib/import";

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

test("doctor/hospital uniqueness", () => {
  const db = openDb(":memory:");
  seed(db);
  const spec = (db.prepare("SELECT id FROM specialties").get() as { id: number }).id;
  assert.throws(() => createDoctor(db, { name: "dr. TAN   example", specialtyId: spec }), /already exists/);
  assert.throws(() => createHospital(db, { name: "example specialist hospital kl", city: "KL" }), /already exists/);
  // same name in the other city is allowed
  assert.ok(createHospital(db, { name: "Example Specialist Hospital KL", city: "Melaka" }));
  const a = createDoctor(db, { name: "Dr Same Slug", specialtyId: spec });
  const b = createDoctor(db, { name: "Dr Same-Slug", specialtyId: spec });
  assert.notEqual(a, b);
});

test("review validation: link required except Patient submission", () => {
  const base = { text: "x", sourceType: "Google review" };
  assert.match(validateReview(base)!, /link is required/);
  assert.equal(validateReview({ ...base, sourceType: "Patient submission" }), null);
  assert.match(validateReview({ ...base, sourceLink: "javascript:alert(1)" })!, /valid http/);
  assert.equal(validateReview({ ...base, sourceLink: "https://a.com/x" }), null);
});

test("import: preview rolls back, commit reuses and reports failures", () => {
  const db = openDb(":memory:");
  seed(db);
  const rows: RawRow[] = [
    { _row: 2, doctor_name: "Dr. tan example", hospital_name: "Example Specialist Hospital KL", city: "KL", review_text: "new text A", source_type: "Article", source_link: "https://a.com/1" },
    { _row: 3, doctor_name: "Dr New Person", specialty: "Orthopedics", hospital_name: "Brand New Hospital", city: "Melaka", review_text: "text B", source_type: "Google review", source_link: "https://a.com/2", procedures: "Knee replacement" },
    { _row: 4, doctor_name: "Dr New Person", hospital_name: "Brand New Hospital", city: "Melaka", review_text: "text C", source_type: "Google review" },
    { _row: 5, doctor_name: "Dr Bad", specialty: "Nope", hospital_name: "X", city: "KL", review_text: "t", source_type: "Other", source_link: "https://a.com/3" },
  ];
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
  const before = { d: count("doctors"), h: count("hospitals"), r: count("reviews") };
  const preview = runImport(db, rows, false);
  assert.deepEqual(preview.map((p) => p.status), ["matched", "new", "error", "error"]);
  assert.deepEqual({ d: count("doctors"), h: count("hospitals"), r: count("reviews") }, before);
  const done = runImport(db, rows, true);
  assert.equal(done.filter((x) => x.status !== "error").length, 2);
  assert.equal(count("doctors"), before.d + 1);
  assert.equal(count("hospitals"), before.h + 1);
  assert.equal(count("reviews"), before.r + 2);
  // re-import is rejected as duplicates, doesn't create anything
  assert.ok(runImport(db, rows, true).slice(0, 2).every((x) => x.status === "error"));
});

test("template round-trips through the parser", async () => {
  const buf = await buildTemplate();
  const rows = await parseWorkbook(buf);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].doctor_name, "Dr Example Name");
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Reviews").addRow(["foo"]);
  await assert.rejects(parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())), /Missing required/);
});

test("hidden reviews excluded from insert helper defaults", () => {
  const db = openDb(":memory:");
  seed(db);
  const id = insertReview(db, { doctorId: 1, hospitalId: 1, text: "t", sourceType: "Patient submission" });
  assert.equal((db.prepare("SELECT hidden FROM reviews WHERE id=?").get(id) as { hidden: number }).hidden, 0);
});
