import ConfirmButton from "@/app/components/ConfirmButton";
import Flash from "@/app/components/Flash";
import { deleteSpecialty, saveSpecialty } from "../../actions";
import { getDb } from "@/lib/db";

export default async function Specialties({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const rows = await getDb().all<{ id: number; name: string; doctors: number }>("SELECT s.id, s.name, (SELECT COUNT(*) FROM doctors WHERE specialty_id=s.id) AS doctors FROM specialties s ORDER BY s.name");
  return (
    <>
      <h1>Specialties</h1>
      <Flash {...(await searchParams)} />
      <form action={saveSpecialty} className="card row"><input name="name" placeholder="New specialty" required style={{ flex: 1 }} /><button className="btn">Add</button></form>
      {rows.map((s) => (
        <div className="card row" key={s.id}>
          <form action={saveSpecialty} className="row" style={{ flex: 1 }}><input type="hidden" name="id" value={s.id} />
            <input name="name" defaultValue={s.name} required style={{ flex: 1 }} /><button className="btn small secondary">Rename</button></form>
          <span className="muted small">{s.doctors} doctor(s)</span>
          <form action={deleteSpecialty}><input type="hidden" name="id" value={s.id} /><ConfirmButton message={`Delete ${s.name} and its procedures?`}>Delete</ConfirmButton></form>
        </div>))}
    </>
  );
}
