import Link from "next/link";
import ConfirmButton from "@/app/components/ConfirmButton";
import Flash from "@/app/components/Flash";
import { deleteDoctor, toggleDoctor } from "../../actions";
import { getDb } from "@/lib/db";

export default async function Doctors({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; q?: string }> }) {
  const sp = await searchParams;
  const like = `%${(sp.q ?? "").trim().toLowerCase()}%`;
  const rows = await getDb().all<{ id: number; name: string; slug: string; hidden: number; specialty: string; reviews: number; hospitals: string | null }>(
    `SELECT d.id, d.name, d.slug, d.hidden, s.name AS specialty,
      (SELECT COUNT(*) FROM reviews r WHERE r.doctor_id=d.id) AS reviews,
      (SELECT string_agg(h.name, ', ') FROM doctor_hospitals dh JOIN hospitals h ON h.id=dh.hospital_id WHERE dh.doctor_id=d.id) AS hospitals
     FROM doctors d JOIN specialties s ON s.id=d.specialty_id WHERE d.name_norm LIKE ? ORDER BY d.name`, like);
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}><h1>Doctors</h1><Link className="btn" href="/admin/doctors/new">Add doctor</Link></div>
      <Flash {...sp} />
      <form className="row" style={{ marginBottom: 12 }}><input type="search" name="q" defaultValue={sp.q} placeholder="Filter by name" style={{ flex: 1 }} /><button className="btn secondary">Filter</button></form>
      <div className="table-scroll"><table>
        <thead><tr><th>Name</th><th>Specialty / hospitals</th><th>Reviews</th><th></th></tr></thead>
        <tbody>{rows.map((d) => (
          <tr key={d.id}>
            <td><Link href={`/admin/doctors/${d.id}`}>{d.name}</Link> {d.hidden ? <span className="pill bad">hidden</span> : null}</td>
            <td className="small">{d.specialty}<br /><span className="muted">{d.hospitals}</span></td>
            <td>{d.reviews}</td>
            <td><div className="row">
              <form action={toggleDoctor}><input type="hidden" name="id" value={d.id} /><button className="btn small secondary">{d.hidden ? "Unhide" : "Hide"}</button></form>
              <form action={deleteDoctor}><input type="hidden" name="id" value={d.id} /><ConfirmButton message={`Delete ${d.name} and all of their reviews?`}>Delete</ConfirmButton></form>
            </div></td>
          </tr>))}</tbody>
      </table></div>
    </>
  );
}
