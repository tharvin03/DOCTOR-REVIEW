import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DoctorCardView from "@/app/components/DoctorCardView";
import { STATES } from "@/lib/constants";
import {
  getProcedureBySlug, getSpecialtyBySlug, hospitalsFor, listProcedures, searchDoctors,
} from "@/lib/queries";

type Params = { state: string; specialty: string; procedure?: string[] };

function resolve(p: Params) {
  const state = STATES[p.state];
  const specialty = getSpecialtyBySlug(p.specialty);
  if (!state || !specialty || (p.procedure?.length ?? 0) > 1) return null;
  const procedure = p.procedure?.[0] ? getProcedureBySlug(specialty.id, p.procedure[0]) : undefined;
  if (p.procedure?.[0] && !procedure) return null;
  return { state, specialty, procedure };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const r = resolve(await params);
  if (!r) return {};
  const what = r.procedure ? `${r.procedure.name} (${r.specialty.name})` : r.specialty.name;
  return {
    title: `${what} doctors in ${r.state.label} | Patient Reviews`,
    description: `Private-hospital ${r.specialty.name.toLowerCase()} doctors in ${r.state.label}${r.procedure ? ` for ${r.procedure.name.toLowerCase()}` : ""}, with patient reviews linked to their original sources.`,
  };
}

export default async function Results({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<{ hospital?: string }> }) {
  const r = resolve(await params);
  if (!r) notFound();
  const { hospital } = await searchParams;
  const hospitals = hospitalsFor(r.state.city, r.specialty.id);
  const hospitalSlug = hospitals.some((h) => h.slug === hospital) ? hospital : undefined;
  const doctors = searchDoctors({
    city: r.state.city, specialtyId: r.specialty.id, procedureId: r.procedure?.id, hospitalSlug,
  });
  const base = `/${r.state.slug}/${r.specialty.slug}${r.procedure ? "/" + r.procedure.slug : ""}`;
  const otherProcs = listProcedures().filter((p) => p.specialty_id === r.specialty.id);

  return (
    <main>
      <div className="wrap">
        <p className="small"><Link href="/">← New search</Link></p>
        <h1>{r.specialty.name}{r.procedure ? `: ${r.procedure.name}` : ""} in {r.state.label}</h1>

        <form method="get" action={base} className="card row">
          <label htmlFor="hospital" style={{ margin: 0 }}>Hospital</label>
          <select id="hospital" name="hospital" defaultValue={hospitalSlug ?? ""} style={{ flex: "1 1 200px", width: "auto" }}>
            <option value="">All hospitals</option>
            {hospitals.map((h) => <option key={h.id} value={h.slug}>{h.name}</option>)}
          </select>
          <button className="btn secondary">Filter</button>
        </form>

        {doctors.length === 0 ? (
          <p className="muted">No doctors found for this selection yet.
            {r.procedure && <> Try <Link href={`/${r.state.slug}/${r.specialty.slug}`}>all {r.specialty.name} procedures</Link>.</>}</p>
        ) : (
          <>
            <p className="muted small">{doctors.length} doctor{doctors.length === 1 ? "" : "s"}</p>
            {doctors.map((d) => <DoctorCardView key={d.id} d={d} />)}
          </>
        )}
        {!r.procedure && otherProcs.length > 0 && (
          <p className="small muted">Narrow by procedure:{" "}
            {otherProcs.map((p) => <Link key={p.id} className="pill" href={`${base}/${p.slug}`}>{p.name}</Link>)}
          </p>
        )}
      </div>
    </main>
  );
}
