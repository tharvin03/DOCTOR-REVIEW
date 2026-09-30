import Flash from "@/app/components/Flash";
import ReviewForm from "@/app/components/ReviewForm";
import { saveReview } from "../../../actions";
import { getDb } from "@/lib/db";
import { listSourceTypes } from "@/lib/repo";

export default async function NewReview({ searchParams }: { searchParams: Promise<{ err?: string; submission?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const specialties = await db.all<{ id: number; name: string }>("SELECT id, name FROM specialties ORDER BY name");
  // Optionally prefill from a pending submission ("turn into review").
  const sub = sp.submission
    ? await db.get<{ id: number; message: string; link: string }>("SELECT id, message, link FROM submissions WHERE id=?", Number(sp.submission) || 0)
    : undefined;
  return (
    <>
      <h1>Add review</h1>
      <Flash err={sp.err} />
      {sub && <p className="notice">Prefilled from submission #{sub.id}. Pick the doctor and hospital, then save; the submission will be marked approved.</p>}
      <ReviewForm action={saveReview} specialties={specialties} sourceTypes={await listSourceTypes(db)}
        procedures={await db.all<{ id: number; name: string; specialty_id: number }>("SELECT id, name, specialty_id FROM procedures ORDER BY name")}
        initial={sub ? { review_text: sub.message, source_link: sub.link, source_type: sub.link ? "Other" : "Patient submission", submission_id: sub.id } : {}} />
    </>
  );
}
