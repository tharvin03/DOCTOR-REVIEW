import Link from "next/link";
import ConfirmButton from "@/app/components/ConfirmButton";
import Flash from "@/app/components/Flash";
import { deleteReview, toggleReview } from "../../actions";
import { getDb } from "@/lib/db";

export default async function Reviews({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string }> }) {
  const sp = await searchParams;
  const like = `%${(sp.q ?? "").trim().toLowerCase()}%`;
  const rows = getDb().prepare(
    `SELECT r.id, r.review_text, r.review_date, r.source_type, r.hidden, d.name doctor, h.name hospital
     FROM reviews r JOIN doctors d ON d.id=r.doctor_id JOIN hospitals h ON h.id=r.hospital_id
     WHERE d.name_norm LIKE ? OR lower(r.review_text) LIKE ? ORDER BY r.id DESC LIMIT 200`,
  ).all(like, like) as { id: number; review_text: string; review_date: string | null; source_type: string; hidden: number; doctor: string; hospital: string }[];
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}><h1>Reviews</h1><Link className="btn" href="/admin/reviews/new">Add review</Link></div>
      <Flash {...sp} />
      <form className="row" style={{ marginBottom: 12 }}><input type="search" name="q" defaultValue={sp.q} placeholder="Search doctor or text" style={{ flex: 1 }} /><button className="btn secondary">Search</button></form>
      <div className="table-scroll"><table>
        <thead><tr><th>Doctor / hospital</th><th>Review</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td>{r.doctor}<br /><span className="muted small">{r.hospital}</span></td>
            <td className="small"><Link href={`/admin/reviews/${r.id}`}>{r.review_text.slice(0, 120)}{r.review_text.length > 120 ? "…" : ""}</Link><br />
              <span className="muted">{r.source_type} · {r.review_date ?? "no date"}</span> {r.hidden ? <span className="pill bad">hidden</span> : null}</td>
            <td><div className="row">
              <form action={toggleReview}><input type="hidden" name="id" value={r.id} /><button className="btn small secondary">{r.hidden ? "Unhide" : "Hide"}</button></form>
              <form action={deleteReview}><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete this review permanently?">Delete</ConfirmButton></form>
            </div></td>
          </tr>))}</tbody>
      </table></div>
    </>
  );
}
