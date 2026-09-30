"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { startNav } from "./NavProgress";

type Opt = { id: number; name: string; slug: string };
type Proc = Opt & { specialty_id: number };

export default function SearchForm({
  states, specialties, procedures,
}: { states: { slug: string; label: string }[]; specialties: Opt[]; procedures: Proc[] }) {
  const router = useRouter();
  const [state, setState] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [procedure, setProcedure] = useState("");
  const [q, setQ] = useState("");
  const [going, setGoing] = useState<"" | "find" | "name">("");
  // If the navigation never completes, let the visitor try again.
  useEffect(() => {
    if (!going) return;
    const t = setTimeout(() => setGoing(""), 20000);
    return () => clearTimeout(t);
  }, [going]);
  const spec = specialties.find((s) => s.slug === specialty);
  const procs = procedures.filter((p) => p.specialty_id === spec?.id);

  return (
    <div className="card stack">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!state || !specialty) return;
          setGoing("find");
          startNav();
          router.push(`/${state}/${specialty}${procedure ? "/" + procedure : ""}`);
        }}
      >
        <div>
          <label htmlFor="state">State</label>
          <select id="state" value={state} onChange={(e) => setState(e.target.value)} required>
            <option value="">Select state…</option>
            {states.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="specialty">Specialty</label>
          <select id="specialty" value={specialty} disabled={!state}
            onChange={(e) => { setSpecialty(e.target.value); setProcedure(""); }} required>
            <option value="">Select specialty…</option>
            {specialties.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="procedure">Procedure <span className="muted">(optional)</span></label>
          <select id="procedure" value={procedure} disabled={!specialty} onChange={(e) => setProcedure(e.target.value)}>
            <option value="">Any procedure</option>
            {procs.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn" disabled={!state || !specialty || going !== ""} aria-busy={going === "find"}>
          {going === "find" && <span className="spin" aria-hidden="true" />}{going === "find" ? "Searching…" : "Find doctors"}
        </button>
      </form>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
      <form
        onSubmit={(e) => { e.preventDefault(); if (q.trim().length < 2) return; setGoing("name"); startNav(); router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}
        className="stack"
      >
        <div>
          <label htmlFor="q">Or search by doctor name</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Tan" minLength={2} />
        </div>
        <button className="btn secondary" disabled={q.trim().length < 2 || going !== ""} aria-busy={going === "name"}>
          {going === "name" && <span className="spin" aria-hidden="true" />}{going === "name" ? "Searching…" : "Search name"}
        </button>
      </form>
    </div>
  );
}
