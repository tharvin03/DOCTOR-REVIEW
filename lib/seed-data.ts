import type { Db } from "./db";
import {
  createDoctor, createHospital, createProcedure, createSpecialty, insertReview, linkDoctorHospital, linkDoctorProcedure,
} from "./repo";

/** Demo data. Refuses to run on a non-empty database. */
export async function seed(db: Db): Promise<boolean> {
  if (((await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM specialties"))?.c ?? 0) > 0) return false;
  await db.tx(async (t) => {
    const ortho = await createSpecialty(t, "Orthopedics");
    const procs: Record<string, number> = {};
    for (const p of [
      "Knee replacement", "Knee ligament surgery", "Meniscus repair", "Hip replacement",
      "Shoulder arthroscopy", "Rotator cuff repair", "Spinal fusion", "Fracture fixation",
    ]) procs[p] = await createProcedure(t, ortho, p);

    const h1 = await createHospital(t, { name: "Example Specialist Hospital KL", city: "KL", address: "1 Jalan Contoh, 50450 Kuala Lumpur" });
    const h2 = await createHospital(t, { name: "Example Medical Centre Melaka", city: "Melaka", address: "2 Jalan Sampel, 75450 Melaka" });

    const mk = async (name: string, desc: string, hospitals: number[], ps: string[], hidden = false) => {
      const id = await createDoctor(t, { name, specialtyId: ortho, description: desc, hidden });
      for (const h of hospitals) await linkDoctorHospital(t, id, h);
      for (const p of ps) await linkDoctorProcedure(t, id, procs[p]);
      return id;
    };
    const tan = await mk("Dr Tan Example", "Sample profile: consultant orthopedic surgeon focusing on knee and sports injuries.", [h1], ["Knee replacement", "Knee ligament surgery", "Meniscus repair"]);
    const lim = await mk("Dr Lim Sample", "Sample profile: orthopedic surgeon treating shoulder and hip conditions.", [h1, h2], ["Shoulder arthroscopy", "Rotator cuff repair", "Hip replacement"]);
    const aziz = await mk("Dr Aziz Demo", "Sample profile: orthopedic and spine surgeon based in Melaka.", [h2], ["Spinal fusion", "Fracture fixation", "Knee replacement"]);
    await mk("Dr Hidden Example", "Hidden sample doctor (never shown publicly).", [h1], ["Hip replacement"], true);

    const r = (doctorId: number, hospitalId: number, o: Partial<Parameters<typeof insertReview>[1]> & { text: string }) =>
      insertReview(t, { doctorId, hospitalId, sourceType: "Google review", sourceLink: "https://example.com/reviews/" + Math.random().toString(36).slice(2, 8), ...o });
    await r(tan, h1, { text: "SAMPLE REVIEW. Explained the ACL reconstruction options clearly and the recovery went smoothly. Physiotherapy plan was well laid out and follow-ups were on time. Would recommend to other athletes dealing with ligament injuries.", reviewerName: "Sample Patient A", date: "2025-03-14", tags: "ACL, MCL" });
    await r(tan, h1, { text: "SAMPLE REVIEW. Knee replacement went well; walking with a cane after two weeks.", date: "2025-06-02", tags: "Knee replacement", sourceType: "Article" });
    await r(lim, h1, { text: "SAMPLE REVIEW. Shoulder pain resolved after arthroscopy. The consultation was thorough and unhurried.", date: "2025-01-20", tags: "Shoulder", sourceType: "Forum or social post" });
    await r(aziz, h2, { text: "SAMPLE REVIEW. Submitted by a patient directly, no external link.", date: "2025-08-09", tags: "Fracture", sourceType: "Patient submission", sourceLink: "" });
  });
  return true;
}
