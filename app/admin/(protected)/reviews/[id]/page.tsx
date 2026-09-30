import { notFound } from "next/navigation";
import Flash from "@/app/components/Flash";
import ReviewForm from "@/app/components/ReviewForm";
import { saveReview } from "../../../actions";
import { getDb } from "@/lib/db";

export default async function EditReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const db = getDb();
  const r = db.prepare(
    `SELECT r.*, d.name doctor_name, h.name hospital_name FROM reviews r
     JOIN doctors d ON d.id=r.doctor_id JOIN hospitals h ON h.id=r.hospital_id WHERE r.id=?`,
  ).get(Number((await params).id)) as Record<string, string | number | null> | undefined;
  if (!r) notFound();
  const specialties = db.prepare("SELECT id, name FROM specialties ORDER BY name").all() as { id: number; name: string }[];
  return (
    <>
      <h1>Edit review #{r.id}</h1>
      <Flash {...(await searchParams)} />
      <ReviewForm action={saveReview} specialties={specialties} initial={{
        id: r.id as number, doctor: { id: r.doctor_id as number, name: r.doctor_name as string },
        hospital: { id: r.hospital_id as number, name: r.hospital_name as string },
        review_text: r.review_text as string, reviewer_name: r.reviewer_name as string, review_date: r.review_date as string | null,
        source_type: r.source_type as string, source_link: r.source_link as string, source_title: r.source_title as string,
        tags: r.tags as string, hidden: r.hidden as number,
      }} />
    </>
  );
}
