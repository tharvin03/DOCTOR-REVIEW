"use client";
import { useState } from "react";
import { EntityPicker } from "./EntityPicker";

type Initial = {
  id?: number; doctor?: { id: number; name: string; specialtyId: number }; hospital?: { id: number; name: string };
  procedureIds?: number[];
  review_text?: string; reviewer_name?: string; review_date?: string | null; source_type?: string;
  source_link?: string; tags?: string; hidden?: number; submission_id?: number;
};

export default function ReviewForm({
  action, specialties, sourceTypes, procedures, initial = {},
}: {
  action: (fd: FormData) => Promise<void>;
  specialties: { id: number; name: string }[];
  sourceTypes: { name: string; requires_link: number }[];
  procedures: { id: number; name: string; specialty_id: number }[];
  initial?: Initial;
}) {
  const wanted = sourceTypes.find((t) => t.name.toLowerCase() === (initial.source_type ?? "Google review").toLowerCase());
  const [type, setType] = useState((wanted ?? sourceTypes[0])?.name ?? "");
  const [specialtyId, setSpecialtyId] = useState<number | null>(initial.doctor?.specialtyId ?? null);
  const [picked, setPicked] = useState<Set<number>>(new Set(initial.procedureIds ?? []));
  const available = procedures.filter((p) => p.specialty_id === specialtyId);
  const linkRequired = !!sourceTypes.find((t) => t.name === type)?.requires_link;
  return (
    <form action={action} className="stack">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.submission_id && <input type="hidden" name="submission_id" value={initial.submission_id} />}
      <EntityPicker kind="doctor" label="Doctor" initial={initial.doctor} specialties={specialties}
        onSpecialty={(id) => { setSpecialtyId(id); setPicked(new Set()); }} />
      <EntityPicker kind="hospital" label="Hospital" initial={initial.hospital} />
      <div>
        <label>Procedures this review is about <span className="muted">(optional, but this is what people search by)</span></label>
        {specialtyId === null ? (
          <p className="muted small" style={{ margin: 0 }}>Choose the doctor first, then tick the procedures.</p>
        ) : available.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>This specialty has no procedures yet. <a href="/admin/procedures">Add some under Procedures</a>.</p>
        ) : (
          <div className="checklist">
            {available.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" name="procedure_ids" value={p.id} checked={picked.has(p.id)}
                  onChange={(e) => setPicked((prev) => { const n = new Set(prev); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <div><label htmlFor="rt">Review text (full)</label>
        <textarea id="rt" name="review_text" required defaultValue={initial.review_text} style={{ minHeight: 160 }} /></div>
      <div className="grid2">
        <div><label htmlFor="rn">Reviewer name (optional)</label><input id="rn" name="reviewer_name" type="text" defaultValue={initial.reviewer_name} /></div>
        <div><label htmlFor="rd">Review date</label><input id="rd" name="review_date" type="date" defaultValue={initial.review_date ?? ""} /></div>
        <div><label htmlFor="st">Source type</label>
          <select id="st" name="source_type" value={type} onChange={(e) => setType(e.target.value)} required>
            {sourceTypes.map((s) => <option key={s.name}>{s.name}</option>)}</select>
          <span className="muted small">Missing one? <a href="/admin/source-types">Add it under Source types</a>. The source button shows this name.</span></div>
        <div><label htmlFor="sl">Source link {linkRequired ? "(required)" : "(optional)"}</label>
          <input id="sl" name="source_link" type="url" placeholder="https://" required={linkRequired} defaultValue={initial.source_link} /></div>
        <div><label htmlFor="tg">Tags</label><input id="tg" name="tags" type="text" placeholder="ACL, MCL" defaultValue={initial.tags} /></div>
      </div>
      <label className="check"><input type="checkbox" name="hidden" defaultChecked={!!initial.hidden} /> Hidden (not shown publicly)</label>
      <button className="btn">Save review</button>
    </form>
  );
}
