import type { Db } from "./db";
import { CITIES } from "./constants";
import {
  displayDoctorName,
  isHttpUrl,
  normalizeDoctorName,
  normalizeHospitalName,
  slugify,
} from "./normalize";

export type DoctorRow = { id: number; name: string; slug: string; specialty_id: number };
export type HospitalRow = { id: number; name: string; city: string; slug: string };

async function uniqueSlug(db: Db, table: string, base: string, ownId?: number): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    const hit = await db.get<{ id: number }>(`SELECT id FROM ${table} WHERE slug = ?`, slug);
    if (!hit || hit.id === ownId) return slug;
    slug = `${base}-${n}`;
  }
}

export function findDoctorByName(db: Db, name: string) {
  return db.get<DoctorRow>("SELECT id, name, slug, specialty_id FROM doctors WHERE name_norm = ?", normalizeDoctorName(name));
}

export function findHospital(db: Db, name: string, city: string) {
  return db.get<HospitalRow>(
    "SELECT id, name, city, slug FROM hospitals WHERE name_norm = ? AND city = ?",
    normalizeHospitalName(name), city,
  );
}

/** Years of experience is optional: anything that is not a sensible whole number becomes "not set". */
export function cleanYears(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 80 ? n : null;
}

export async function createDoctor(
  db: Db,
  input: { name: string; specialtyId: number; description?: string; qualifications?: string; yearsExperience?: number | null; hidden?: boolean },
): Promise<number> {
  const clean = input.name.trim();
  const norm = normalizeDoctorName(clean);
  if (!norm) throw new Error("Doctor name is required");
  if (await findDoctorByName(db, clean)) throw new Error(`Doctor "${clean}" already exists`);
  const name = displayDoctorName(clean);
  const slug = await uniqueSlug(db, "doctors", slugify(name));
  return db.insert(
    "INSERT INTO doctors (name, name_norm, slug, specialty_id, short_description, qualifications, years_experience, hidden) VALUES (?,?,?,?,?,?,?,?)",
    name, norm, slug, input.specialtyId, input.description?.trim() ?? "", input.qualifications?.trim() ?? "",
    cleanYears(input.yearsExperience), input.hidden ? 1 : 0,
  );
}

export async function updateDoctorName(db: Db, id: number, rawName: string) {
  const name = displayDoctorName(rawName);
  const norm = normalizeDoctorName(rawName);
  if (!norm) throw new Error("Doctor name is required");
  if (await db.get("SELECT id FROM doctors WHERE name_norm = ? AND id != ?", norm, id))
    throw new Error(`Another doctor already uses the name "${name}"`);
  const current = await db.get<{ name_norm: string }>("SELECT name_norm FROM doctors WHERE id = ?", id);
  // Keep the slug stable (existing links) unless the name actually changed.
  const slug = current?.name_norm === norm ? null : await uniqueSlug(db, "doctors", slugify(name), id);
  await db.run("UPDATE doctors SET name = ?, name_norm = ?, slug = COALESCE(?, slug) WHERE id = ?", name, norm, slug, id);
}

export async function createHospital(db: Db, input: { name: string; city: string; address?: string }): Promise<number> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Hospital name is required");
  if (!(CITIES as readonly string[]).includes(input.city)) throw new Error("City must be KL or Melaka");
  if (await findHospital(db, name, input.city)) throw new Error(`Hospital "${name}" already exists in ${input.city}`);
  const slug = await uniqueSlug(db, "hospitals", slugify(`${name} ${input.city}`));
  return db.insert(
    "INSERT INTO hospitals (name, name_norm, slug, city, address) VALUES (?,?,?,?,?)",
    name, normalizeHospitalName(name), slug, input.city, input.address?.trim() ?? "",
  );
}

export async function updateHospital(db: Db, id: number, input: { name: string; city: string; address?: string }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const norm = normalizeHospitalName(name);
  if (!norm) throw new Error("Hospital name is required");
  if (!(CITIES as readonly string[]).includes(input.city)) throw new Error("City must be KL or Melaka");
  if (await db.get("SELECT id FROM hospitals WHERE name_norm = ? AND city = ? AND id != ?", norm, input.city, id))
    throw new Error(`Hospital "${name}" already exists in ${input.city}`);
  await db.run("UPDATE hospitals SET name = ?, name_norm = ?, city = ?, address = ? WHERE id = ?",
    name, norm, input.city, input.address?.trim() ?? "", id);
}

export async function linkDoctorHospital(db: Db, doctorId: number, hospitalId: number) {
  await db.run("INSERT INTO doctor_hospitals (doctor_id, hospital_id) VALUES (?,?) ON CONFLICT DO NOTHING", doctorId, hospitalId);
}

export async function createSpecialty(db: Db, name: string): Promise<number> {
  const n = name.trim();
  if (!n) throw new Error("Name is required");
  return db.insert("INSERT INTO specialties (name, slug) VALUES (?,?)", n, await uniqueSlug(db, "specialties", slugify(n)));
}

export async function createProcedure(db: Db, specialtyId: number, name: string): Promise<number> {
  const n = name.trim();
  if (!n) throw new Error("Name is required");
  const slug = slugify(n);
  if (await db.get("SELECT 1 AS x FROM procedures WHERE specialty_id = ? AND slug = ?", specialtyId, slug))
    throw new Error(`Procedure "${n}" already exists for this specialty`);
  return db.insert("INSERT INTO procedures (specialty_id, name, slug) VALUES (?,?,?)", specialtyId, n, slug);
}

// ---- reviews ----

export type ReviewInput = {
  doctorId: number;
  hospitalId: number;
  text: string;
  reviewerName?: string;
  date?: string;
  sourceType: string;
  sourceLink?: string;
  tags?: string;
  procedureIds?: number[];
  hidden?: boolean;
};

export type SourceTypeRow = { id: number; name: string; requires_link: number };

export function listSourceTypes(db: Db) {
  return db.all<SourceTypeRow>("SELECT id, name, requires_link FROM source_types ORDER BY name");
}

export async function createSourceType(db: Db, name: string, requiresLink: boolean): Promise<number> {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Name is required");
  if (await db.get("SELECT 1 AS x FROM source_types WHERE lower(name) = lower(?)", n)) throw new Error(`"${n}" already exists`);
  return db.insert("INSERT INTO source_types (name, requires_link) VALUES (?,?)", n, requiresLink ? 1 : 0);
}

/** Renames/updates a source type; reviews keep the name as text, so they are renamed with it. */
export async function updateSourceType(db: Db, id: number, name: string, requiresLink: boolean) {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Name is required");
  await db.tx(async (t) => {
    const old = await t.get<{ name: string }>("SELECT name FROM source_types WHERE id = ?", id);
    if (!old) throw new Error("Source type not found");
    if (await t.get("SELECT 1 AS x FROM source_types WHERE lower(name) = lower(?) AND id != ?", n, id)) throw new Error(`"${n}" already exists`);
    await t.run("UPDATE source_types SET name = ?, requires_link = ? WHERE id = ?", n, requiresLink ? 1 : 0, id);
    await t.run("UPDATE reviews SET source_type = ? WHERE source_type = ?", n, old.name);
  });
}

export async function deleteSourceType(db: Db, id: number) {
  const st = await db.get<{ name: string }>("SELECT name FROM source_types WHERE id = ?", id);
  if (!st) return;
  const used = (await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM reviews WHERE source_type = ?", st.name))!.c;
  if (used > 0) throw new Error(`"${st.name}" is used by ${used} review(s). Change those reviews first.`);
  await db.run("DELETE FROM source_types WHERE id = ?", id);
}

/**
 * Validates a review against the managed source-type list.
 * Throws a readable error, or returns the canonical source type name to store.
 */
export async function prepareReview(db: Db, r: Omit<ReviewInput, "doctorId" | "hospitalId">): Promise<string> {
  if (!r.text?.trim()) throw new Error("Review text is required");
  const st = await db.get<{ name: string; requires_link: number }>(
    "SELECT name, requires_link FROM source_types WHERE lower(name) = lower(?)", (r.sourceType ?? "").trim());
  if (!st) throw new Error(`Unknown source type "${r.sourceType ?? ""}". Add it under Admin > Source types first.`);
  const link = r.sourceLink?.trim() ?? "";
  if (st.requires_link && !link) throw new Error(`A source link is required for "${st.name}"`);
  if (link && !isHttpUrl(link)) throw new Error("Source link must be a valid http(s) URL");
  if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error("Review date must be YYYY-MM-DD");
  if (r.date && Number.isNaN(Date.parse(r.date))) throw new Error("Review date is not a valid date");
  return st.name;
}

/** Replaces the procedures a review is about. Each must belong to the doctor's specialty. */
export async function setReviewProcedures(db: Db, reviewId: number, doctorId: number, procedureIds: number[]) {
  const ids = [...new Set(procedureIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length > 0) {
    const okCount = (await db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM procedures p JOIN doctors d ON d.specialty_id = p.specialty_id
       WHERE d.id = ? AND p.id = ANY(?::int[])`, doctorId, ids))!.c;
    if (okCount !== ids.length) throw new Error("A selected procedure does not belong to this doctor's specialty");
  }
  await db.run("DELETE FROM review_procedures WHERE review_id = ?", reviewId);
  for (const pid of ids) await db.run("INSERT INTO review_procedures (review_id, procedure_id) VALUES (?,?)", reviewId, pid);
}

export async function insertReview(db: Db, r: ReviewInput): Promise<number> {
  const sourceType = await prepareReview(db, r);
  const id = await db.insert(
    `INSERT INTO reviews (doctor_id, hospital_id, review_text, reviewer_name, review_date, source_type,
       source_link, tags, hidden) VALUES (?,?,?,?,?,?,?,?,?)`,
    r.doctorId, r.hospitalId, r.text.trim(), r.reviewerName?.trim() ?? "", r.date || null, sourceType,
    r.sourceLink?.trim() ?? "", r.tags?.trim() ?? "", r.hidden ? 1 : 0,
  );
  if (r.procedureIds?.length) await setReviewProcedures(db, id, r.doctorId, r.procedureIds);
  return id;
}

export async function updateReview(db: Db, id: number, r: ReviewInput) {
  const sourceType = await prepareReview(db, r);
  await db.run(
    `UPDATE reviews SET doctor_id=?, hospital_id=?, review_text=?, reviewer_name=?, review_date=?, source_type=?,
       source_link=?, tags=?, hidden=? WHERE id=?`,
    r.doctorId, r.hospitalId, r.text.trim(), r.reviewerName?.trim() ?? "", r.date || null, sourceType,
    r.sourceLink?.trim() ?? "", r.tags?.trim() ?? "", r.hidden ? 1 : 0, id,
  );
  await setReviewProcedures(db, id, r.doctorId, r.procedureIds ?? []);
}

export function normalizeReviewText(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function reviewExists(db: Db, doctorId: number, text: string): Promise<boolean> {
  const rows = await db.all<{ review_text: string }>("SELECT review_text FROM reviews WHERE doctor_id = ?", doctorId);
  const n = normalizeReviewText(text);
  return rows.some((x) => normalizeReviewText(x.review_text) === n);
}
