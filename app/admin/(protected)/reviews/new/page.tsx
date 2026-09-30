import Flash from "@/app/components/Flash";
import ReviewForm from "@/app/components/ReviewForm";
import { saveReview } from "../../../actions";
import { getDb } from "@/lib/db";

export default async function NewReview({ searchParams }: { searchParams: Promise<{ err?: string; submission?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const specialties = db.prepare("SELECT id, name FROM specialties ORDER BY name").all() as { id: number; name: string }[];
  // Optionally prefill from a pending submission ("turn into review").
  const sub = sp.submission
    ? (db.prepare("SELECT id, message, link FROM submissions WHERE id=?").get(Number(sp.submission)) as { id: number; message: string; link: string } | undefined)
    : undefined;
  return (
    <>
      <h1>Add review</h1>
      <Flash err={sp.err} />
      {sub && <p className="notice">Prefilled from submission #{sub.id}. Pick the doctor and hospital, then save; the submission will be marked approved.</p>}
      <ReviewForm action={saveReview} specialties={specialties}
        initial={sub ? { review_text: sub.message, source_link: sub.link, source_type: sub.link ? "Other" : "Patient submission", submission_id: sub.id } : {}} />
    </>
  );
}
