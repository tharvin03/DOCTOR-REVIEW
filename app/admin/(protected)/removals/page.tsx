import SubmitButton from "@/app/components/SubmitButton";
import Link from "@/app/components/PLink";
import Flash from "@/app/components/Flash";
import { hideReview, setRemovalStatus } from "../../actions";
import { getDb } from "@/lib/db";

type Req = { id: number; name: string; review_link: string; reason: string; status: string; created_at: string };
type Match = { id: number; review_text: string; hidden: number; doctor: string };

/** Reviews a removal request may refer to: our own #review-ID anchors, or the original source link. */
async function matchReviews(link: string): Promise<Match[]> {
  const db = getDb();
  const sel = `SELECT r.id, r.review_text, r.hidden, d.name AS doctor FROM reviews r JOIN doctors d ON d.id=r.doctor_id`;
  const out = new Map<number, Match>();
  const anchor = link.match(/#review-(\d+)/);
  if (anchor) for (const m of await db.all<Match>(`${sel} WHERE r.id=?`, Number(anchor[1]))) out.set(m.id, m);
  const clean = link.trim().replace(/\/+$/, "");
  if (clean) for (const m of await db.all<Match>(`${sel} WHERE r.source_link != '' AND rtrim(r.source_link,'/') = ?`, clean)) out.set(m.id, m);
  return [...out.values()];
}

export default async function Removals({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string }> }) {
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(sp.status ?? "") ? sp.status! : "pending";
  const rows = await getDb().all<Req>("SELECT * FROM removal_requests WHERE status=? ORDER BY id DESC", status);
  const back = `/admin/removals?status=${status}`;
  const setBtn = (s: string, id: number, label: string, cls = "secondary") => (
    <form action={setRemovalStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={s} /><SubmitButton className={`btn small ${cls}`}>{label}</SubmitButton></form>
  );
  return (
    <>
      <h1>Removal requests</h1>
      <Flash {...sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        {["pending", "approved", "rejected"].map((s) => <Link key={s} href={`/admin/removals?status=${s}`} className={`pill ${s === status ? "ok" : ""}`}>{s}</Link>)}
      </div>
      {rows.length === 0 && <p className="muted">Nothing here.</p>}
      {await Promise.all(rows.map(async (q) => {
        const matches = await matchReviews(q.review_link);
        return (
          <div className="card" key={q.id}>
            <div className="muted small">#{q.id} · {q.created_at} · from {q.name}</div>
            <p className="small" style={{ overflowWrap: "anywhere" }}>Link: {q.review_link}</p>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{q.reason}</p>
            {matches.length > 0 ? matches.map((m) => (
              <div className="notice" key={m.id} style={{ marginBottom: 8 }}>
                Matching review #{m.id} ({m.doctor}): {m.review_text.slice(0, 100)}… {m.hidden ? <span className="pill bad">hidden</span> :
                  <form action={hideReview} style={{ display: "inline" }}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} /><SubmitButton className="btn small danger">Hide review</SubmitButton></form>}
                {" "}<Link href={`/admin/reviews/${m.id}`}>Open</Link>
              </div>)) : <p className="muted small">No review matched this link automatically. Find it under Reviews.</p>}
            <div className="row">
              {q.status !== "approved" && setBtn("approved", q.id, "Approve", "")}
              {q.status !== "rejected" && setBtn("rejected", q.id, "Reject")}
              {q.status !== "pending" && setBtn("pending", q.id, "Back to pending")}
            </div>
          </div>);
      }))}
    </>
  );
}
