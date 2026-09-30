import type { Db } from "./db";
import { CITIES, SOURCE_TYPES } from "./constants";
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

export async function createDoctor(
  db: Db,
  input: { name: string; specialtyId: number; description?: string; hidden?: boolean },
): Promise<number> {
  const clean = input.name.trim();
  const norm = normalizeDoctorName(clean);
  if (!norm) throw new Error("Doctor name is required");
  if (await findDoctorByName(db, clean)) throw new Error(`Doctor "${clean}" already exists`);
  const name = displayDoctorName(clean);
  const slug = await uniqueSlug(db, "doctors", slugify(name));
  return db.insert(
    "INSERT INTO doctors (name, name_norm, slug, specialty_id, short_description, hidden) VALUES (?,?,?,?,?,?)",
    name, norm, slug, input.specialtyId, input.description?.trim() ?? "", input.hidden ? 1 : 0,
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

export async function linkDoctorProcedure(db: Db, doctorId: number, procedureId: number) {
  await db.run("INSERT INTO doctor_procedures (doctor_id, procedure_id) VALUES (?,?) ON CONFLICT DO NOTHING", doctorId, procedureId);
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
  sourceTitle?: string;
  tags?: string;
  hidden?: boolean;
};

/** Returns an error message, or null when the review is valid. */
export function validateReview(r: Omit<ReviewInput, "doctorId" | "hospitalId">): string | null {
  if (!r.text?.trim()) return "Review text is required";
  if (!(SOURCE_TYPES as readonly string[]).includes(r.sourceType))
    return `Source type must be one of: ${SOURCE_TYPES.join(", ")}`;
  const link = r.sourceLink?.trim() ?? "";
  if (r.sourceType !== "Patient submission" && !link) return "Source link is required for this source type";
  if (link && !isHttpUrl(link)) return "Source link must be a valid http(s) URL";
  if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return "Review date must be YYYY-MM-DD";
  if (r.date && Number.isNaN(Date.parse(r.date))) return "Review date is not a valid date";
  return null;
}

export async function insertReview(db: Db, r: ReviewInput): Promise<number> {
  const err = validateReview(r);
  if (err) throw new Error(err);
  return db.insert(
    `INSERT INTO reviews (doctor_id, hospital_id, review_text, reviewer_name, review_date, source_type,
       source_link, source_title, tags, hidden) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    r.doctorId, r.hospitalId, r.text.trim(), r.reviewerName?.trim() ?? "", r.date || null, r.sourceType,
    r.sourceLink?.trim() ?? "", r.sourceTitle?.trim() || defaultSourceTitle(r.sourceType), r.tags?.trim() ?? "", r.hidden ? 1 : 0,
  );
}

export async function updateReview(db: Db, id: number, r: ReviewInput) {
  const err = validateReview(r);
  if (err) throw new Error(err);
  await db.run(
    `UPDATE reviews SET doctor_id=?, hospital_id=?, review_text=?, reviewer_name=?, review_date=?, source_type=?,
       source_link=?, source_title=?, tags=?, hidden=? WHERE id=?`,
    r.doctorId, r.hospitalId, r.text.trim(), r.reviewerName?.trim() ?? "", r.date || null, r.sourceType,
    r.sourceLink?.trim() ?? "", r.sourceTitle?.trim() || defaultSourceTitle(r.sourceType),
    r.tags?.trim() ?? "", r.hidden ? 1 : 0, id,
  );
}

export function defaultSourceTitle(sourceType: string): string {
  return sourceType === "Google review" ? "Google review" : sourceType === "Patient submission" ? "Patient submission" : "View source";
}

export function normalizeReviewText(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function reviewExists(db: Db, doctorId: number, text: string): Promise<boolean> {
  const rows = await db.all<{ review_text: string }>("SELECT review_text FROM reviews WHERE doctor_id = ?", doctorId);
  const n = normalizeReviewText(text);
  return rows.some((x) => normalizeReviewText(x.review_text) === n);
}
