import type { DB } from "./db";
import { CITIES, SOURCE_TYPES, type City, type SourceType } from "./constants";
import {
  displayDoctorName,
  isHttpUrl,
  normalizeDoctorName,
  normalizeHospitalName,
  slugify,
} from "./normalize";

export type DoctorRow = { id: number; name: string; slug: string; specialty_id: number };
export type HospitalRow = { id: number; name: string; city: City; slug: string };

function uniqueSlug(db: DB, table: string, base: string, ownId?: number): string {
  let slug = base;
  for (let n = 2; ; n++) {
    const hit = db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(slug) as { id: number } | undefined;
    if (!hit || hit.id === ownId) return slug;
    slug = `${base}-${n}`;
  }
}

export function findDoctorByName(db: DB, name: string): DoctorRow | undefined {
  return db
    .prepare("SELECT id, name, slug, specialty_id FROM doctors WHERE name_norm = ?")
    .get(normalizeDoctorName(name)) as DoctorRow | undefined;
}

export function findHospital(db: DB, name: string, city: string): HospitalRow | undefined {
  return db
    .prepare("SELECT id, name, city, slug FROM hospitals WHERE name_norm = ? AND city = ?")
    .get(normalizeHospitalName(name), city) as HospitalRow | undefined;
}

export function createDoctor(
  db: DB,
  input: { name: string; specialtyId: number; description?: string; hidden?: boolean },
): number {
  const clean = input.name.trim();
  const norm = normalizeDoctorName(clean);
  if (!norm) throw new Error("Doctor name is required");
  if (findDoctorByName(db, clean)) throw new Error(`Doctor "${clean}" already exists`);
  const name = displayDoctorName(clean);
  const slug = uniqueSlug(db, "doctors", slugify(name));
  return Number(
    db
      .prepare(
        "INSERT INTO doctors (name, name_norm, slug, specialty_id, short_description, hidden) VALUES (?,?,?,?,?,?)",
      )
      .run(name, norm, slug, input.specialtyId, input.description?.trim() ?? "", input.hidden ? 1 : 0)
      .lastInsertRowid,
  );
}

export function updateDoctorName(db: DB, id: number, rawName: string) {
  const name = displayDoctorName(rawName);
  const norm = normalizeDoctorName(rawName);
  if (!norm) throw new Error("Doctor name is required");
  const clash = db.prepare("SELECT id FROM doctors WHERE name_norm = ? AND id != ?").get(norm, id);
  if (clash) throw new Error(`Another doctor already uses the name "${name}"`);
  const current = db.prepare("SELECT name_norm FROM doctors WHERE id = ?").get(id) as { name_norm: string };
  // Keep the slug stable (existing links) unless the name actually changed.
  const slug = current.name_norm === norm ? undefined : uniqueSlug(db, "doctors", slugify(name), id);
  db.prepare(
    "UPDATE doctors SET name = ?, name_norm = ?, slug = COALESCE(?, slug) WHERE id = ?",
  ).run(name, norm, slug ?? null, id);
}

export function createHospital(db: DB, input: { name: string; city: string; address?: string }): number {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Hospital name is required");
  if (!(CITIES as readonly string[]).includes(input.city)) throw new Error("City must be KL or Melaka");
  if (findHospital(db, name, input.city)) throw new Error(`Hospital "${name}" already exists in ${input.city}`);
  const slug = uniqueSlug(db, "hospitals", slugify(`${name} ${input.city}`));
  return Number(
    db
      .prepare("INSERT INTO hospitals (name, name_norm, slug, city, address) VALUES (?,?,?,?,?)")
      .run(name, normalizeHospitalName(name), slug, input.city, input.address?.trim() ?? "").lastInsertRowid,
  );
}

export function updateHospital(db: DB, id: number, input: { name: string; city: string; address?: string }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const norm = normalizeHospitalName(name);
  if (!norm) throw new Error("Hospital name is required");
  if (!(CITIES as readonly string[]).includes(input.city)) throw new Error("City must be KL or Melaka");
  const clash = db.prepare("SELECT id FROM hospitals WHERE name_norm = ? AND city = ? AND id != ?").get(norm, input.city, id);
  if (clash) throw new Error(`Hospital "${name}" already exists in ${input.city}`);
  db.prepare("UPDATE hospitals SET name = ?, name_norm = ?, city = ?, address = ? WHERE id = ?").run(
    name, norm, input.city, input.address?.trim() ?? "", id,
  );
}

export function linkDoctorHospital(db: DB, doctorId: number, hospitalId: number) {
  db.prepare("INSERT OR IGNORE INTO doctor_hospitals (doctor_id, hospital_id) VALUES (?,?)").run(doctorId, hospitalId);
}

export function createSpecialty(db: DB, name: string): number {
  const n = name.trim();
  if (!n) throw new Error("Name is required");
  return Number(
    db.prepare("INSERT INTO specialties (name, slug) VALUES (?,?)").run(n, uniqueSlug(db, "specialties", slugify(n))).lastInsertRowid,
  );
}

export function createProcedure(db: DB, specialtyId: number, name: string): number {
  const n = name.trim();
  if (!n) throw new Error("Name is required");
  const slug = slugify(n);
  if (db.prepare("SELECT 1 FROM procedures WHERE specialty_id = ? AND slug = ?").get(specialtyId, slug))
    throw new Error(`Procedure "${n}" already exists for this specialty`);
  return Number(db.prepare("INSERT INTO procedures (specialty_id, name, slug) VALUES (?,?,?)").run(specialtyId, n, slug).lastInsertRowid);
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

export function insertReview(db: DB, r: ReviewInput): number {
  const err = validateReview(r);
  if (err) throw new Error(err);
  return Number(
    db
      .prepare(
        `INSERT INTO reviews (doctor_id, hospital_id, review_text, reviewer_name, review_date, source_type,
           source_link, source_title, tags, hidden) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        r.doctorId, r.hospitalId, r.text.trim(), r.reviewerName?.trim() ?? "", r.date || null,
        r.sourceType as SourceType, r.sourceLink?.trim() ?? "",
        r.sourceTitle?.trim() || defaultSourceTitle(r.sourceType), r.tags?.trim() ?? "", r.hidden ? 1 : 0,
      ).lastInsertRowid,
  );
}

export function updateReview(db: DB, id: number, r: ReviewInput) {
  const err = validateReview(r);
  if (err) throw new Error(err);
  db.prepare(
    `UPDATE reviews SET doctor_id=?, hospital_id=?, review_text=?, reviewer_name=?, review_date=?, source_type=?,
       source_link=?, source_title=?, tags=?, hidden=? WHERE id=?`,
  ).run(
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

export function reviewExists(db: DB, doctorId: number, text: string): boolean {
  const rows = db.prepare("SELECT review_text FROM reviews WHERE doctor_id = ?").all(doctorId) as { review_text: string }[];
  const n = normalizeReviewText(text);
  return rows.some((x) => normalizeReviewText(x.review_text) === n);
}
