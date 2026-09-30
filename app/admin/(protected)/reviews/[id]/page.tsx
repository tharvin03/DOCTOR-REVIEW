import { notFound } from "next/navigation";
import Flash from "@/app/components/Flash";
import ReviewForm from "@/app/components/ReviewForm";
import { saveReview } from "../../../actions";
import { getDb } from "@/lib/db";
import { listSourceTypes } from "@/lib/repo";

export default async function EditReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const db = getDb();
  const r = await db.get<Record<string, string | number | null>>(
    `SELECT r.*, d.name AS doctor_name, d.specialty_id AS doctor_specialty_id, h.name AS hospital_name FROM reviews r
     JOIN doctors d ON d.id=r.doctor_id JOIN hospitals h ON h.id=r.hospital_id WHERE r.id=?`, Number((await params).id) || 0);
  if (!r) notFound();
  const specialties = await db.all<{ id: number; name: string }>("SELECT id, name FROM specialties ORDER BY name");
  return (
    <>
      <h1>Edit review #{r.id}</h1>
      <Flash {...(await searchParams)} />
      <ReviewForm action={saveReview} specialties={specialties} sourceTypes={await listSourceTypes(db)}
        procedures={await db.all<{ id: number; name: string; specialty_id: number }>("SELECT id, name, specialty_id FROM procedures ORDER BY name")} initial={{
        id: r.id as number, doctor: { id: r.doctor_id as number, name: r.doctor_name as string, specialtyId: r.doctor_specialty_id as number },
        procedureIds: (await db.all<{ procedure_id: number }>("SELECT procedure_id FROM review_procedures WHERE review_id=?", r.id as number)).map((x) => x.procedure_id),
        hospital: { id: r.hospital_id as number, name: r.hospital_name as string },
        review_text: r.review_text as string, reviewer_name: r.reviewer_name as string, review_date: r.review_date as string | null,
        source_type: r.source_type as string, source_link: r.source_link as string,
        tags: r.tags as string, hidden: r.hidden as number,
      }} />
    </>
  );
}
