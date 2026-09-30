import { NameCheck } from "./EntityPicker";
import { saveDoctor } from "@/app/admin/actions";
import { getDb } from "@/lib/db";

type Doc = { id: number; name: string; specialty_id: number; short_description: string; hidden: number };

export default async function DoctorForm({ doctor }: { doctor?: Doc }) {
  const db = getDb();
  const [specialties, hospitals, procedures, hs, ps] = await Promise.all([
    db.all<{ id: number; name: string }>("SELECT id, name FROM specialties ORDER BY name"),
    db.all<{ id: number; name: string; city: string }>("SELECT id, name, city FROM hospitals ORDER BY name"),
    db.all<{ id: number; name: string; specialty: string }>("SELECT p.id, p.name, s.name AS specialty FROM procedures p JOIN specialties s ON s.id=p.specialty_id ORDER BY s.name, p.name"),
    doctor ? db.all<{ x: number }>("SELECT hospital_id AS x FROM doctor_hospitals WHERE doctor_id=?", doctor.id) : Promise.resolve([]),
    doctor ? db.all<{ x: number }>("SELECT procedure_id AS x FROM doctor_procedures WHERE doctor_id=?", doctor.id) : Promise.resolve([]),
  ]);
  const chosenH = new Set(hs.map((r) => r.x));
  const chosenP = new Set(ps.map((r) => r.x));
  return (
    <form action={saveDoctor} className="stack">
      {doctor && <input type="hidden" name="id" value={doctor.id} />}
      <NameCheck kind="doctor" defaultValue={doctor?.name} excludeId={doctor?.id} label="Doctor name (search first to avoid duplicates)" />
      <div><label htmlFor="sp">Specialty</label>
        <select id="sp" name="specialty_id" required defaultValue={doctor?.specialty_id ?? ""}>
          <option value="" disabled>Select…</option>{specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label htmlFor="sd">Short description</label><textarea id="sd" name="short_description" defaultValue={doctor?.short_description} /></div>
      <div><label>Hospitals</label><div className="checklist">
        {hospitals.map((h) => <label key={h.id} className="check"><input type="checkbox" name="hospital_ids" value={h.id} defaultChecked={chosenH.has(h.id)} />{h.name} ({h.city})</label>)}
        {hospitals.length === 0 && <span className="muted">No hospitals yet.</span>}</div></div>
      <div><label>Procedures</label><div className="checklist">
        {procedures.map((p) => <label key={p.id} className="check"><input type="checkbox" name="procedure_ids" value={p.id} defaultChecked={chosenP.has(p.id)} />{p.name} <span className="muted small">({p.specialty})</span></label>)}</div></div>
      <label className="check"><input type="checkbox" name="hidden" defaultChecked={!!doctor?.hidden} /> Hidden (not shown publicly)</label>
      <button className="btn">Save doctor</button>
    </form>
  );
}
