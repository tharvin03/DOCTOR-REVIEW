"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, passwordMatches, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db";
import {
  createDoctor, createHospital, createProcedure, createSpecialty, findDoctorByName, findHospital,
  cleanYears, createSourceType, deleteSourceType, insertReview, linkDoctorHospital,
  updateDoctorName, updateHospital, updateReview, updateSourceType,
} from "@/lib/repo";
import { MAX_ROWS, runImport, parseWorkbook, type RawRow, type RowResult } from "@/lib/import";
import { slugify } from "@/lib/normalize";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0) || 0;
const nums = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter(Boolean);

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/foreign key/i.test(m)) return "Cannot delete: other records still reference this item (e.g. reviews or doctors). Hide it instead, or remove those first.";
  if (/duplicate key|UNIQUE/i.test(m)) return "That name already exists.";
  return m;
}

/** Runs fn then redirects with a flash message. redirect() must stay outside try/catch. */
async function flow(fd: FormData | null, back: string, ok: string, fn: () => Promise<string | void>) {
  await requireAdmin();
  let msg = ok, err = "";
  let dest = back;
  try {
    const r = await fn();
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
  await flow(fd, id ? `/admin/doctors/${id}` : "/admin/doctors/new", "Doctor saved", async () => {
    const newId = await getDb().tx(async (db) => {
      let did = id;
      if (did) {
        await updateDoctorName(db, did, str(fd, "name"));
        await db.run("UPDATE doctors SET specialty_id=?, short_description=?, qualifications=?, years_experience=?, hidden=? WHERE id=?",
          num(fd, "specialty_id"), str(fd, "short_description"), str(fd, "qualifications"),
          cleanYears(str(fd, "years_experience")), fd.get("hidden") ? 1 : 0, did);
      } else {
        did = await createDoctor(db, {
          name: str(fd, "name"), specialtyId: num(fd, "specialty_id"),
          description: str(fd, "short_description"), qualifications: str(fd, "qualifications"),
          yearsExperience: cleanYears(str(fd, "years_experience")), hidden: !!fd.get("hidden"),
        });
      }
      await db.run("DELETE FROM doctor_hospitals WHERE doctor_id=?", did);
      for (const h of nums(fd, "hospital_ids")) await linkDoctorHospital(db, did, h);
      return did;
    });
    return `/admin/doctors/${newId}`;
  });
}
export async function toggleDoctor(fd: FormData) {
  await flow(fd, "/admin/doctors", "Updated", async () => { await getDb().run("UPDATE doctors SET hidden = 1 - hidden WHERE id=?", num(fd, "id")); });
}
export async function deleteDoctor(fd: FormData) {
  await flow(fd, "/admin/doctors", "Doctor deleted (and their reviews)", async () => { await getDb().run("DELETE FROM doctors WHERE id=?", num(fd, "id")); });
}

// ---------- hospitals ----------
export async function saveHospital(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, id ? `/admin/hospitals/${id}` : "/admin/hospitals/new", "Hospital saved", async () => {
    const db = getDb();
    const input = { name: str(fd, "name"), city: str(fd, "city"), address: str(fd, "address") };
    if (id) await updateHospital(db, id, input);
    else return `/admin/hospitals/${await createHospital(db, input)}`;
  });
}
export async function deleteHospital(fd: FormData) {
  await flow(fd, "/admin/hospitals", "Hospital deleted", async () => { await getDb().run("DELETE FROM hospitals WHERE id=?", num(fd, "id")); });
}

// ---------- reviews ----------
async function resolveDoctor(db: Db, fd: FormData): Promise<number> {
  const id = num(fd, "doctor_id");
  if (id) {
    if (!(await db.get("SELECT 1 AS x FROM doctors WHERE id=?", id))) throw new Error("Selected doctor no longer exists");
    return id;
  }
  const name = str(fd, "doctor_new_name");
  if (!name) throw new Error("Pick an existing doctor or choose Create new");
  const existing = await findDoctorByName(db, name);
  if (existing) return existing.id; // never create a duplicate
  const specialtyId = num(fd, "doctor_new_specialty_id");
  if (!specialtyId) throw new Error("Choose a specialty for the new doctor");
  return createDoctor(db, { name, specialtyId });
}
async function resolveHospital(db: Db, fd: FormData): Promise<number> {
  const id = num(fd, "hospital_id");
  if (id) {
    if (!(await db.get("SELECT 1 AS x FROM hospitals WHERE id=?", id))) throw new Error("Selected hospital no longer exists");
    return id;
  }
  const name = str(fd, "hospital_new_name");
  if (!name) throw new Error("Pick an existing hospital or choose Create new");
  const city = str(fd, "hospital_new_city");
  return (await findHospital(db, name, city))?.id ?? (await createHospital(db, { name, city, address: str(fd, "hospital_new_address") }));
}

export async function saveReview(fd: FormData) {
  const id = num(fd, "id");
  const submissionId = num(fd, "submission_id");
  await flow(fd, id ? `/admin/reviews/${id}` : "/admin/reviews/new", "Review saved", () =>
    getDb().tx(async (db) => {
      const doctorId = await resolveDoctor(db, fd);
      const hospitalId = await resolveHospital(db, fd);
      await linkDoctorHospital(db, doctorId, hospitalId);
      const input = {
        doctorId, hospitalId, text: str(fd, "review_text"), reviewerName: str(fd, "reviewer_name"),
        date: str(fd, "review_date"), sourceType: str(fd, "source_type"), sourceLink: str(fd, "source_link"),
        tags: str(fd, "tags"), procedureIds: nums(fd, "procedure_ids"), hidden: !!fd.get("hidden"),
      };
      if (id) { await updateReview(db, id, input); return "/admin/reviews"; }
      await insertReview(db, input);
      if (submissionId) await db.run("UPDATE submissions SET status='approved' WHERE id=?", submissionId);
      return submissionId ? "/admin/submissions" : "/admin/reviews";
    }),
  );
}
export async function toggleReview(fd: FormData) {
  await flow(fd, str(fd, "back") || "/admin/reviews", "Updated", async () => { await getDb().run("UPDATE reviews SET hidden = 1 - hidden WHERE id=?", num(fd, "id")); });
}
export async function hideReview(fd: FormData) {
  await flow(fd, str(fd, "back") || "/admin/reviews", "Review hidden", async () => { await getDb().run("UPDATE reviews SET hidden = 1 WHERE id=?", num(fd, "id")); });
}
export async function deleteReview(fd: FormData) {
  await flow(fd, "/admin/reviews", "Review deleted", async () => { await getDb().run("DELETE FROM reviews WHERE id=?", num(fd, "id")); });
}

// ---------- specialties & procedures ----------
export async function saveSpecialty(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, "/admin/specialties", "Saved", async () => {
    const db = getDb();
    if (id) {
      const name = str(fd, "name");
      if (!name) throw new Error("Name is required");
      await db.run("UPDATE specialties SET name=?, slug=? WHERE id=?", name, slugify(name), id);
    } else await createSpecialty(db, str(fd, "name"));
  });
}
export async function deleteSpecialty(fd: FormData) {
  await flow(fd, "/admin/specialties", "Deleted", async () => { await getDb().run("DELETE FROM specialties WHERE id=?", num(fd, "id")); });
}
export async function saveProcedure(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, "/admin/procedures", "Saved", async () => {
    const db = getDb();
    if (id) {
      const name = str(fd, "name");
      if (!name) throw new Error("Name is required");
      await db.run("UPDATE procedures SET name=?, slug=? WHERE id=?", name, slugify(name), id);
    } else await createProcedure(db, num(fd, "specialty_id"), str(fd, "name"));
  });
}
export async function deleteProcedure(fd: FormData) {
  await flow(fd, "/admin/procedures", "Deleted", async () => { await getDb().run("DELETE FROM procedures WHERE id=?", num(fd, "id")); });
}

// ---------- source types ----------
export async function saveSourceType(fd: FormData) {
  const id = num(fd, "id");
  await flow(fd, "/admin/source-types", "Saved", async () => {
    const db = getDb();
    if (id) await updateSourceType(db, id, str(fd, "name"), !!fd.get("requires_link"));
    else await createSourceType(db, str(fd, "name"), !!fd.get("requires_link"));
  });
}
export async function removeSourceType(fd: FormData) {
  await flow(fd, "/admin/source-types", "Deleted", async () => { await deleteSourceType(getDb(), num(fd, "id")); });
}

// ---------- submissions & removal requests ----------
export async function setSubmissionStatus(fd: FormData) {
  const status = str(fd, "status");
  if (!["pending", "approved", "rejected", "hidden"].includes(status)) throw new Error("bad status");
  await flow(fd, "/admin/submissions", "Updated", async () => { await getDb().run("UPDATE submissions SET status=? WHERE id=?", status, num(fd, "id")); });
}
export async function setRemovalStatus(fd: FormData) {
  const status = str(fd, "status");
  if (!["pending", "approved", "rejected"].includes(status)) throw new Error("bad status");
  await flow(fd, "/admin/removals", "Updated", async () => { await getDb().run("UPDATE removal_requests SET status=? WHERE id=?", status, num(fd, "id")); });
}

// ---------- Excel import ----------
export type ImportState = { error?: string; rows?: RowResult[]; raw?: string; committed?: boolean };

export async function previewImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an .xlsx file" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files are supported" };
  if (file.size > 3 * 1024 * 1024) return { error: "File is too large (max 3 MB)" };
  try {
    const raw = await parseWorkbook(await file.arrayBuffer());
    return { rows: await runImport(getDb(), raw, false), raw: JSON.stringify(raw) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the file" };
  }
}

export async function commitImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  try {
    const raw = JSON.parse(str(fd, "raw")) as RawRow[];
    if (!Array.isArray(raw) || raw.length > MAX_ROWS) throw new Error("Invalid import data");
    const rows = await runImport(getDb(), raw, true);
    revalidatePath("/", "layout");
    return { rows, committed: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed" };
  }
}
