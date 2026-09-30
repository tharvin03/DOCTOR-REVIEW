import SubmitButton from "@/app/components/SubmitButton";
import ConfirmButton from "@/app/components/ConfirmButton";
import Flash from "@/app/components/Flash";
import { removeSourceType, saveSourceType } from "../../actions";
import { getDb } from "@/lib/db";

export default async function SourceTypes({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const rows = await getDb().all<{ id: number; name: string; requires_link: number; reviews: number }>(
    `SELECT t.id, t.name, t.requires_link, (SELECT COUNT(*) FROM reviews r WHERE r.source_type = t.name) AS reviews
     FROM source_types t ORDER BY t.name`);
  return (
    <>
      <h1>Source types</h1>
      <p className="muted small">Where a review came from (Google, Instagram, YouTube…). Add each one once, then pick it from a dropdown when adding reviews. The public source button shows this name. Renaming updates every review that uses it.</p>
      <Flash {...(await searchParams)} />
      <form action={saveSourceType} className="card row">
        <input name="name" placeholder="New source type (e.g. TikTok video)" required style={{ flex: 1, minWidth: 180 }} />
        <label className="check" style={{ margin: 0 }}><input type="checkbox" name="requires_link" defaultChecked /> Link required</label>
        <SubmitButton className="btn" pendingText="Adding…">Add</SubmitButton>
      </form>
      {rows.map((t) => (
        <div className="card row" key={t.id}>
          <form action={saveSourceType} className="row" style={{ flex: 1 }}>
            <input type="hidden" name="id" value={t.id} />
            <input name="name" defaultValue={t.name} required style={{ flex: 1, minWidth: 160 }} />
            <label className="check" style={{ margin: 0 }}><input type="checkbox" name="requires_link" defaultChecked={!!t.requires_link} /> Link required</label>
            <SubmitButton className="btn small secondary" pendingText="Saving…">Save</SubmitButton>
          </form>
          <span className="muted small">{t.reviews} review(s)</span>
          <form action={removeSourceType}><input type="hidden" name="id" value={t.id} /><ConfirmButton message={`Delete ${t.name}?`}>Delete</ConfirmButton></form>
        </div>))}
    </>
  );
}
