import type { DB } from "./db";
import {
  createDoctor, createHospital, createProcedure, createSpecialty, insertReview, linkDoctorHospital,
} from "./repo";

/** Idempotent-ish demo data. Refuses to run on a non-empty database. */
export function seed(db: DB) {
  if ((db.prepare("SELECT COUNT(*) c FROM specialties").get() as { c: number }).c > 0) return false;
  const tx = db.transaction(() => {
    const ortho = createSpecialty(db, "Orthopedics");
    const procs: Record<string, number> = {};
    for (const p of [
      "Knee replacement", "Knee ligament surgery", "Meniscus repair", "Hip replacement",
      "Shoulder arthroscopy", "Rotator cuff repair", "Spinal fusion", "Fracture fixation",
    ]) procs[p] = createProcedure(db, ortho, p);

    const h1 = createHospital(db, { name: "Example Specialist Hospital KL", city: "KL", address: "1 Jalan Contoh, 50450 Kuala Lumpur" });
    const h2 = createHospital(db, { name: "Example Medical Centre Melaka", city: "Melaka", address: "2 Jalan Sampel, 75450 Melaka" });

    const mk = (name: string, desc: string, hospitals: number[], ps: string[]) => {
      const id = createDoctor(db, { name, specialtyId: ortho, description: desc });
      hospitals.forEach((h) => linkDoctorHospital(db, id, h));
      ps.forEach((p) => db.prepare("INSERT INTO doctor_procedures VALUES (?,?)").run(id, procs[p]));
      return id;
    };
    const tan = mk("Dr Tan Example", "Sample profile: consultant orthopedic surgeon focusing on knee and sports injuries.", [h1], ["Knee replacement", "Knee ligament surgery", "Meniscus repair"]);
    const lim = mk("Dr Lim Sample", "Sample profile: orthopedic surgeon treating shoulder and hip conditions.", [h1, h2], ["Shoulder arthroscopy", "Rotator cuff repair", "Hip replacement"]);
    const aziz = mk("Dr Aziz Demo", "Sample profile: orthopedic and spine surgeon based in Melaka.", [h2], ["Spinal fusion", "Fracture fixation", "Knee replacement"]);
    mk("Dr Hidden Example", "Hidden sample doctor (never shown publicly).", [h1], ["Hip replacement"]);
    db.prepare("UPDATE doctors SET hidden = 1 WHERE name_norm = 'hidden example'").run();

    const r = (doctorId: number, hospitalId: number, o: Partial<Parameters<typeof insertReview>[1]> & { text: string }) =>
      insertReview(db, { doctorId, hospitalId, sourceType: "Google review", sourceLink: "https://example.com/reviews/" + Math.random().toString(36).slice(2, 8), ...o });
    r(tan, h1, { text: "SAMPLE REVIEW. Explained the ACL reconstruction options clearly and the recovery went smoothly. Physiotherapy plan was well laid out and follow-ups were on time. Would recommend to other athletes dealing with ligament injuries.", reviewerName: "Sample Patient A", date: "2025-03-14", tags: "ACL, MCL", sourceTitle: "Google review" });
    r(tan, h1, { text: "SAMPLE REVIEW. Knee replacement went well; walking with a cane after two weeks.", date: "2025-06-02", tags: "Knee replacement", sourceType: "Article", sourceTitle: "News feature (sample)" });
    r(lim, h1, { text: "SAMPLE REVIEW. Shoulder pain resolved after arthroscopy. The consultation was thorough and unhurried.", date: "2025-01-20", tags: "Shoulder", sourceType: "Forum or social post", sourceTitle: "Forum thread (sample)" });
    r(aziz, h2, { text: "SAMPLE REVIEW. Submitted by a patient directly, no external link.", date: "2025-08-09", tags: "Fracture", sourceType: "Patient submission", sourceLink: "" });
    return true;
  });
  return tx();
}
