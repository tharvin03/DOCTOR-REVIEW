"use client";
import { useEffect, useState } from "react";

type Match = { id: number; name: string; detail: string; exact: boolean; city?: string };
type Kind = "doctor" | "hospital";

function useMatches(kind: Kind, q: string, excludeId?: number) {
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => {
    if (!q.trim()) { setMatches([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((m: Match[]) => setMatches(m.filter((x) => x.id !== excludeId)))
        .catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [kind, q, excludeId]);
  return matches;
}

/**
 * Search box that starts every review form: pick an existing record or "Create new".
 * Emits hidden inputs: {kind}_id  OR  {kind}_new_name (+ city/address/specialty for new).
 */
export function EntityPicker({
  kind, label, initial, specialties,
}: {
  kind: Kind; label: string;
  initial?: { id: number; name: string };
  specialties?: { id: number; name: string }[];
}) {
  const [selected, setSelected] = useState(initial ?? null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("KL");
  const matches = useMatches(kind, selected ? "" : q);
  const conflict = creating && matches.find((m) => m.exact && (kind === "doctor" || m.city === city));
  const similar = creating ? matches.filter((m) => m !== conflict) : [];

  if (selected)
    return (
      <div className="picker">
        <label>{label}</label>
        <input type="hidden" name={`${kind}_id`} value={selected.id} />
        <div className="row"><strong>{selected.name}</strong>
          <button type="button" className="linkbtn small" onClick={() => { setSelected(null); setQ(""); }}>Change</button></div>
      </div>
    );

  return (
    <div className="picker">
      <label htmlFor={`${kind}-q`}>{label}: search existing or create new</label>
      <input id={`${kind}-q`} type="search" value={q} autoComplete="off" placeholder={`Type a ${kind} name…`}
        onChange={(e) => { setQ(e.target.value); setCreating(false); }} />
      {!creating && q.trim() && (
        <ul>
          {matches.map((m) => (
            <li key={m.id}>
              <span>{m.name}<br /><span className="muted small">{m.detail}</span></span>
              <button type="button" className="btn small secondary" onClick={() => setSelected({ id: m.id, name: m.name })}>Select</button>
            </li>
          ))}
          <li><span className="muted">{matches.length ? "Not in the list?" : "No matches."}</span>
            <button type="button" className="btn small" onClick={() => setCreating(true)}>＋ Create new “{q.trim()}”</button></li>
        </ul>
      )}
      {creating && (
        <div className="stack" style={{ marginTop: 8 }}>
          <div><label>New {kind} name</label>
            <input type="text" name={`${kind}_new_name`} value={q} onChange={(e) => setQ(e.target.value)} required /></div>
          {kind === "doctor" && (
            <div><label>Specialty</label>
              <select name="doctor_new_specialty_id" required defaultValue="">
                <option value="" disabled>Select…</option>
                {specialties?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
          )}
          {kind === "hospital" && (
            <>
              <div><label>City</label>
                <select name="hospital_new_city" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="KL">KL</option><option value="Melaka">Melaka</option></select></div>
              <div><label>Address (optional)</label><input type="text" name="hospital_new_address" /></div>
            </>
          )}
          {conflict && (
            <div className="notice error">“{conflict.name}” already exists.{" "}
              <button type="button" className="linkbtn" onClick={() => setSelected({ id: conflict.id, name: conflict.name })}>Use the existing one</button></div>
          )}
          {similar.length > 0 && (
            <div className="notice">Similar existing names — check you are not creating a duplicate:
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {similar.map((m) => (
                  <li key={m.id} style={{ display: "list-item", border: 0 }}>{m.name} <span className="muted small">({m.detail})</span>{" "}
                    <button type="button" className="linkbtn small" onClick={() => setSelected({ id: m.id, name: m.name })}>use this</button></li>
                ))}
              </ul></div>
          )}
          <button type="button" className="linkbtn small" onClick={() => setCreating(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** Search-first name field for the doctor/hospital create & edit forms: warns about existing/similar names. */
export function NameCheck({
  kind, defaultValue = "", excludeId, label = "Name",
}: { kind: Kind; defaultValue?: string; excludeId?: number; label?: string }) {
  const [q, setQ] = useState(defaultValue);
  const matches = useMatches(kind, q, excludeId);
  const base = kind === "doctor" ? "/admin/doctors" : "/admin/hospitals";
  return (
    <div>
      <label htmlFor="name">{label}</label>
      <input id="name" name="name" type="text" required value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div className={`notice${matches.some((m) => m.exact) ? " error" : ""}`} style={{ marginTop: 6 }}>
          {matches.some((m) => m.exact) ? "Already exists:" : "Similar existing names:"}
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {matches.map((m) => <li key={m.id}><a href={`${base}/${m.id}`}>{m.name}</a> <span className="muted small">({m.detail})</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
