"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, passwordMatches, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  createDoctor, createHospital, createProcedure, createSpecialty, findDoctorByName, findHospital,
  insertReview, linkDoctorHospital, updateDoctorName, updateHospital, updateReview,
} from "@/lib/repo";
import { runImport, parseWorkbook, type RawRow, type RowResult } from "@/lib/import";
import { slugify } from "@/lib/normalize";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0) || 0;
const nums = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter(Boolean);

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/FOREIGN KEY/i.test(m)) return "Cannot delete: other records still reference this item (e.g. reviews or doctors). Hide it instead, or remove those first.";
  if (/UNIQUE/i.test(m)) return "That name already exists.";
  return m;
}

/** Runs fn then redirects with a flash message. redirect() must stay outside try/catch. */
async function flow(fd: FormData | null, back: string, ok: string, fn: () => string | void) {
  await requireAdmin();
  let msg = ok, err = "";
  let dest = back;
  try {
    const r = fn();
    if (typeof r === "string") dest = r;
  } catch (e) {
    err = friendly(e);
  }
  revalidatePath("/", "layout");
  const sep = dest.includes("?") ? "&" : "?";
  redirect(err ? `${back}${back.includes("?") ? "&" : "?"}err=${encodeURIComponent(err)}` : `${dest}${sep}msg=${encodeURIComponent(msg)}`);
}

// ---------- auth ----------
export async function login(fd: FormData) {
  // HOOK: rate limiting / captcha for login goes here later.
  if (passwordMatches(str(fd, "password"))) {
    await createSession();
    redirect("/admin");
  }
  redirect("/admin/login?err=1");
}
export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ---------- doctors ----------
export async function saveDoctor(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, id ? `/admin/doctors/${id}` : "/admin/doctors/new", "Doctor saved", () => {
    const db = getDb();
    const tx = db.transaction(() => {
      let did = id;
      if (did) {
        updateDoctorName(db, did, str(fd, "name"));
        db.prepare("UPDATE doctors SET specialty_id=?, short_description=?, hidden=? WHERE id=?")
          .run(num(fd, "specialty_id"), str(fd, "short_description"), fd.get("hidden") ? 1 : 0, did);
      } else {
        did = createDoctor(db, {
          name: str(fd, "name"), specialtyId: num(fd, "specialty_id"),
          description: str(fd, "short_description"), hidden: !!fd.get("hidden"),
        });
      }
      db.prepare("DELETE FROM doctor_hospitals WHERE doctor_id=?").run(did);
      nums(fd, "hospital_ids").forEach((h) => linkDoctorHospital(db, did, h));
      db.prepare("DELETE FROM doctor_procedures WHERE doctor_id=?").run(did);
      nums(fd, "procedure_ids").forEach((p) => db.prepare("INSERT OR IGNORE INTO doctor_procedures VALUES (?,?)").run(did, p));
      return did;
    });
    return `/admin/doctors/${tx()}`;
  });
}
export async function toggleDoctor(fd: FormData) {
  await flow(fd, "/admin/doctors", "Updated", () => { getDb().prepare("UPDATE doctors SET hidden = 1 - hidden WHERE id=?").run(num(fd, "id")); });
}
export async function deleteDoctor(fd: FormData) {
  await flow(fd, "/admin/doctors", "Doctor deleted (and their reviews)", () => { getDb().prepare("DELETE FROM doctors WHERE id=?").run(num(fd, "id")); });
}

// ---------- hospitals ----------
export async function saveHospital(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, id ? `/admin/hospitals/${id}` : "/admin/hospitals/new", "Hospital saved", () => {
    const db = getDb();
    const input = { name: str(fd, "name"), city: str(fd, "city"), address: str(fd, "address") };
    if (id) updateHospital(db, id, input);
    else return `/admin/hospitals/${createHospital(db, input)}`;
  });
}
export async function deleteHospital(fd: FormData) {
  await flow(fd, "/admin/hospitals", "Hospital deleted", () => { getDb().prepare("DELETE FROM hospitals WHERE id=?").run(num(fd, "id")); });
}

// ---------- reviews ----------
function resolveDoctor(fd: FormData): number {
  const db = getDb();
  const id = num(fd, "doctor_id");
  if (id) {
    if (!db.prepare("SELECT 1 FROM doctors WHERE id=?").get(id)) throw new Error("Selected doctor no longer exists");
    return id;
  }
  const name = str(fd, "doctor_new_name");
  if (!name) throw new Error("Pick an existing doctor or choose Create new");
  const existing = findDoctorByName(db, name);
  if (existing) return existing.id; // never create a duplicate
  const specialtyId = num(fd, "doctor_new_specialty_id");
  if (!specialtyId) throw new Error("Choose a specialty for the new doctor");
  return createDoctor(db, { name, specialtyId });
}
function resolveHospital(fd: FormData): number {
  const db = getDb();
  const id = num(fd, "hospital_id");
  if (id) {
    if (!db.prepare("SELECT 1 FROM hospitals WHERE id=?").get(id)) throw new Error("Selected hospital no longer exists");
    return id;
  }
  const name = str(fd, "hospital_new_name");
  if (!name) throw new Error("Pick an existing hospital or choose Create new");
  const city = str(fd, "hospital_new_city");
  return findHospital(db, name, city)?.id ?? createHospital(db, { name, city, address: str(fd, "hospital_new_address") });
}

export async function saveReview(fd: FormData) {
  const id = num(fd, "id");
  const submissionId = num(fd, "submission_id");
  await flow(fd, id ? `/admin/reviews/${id}` : "/admin/reviews/new", "Review saved", () => {
    const db = getDb();
    return db.transaction(() => {
      const doctorId = resolveDoctor(fd);
      const hospitalId = resolveHospital(fd);
      linkDoctorHospital(db, doctorId, hospitalId);
      const input = {
        doctorId, hospitalId, text: str(fd, "review_text"), reviewerName: str(fd, "reviewer_name"),
        date: str(fd, "review_date"), sourceType: str(fd, "source_type"), sourceLink: str(fd, "source_link"),
        sourceTitle: str(fd, "source_title"), tags: str(fd, "tags"), hidden: !!fd.get("hidden"),
      };
      if (id) { updateReview(db, id, input); return "/admin/reviews"; }
      insertReview(db, input);
      if (submissionId) db.prepare("UPDATE submissions SET status='approved' WHERE id=?").run(submissionId);
      return submissionId ? "/admin/submissions" : "/admin/reviews";
    })();
  });
}
export async function toggleReview(fd: FormData) {
  await flow(fd, str(fd, "back") || "/admin/reviews", "Updated", () => { getDb().prepare("UPDATE reviews SET hidden = 1 - hidden WHERE id=?").run(num(fd, "id")); });
}
export async function hideReview(fd: FormData) {
  await flow(fd, str(fd, "back") || "/admin/reviews", "Review hidden", () => { getDb().prepare("UPDATE reviews SET hidden = 1 WHERE id=?").run(num(fd, "id")); });
}
export async function deleteReview(fd: FormData) {
  await flow(fd, "/admin/reviews", "Review deleted", () => { getDb().prepare("DELETE FROM reviews WHERE id=?").run(num(fd, "id")); });
}

// ---------- specialties & procedures ----------
export async function saveSpecialty(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, "/admin/specialties", "Saved", () => {
    const db = getDb();
    if (id) {
      const name = str(fd, "name");
      if (!name) throw new Error("Name is required");
      db.prepare("UPDATE specialties SET name=?, slug=? WHERE id=?").run(name, slugify(name), id);
    } else createSpecialty(db, str(fd, "name"));
  });
}
export async function deleteSpecialty(fd: FormData) {
  await flow(fd, "/admin/specialties", "Deleted", () => { getDb().prepare("DELETE FROM specialties WHERE id=?").run(num(fd, "id")); });
}
export async function saveProcedure(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, "/admin/procedures", "Saved", () => {
    const db = getDb();
    if (id) {
      const name = str(fd, "name");
      if (!name) throw new Error("Name is required");
      db.prepare("UPDATE procedures SET name=?, slug=? WHERE id=?").run(name, slugify(name), id);
    } else createProcedure(db, num(fd, "specialty_id"), str(fd, "name"));
  });
}
export async function deleteProcedure(fd: FormData) {
  await flow(fd, "/admin/procedures", "Deleted", () => { getDb().prepare("DELETE FROM procedures WHERE id=?").run(num(fd, "id")); });
}

// ---------- submissions & removal requests ----------
export async function setSubmissionStatus(fd: FormData) {
  const status = str(fd, "status");
  if (!["pending", "approved", "rejected", "hidden"].includes(status)) throw new Error("bad status");
  await flow(fd, "/admin/submissions", "Updated", () => { getDb().prepare("UPDATE submissions SET status=? WHERE id=?").run(status, num(fd, "id")); });
}
export async function setRemovalStatus(fd: FormData) {
  const status = str(fd, "status");
  if (!["pending", "approved", "rejected"].includes(status)) throw new Error("bad status");
  await flow(fd, "/admin/removals", "Updated", () => { getDb().prepare("UPDATE removal_requests SET status=? WHERE id=?").run(status, num(fd, "id")); });
}

// ---------- Excel import ----------
export type ImportState = { error?: string; rows?: RowResult[]; raw?: string; committed?: boolean };

export async function previewImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an .xlsx file" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files are supported" };
  if (file.size > 8 * 1024 * 1024) return { error: "File is too large (max 8 MB)" };
  try {
    const raw = await parseWorkbook(await file.arrayBuffer());
    return { rows: runImport(getDb(), raw, false), raw: JSON.stringify(raw) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the file" };
  }
}

export async function commitImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  try {
    const raw = JSON.parse(str(fd, "raw")) as RawRow[];
    const rows = runImport(getDb(), raw, true);
    revalidatePath("/", "layout");
    return { rows, committed: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed" };
  }
}
