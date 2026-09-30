import Link from "next/link";
import Flash from "@/app/components/Flash";
import { setSubmissionStatus } from "../../actions";
import { getDb } from "@/lib/db";

type Sub = { id: number; message: string; link: string; consent: number; created_at: string; status: string };

export default async function Submissions({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; status?: string }> }) {
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected", "hidden"].includes(sp.status ?? "") ? sp.status! : "pending";
  const rows = getDb().prepare("SELECT * FROM submissions WHERE status=? ORDER BY id DESC").all(status) as Sub[];
  const btn = (s: string, id: number, label: string, cls = "secondary") => (
    <form action={setSubmissionStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={s} /><button className={`btn small ${cls}`}>{label}</button></form>
  );
  return (
    <>
      <h1>Submissions</h1>
      <Flash {...sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        {["pending", "approved", "rejected", "hidden"].map((s) => <Link key={s} href={`/admin/submissions?status=${s}`} className={`pill ${s === status ? "ok" : ""}`}>{s}</Link>)}
      </div>
      {rows.length === 0 && <p className="muted">Nothing here.</p>}
      {rows.map((s) => (
        <div className="card" key={s.id}>
          <div className="muted small">#{s.id} · {s.created_at} · consent: {s.consent ? "yes" : "no"}</div>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{s.message}</p>
          {s.link && <p className="small">Link: <a href={s.link} target="_blank" rel="noopener noreferrer nofollow">{s.link}</a></p>}
          <div className="row">
            {s.status !== "approved" && btn("approved", s.id, "Approve", "")}
            {s.status !== "rejected" && btn("rejected", s.id, "Reject")}
            {s.status !== "hidden" && btn("hidden", s.id, "Hide")}
            {s.status !== "pending" && btn("pending", s.id, "Back to pending")}
            <Link className="btn small secondary" href={`/admin/reviews/new?submission=${s.id}`}>Turn into review</Link>
          </div>
        </div>))}
    </>
  );
}
