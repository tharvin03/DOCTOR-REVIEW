import SubmitButton from "@/app/components/SubmitButton";
import ConfirmButton from "@/app/components/ConfirmButton";
import Flash from "@/app/components/Flash";
import { deleteProcedure, saveProcedure } from "../../actions";
import { getDb } from "@/lib/db";

export default async function Procedures({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const db = getDb();
  const specialties = await db.all<{ id: number; name: string }>("SELECT id, name FROM specialties ORDER BY name");
  const rows = await db.all<{ id: number; name: string; specialty: string }>("SELECT p.id, p.name, s.name AS specialty FROM procedures p JOIN specialties s ON s.id=p.specialty_id ORDER BY s.name, p.name");
  return (
    <>
      <h1>Procedures</h1>
      <Flash {...(await searchParams)} />
      <form action={saveProcedure} className="card row">
        <select name="specialty_id" required defaultValue="" style={{ width: "auto" }}><option value="" disabled>Specialty…</option>{specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="name" placeholder="New procedure (e.g. Knee replacement)" required style={{ flex: 1 }} /><SubmitButton className="btn" pendingText="Adding…">Add</SubmitButton>
      </form>
      {rows.map((p) => (
        <div className="card row" key={p.id}>
          <form action={saveProcedure} className="row" style={{ flex: 1 }}><input type="hidden" name="id" value={p.id} />
            <input name="name" defaultValue={p.name} required style={{ flex: 1 }} /><SubmitButton className="btn small secondary" pendingText="Saving…">Rename</SubmitButton></form>
          <span className="muted small">{p.specialty}</span>
          <form action={deleteProcedure}><input type="hidden" name="id" value={p.id} /><ConfirmButton message={`Delete ${p.name}?`}>Delete</ConfirmButton></form>
        </div>))}
    </>
  );
}
