import { getDb } from "./db";
import { CITY_LABEL, type City } from "./constants";
import { normalizeDoctorName } from "./normalize";

export type Specialty = { id: number; name: string; slug: string };
export type Procedure = { id: number; specialty_id: number; name: string; slug: string };
export type Hospital = { id: number; name: string; city: City; slug: string; address: string };

export type DoctorCard = {
  id: number;
  name: string;
  slug: string;
  specialty: string;
  short_description: string;
  review_count: number;
  hospitals: Hospital[];
  procedures: Procedure[];
};

export type PublicReview = {
  id: number;
  review_text: string;
  reviewer_name: string;
  review_date: string | null;
  source_type: string;
  source_link: string;
  source_title: string;
  tags: string;
  hospital_name: string;
};

export const listSpecialties = () => getDb().all<Specialty>("SELECT id, name, slug FROM specialties ORDER BY name");

export const listProcedures = () => getDb().all<Procedure>("SELECT id, specialty_id, name, slug FROM procedures ORDER BY name");

export function getSpecialtyBySlug(slug: string) {
  return getDb().get<Specialty>("SELECT id, name, slug FROM specialties WHERE slug = ?", slug);
}

export function getProcedureBySlug(specialtyId: number, slug: string) {
  return getDb().get<Procedure>("SELECT id, specialty_id, name, slug FROM procedures WHERE specialty_id = ? AND slug = ?", specialtyId, slug);
}

async function attach(rows: Omit<DoctorCard, "hospitals" | "procedures">[]): Promise<DoctorCard[]> {
  const db = getDb();
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      hospitals: await db.all<Hospital>(
        `SELECT h.id, h.name, h.city, h.slug, h.address FROM doctor_hospitals dh
         JOIN hospitals h ON h.id = dh.hospital_id WHERE dh.doctor_id = ? ORDER BY h.name`, r.id),
      procedures: await db.all<Procedure>(
        `SELECT p.id, p.specialty_id, p.name, p.slug FROM doctor_procedures dp
         JOIN procedures p ON p.id = dp.procedure_id WHERE dp.doctor_id = ? ORDER BY p.name`, r.id),
    })),
  );
}

const CARD_SELECT = `
  SELECT d.id, d.name, d.slug, s.name AS specialty, d.short_description,
    (SELECT COUNT(*) FROM reviews r WHERE r.doctor_id = d.id AND r.hidden = 0) AS review_count
  FROM doctors d JOIN specialties s ON s.id = d.specialty_id`;

export async function searchDoctors(opts: {
  city: City;
  specialtyId: number;
  procedureId?: number;
  hospitalSlug?: string;
}): Promise<DoctorCard[]> {
  const params: (string | number)[] = [opts.specialtyId, opts.city];
  let hospitalClause = "";
  if (opts.hospitalSlug) {
    hospitalClause = " AND h.slug = ?";
    params.push(opts.hospitalSlug);
  }
  let procClause = "";
  if (opts.procedureId) {
    procClause = " AND EXISTS (SELECT 1 FROM doctor_procedures dp WHERE dp.doctor_id = d.id AND dp.procedure_id = ?)";
    params.push(opts.procedureId);
  }
  const rows = await getDb().all<Omit<DoctorCard, "hospitals" | "procedures">>(
      `${CARD_SELECT}
       WHERE d.hidden = 0 AND d.specialty_id = ?
         AND EXISTS (SELECT 1 FROM doctor_hospitals dh JOIN hospitals h ON h.id = dh.hospital_id
                     WHERE dh.doctor_id = d.id AND h.city = ?${hospitalClause})${procClause}
       ORDER BY review_count DESC, d.name`,
      ...params,
    );
  return attach(rows);
}

export async function searchDoctorsByName(q: string): Promise<DoctorCard[]> {
  const norm = normalizeDoctorName(q);
  if (norm.length < 2) return [];
  const like = "%" + norm.replace(/[\\%_]/g, "\\$&") + "%";
  const rows = await getDb().all<Omit<DoctorCard, "hospitals" | "procedures">>(
    `${CARD_SELECT} WHERE d.hidden = 0 AND d.name_norm LIKE ? ESCAPE '\\' ORDER BY d.name LIMIT 50`, like);
  return attach(rows);
}

/** Hospitals in a city that have at least one visible doctor of the specialty (for the filter). */
export function hospitalsFor(city: City, specialtyId: number): Promise<Hospital[]> {
  return getDb().all<Hospital>(
      `SELECT DISTINCT h.id, h.name, h.city, h.slug, h.address FROM hospitals h
       JOIN doctor_hospitals dh ON dh.hospital_id = h.id
       JOIN doctors d ON d.id = dh.doctor_id AND d.hidden = 0 AND d.specialty_id = ?
       WHERE h.city = ? ORDER BY h.name`,
      specialtyId, city,
    );
}

export async function getDoctorPage(slug: string): Promise<(DoctorCard & { reviews: PublicReview[] }) | undefined> {
  const db = getDb();
  const row = await db.get<Omit<DoctorCard, "hospitals" | "procedures">>(`${CARD_SELECT} WHERE d.hidden = 0 AND d.slug = ?`, slug);
  if (!row) return undefined;
  const reviews = await db.all<PublicReview>(
    `SELECT r.id, r.review_text, r.reviewer_name, r.review_date, r.source_type, r.source_link,
            r.source_title, r.tags, h.name AS hospital_name
     FROM reviews r JOIN hospitals h ON h.id = r.hospital_id
     WHERE r.doctor_id = ? AND r.hidden = 0
     ORDER BY r.review_date IS NULL, r.review_date DESC, r.id DESC`, row.id);
  return { ...(await attach([row]))[0], reviews };
}

export function allVisibleDoctorSlugs(): Promise<{ slug: string }[]> {
  return getDb().all<{ slug: string }>("SELECT slug FROM doctors WHERE hidden = 0");
}

// ---- SEO helpers ----

const BODY_PARTS = ["Knee", "Shoulder", "Hip", "Spine", "Foot", "Ankle", "Hand", "Wrist", "Elbow", "Sports"];
const ADJECTIVE: Record<string, string> = { Orthopedics: "Orthopedic", Orthopaedics: "Orthopaedic" };

export function specialtyLabel(d: Pick<DoctorCard, "specialty" | "procedures">): string {
  const counts = new Map<string, number>();
  for (const p of d.procedures)
    for (const part of BODY_PARTS) if (p.name.toLowerCase().includes(part.toLowerCase())) counts.set(part, (counts.get(part) ?? 0) + 1);
  const focus = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return `${ADJECTIVE[d.specialty] ?? d.specialty}${focus ? " " + focus : ""} Specialist`;
}

export function doctorMeta(d: DoctorCard) {
  const hospital = d.hospitals[0]?.name;
  const label = specialtyLabel(d);
  const title = [d.name, label, hospital].filter(Boolean).join(", ") + " | Patient Reviews";
  const where = d.hospitals.length ? ` at ${d.hospitals.map((h) => h.name).join(", ")} (${CITY_LABEL[d.hospitals[0].city]})` : "";
  const procs = d.procedures.length ? ` Procedures: ${d.procedures.map((p) => p.name).join(", ")}.` : "";
  const description = `Patient reviews for ${d.name}, ${label.toLowerCase()}${where}. ${d.review_count} review${d.review_count === 1 ? "" : "s"} from public sources.${procs}`;
  return { title, description: description.length > 300 ? description.slice(0, 297) + "…" : description };
}
