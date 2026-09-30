import Link from "next/link";
import ConfirmButton from "@/app/components/ConfirmButton";
import Flash from "@/app/components/Flash";
import { deleteHospital } from "../../actions";
import { getDb } from "@/lib/db";

export default async function Hospitals({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const rows = getDb().prepare(
    `SELECT h.id, h.name, h.city, (SELECT COUNT(*) FROM doctor_hospitals WHERE hospital_id=h.id) doctors,
     (SELECT COUNT(*) FROM reviews WHERE hospital_id=h.id) reviews FROM hospitals h ORDER BY h.city, h.name`,
  ).all() as { id: number; name: string; city: string; doctors: number; reviews: number }[];
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}><h1>Hospitals</h1><Link className="btn" href="/admin/hospitals/new">Add hospital</Link></div>
      <Flash {...(await searchParams)} />
      <div className="table-scroll"><table>
        <thead><tr><th>Name</th><th>City</th><th>Doctors</th><th>Reviews</th><th></th></tr></thead>
        <tbody>{rows.map((h) => (
          <tr key={h.id}><td><Link href={`/admin/hospitals/${h.id}`}>{h.name}</Link></td><td>{h.city}</td><td>{h.doctors}</td><td>{h.reviews}</td>
            <td><form action={deleteHospital}><input type="hidden" name="id" value={h.id} /><ConfirmButton message={`Delete ${h.name}?`}>Delete</ConfirmButton></form></td></tr>))}</tbody>
      </table></div>
    </>
  );
}
