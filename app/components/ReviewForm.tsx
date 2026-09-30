"use client";
import { useState } from "react";
import { EntityPicker } from "./EntityPicker";
import { SOURCE_TYPES } from "@/lib/constants";

type Initial = {
  id?: number; doctor?: { id: number; name: string }; hospital?: { id: number; name: string };
  review_text?: string; reviewer_name?: string; review_date?: string | null; source_type?: string;
  source_link?: string; source_title?: string; tags?: string; hidden?: number; submission_id?: number;
};

export default function ReviewForm({
  action, specialties, initial = {},
}: { action: (fd: FormData) => Promise<void>; specialties: { id: number; name: string }[]; initial?: Initial }) {
  const [type, setType] = useState(initial.source_type ?? "Google review");
  const linkRequired = type !== "Patient submission";
  return (
    <form action={action} className="stack">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.submission_id && <input type="hidden" name="submission_id" value={initial.submission_id} />}
      <EntityPicker kind="doctor" label="Doctor" initial={initial.doctor} specialties={specialties} />
      <EntityPicker kind="hospital" label="Hospital" initial={initial.hospital} />
      <div><label htmlFor="rt">Review text (full)</label>
        <textarea id="rt" name="review_text" required defaultValue={initial.review_text} style={{ minHeight: 160 }} /></div>
      <div className="grid2">
        <div><label htmlFor="rn">Reviewer name (optional)</label><input id="rn" name="reviewer_name" type="text" defaultValue={initial.reviewer_name} /></div>
        <div><label htmlFor="rd">Review date</label><input id="rd" name="review_date" type="date" defaultValue={initial.review_date ?? ""} /></div>
        <div><label htmlFor="st">Source type</label>
          <select id="st" name="source_type" value={type} onChange={(e) => setType(e.target.value)}>
            {SOURCE_TYPES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="sl">Source link {linkRequired ? "(required)" : "(optional)"}</label>
          <input id="sl" name="source_link" type="url" placeholder="https://" required={linkRequired} defaultValue={initial.source_link} /></div>
        <div><label htmlFor="sti">Link title (button label)</label><input id="sti" name="source_title" type="text" placeholder="e.g. Google review" defaultValue={initial.source_title} /></div>
        <div><label htmlFor="tg">Tags</label><input id="tg" name="tags" type="text" placeholder="ACL, MCL" defaultValue={initial.tags} /></div>
      </div>
      <label className="check"><input type="checkbox" name="hidden" defaultChecked={!!initial.hidden} /> Hidden (not shown publicly)</label>
      <button className="btn">Save review</button>
    </form>
  );
}
