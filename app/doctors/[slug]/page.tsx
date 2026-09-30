import Link from "@/app/components/PLink";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReviewCard from "@/app/components/ReviewCard";
import ShareBox from "@/app/components/ShareBox";
import { CITY_LABEL } from "@/lib/constants";
import { doctorMeta, getDoctorPage, specialtyLabel } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ procedure?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getDoctorPage((await params).slug);
  if (!d) return {};
  const m = doctorMeta(d);
  return { title: m.title, description: m.description, alternates: { canonical: `/doctors/${d.slug}` }, openGraph: { title: m.title, description: m.description } };
}

export default async function DoctorPage({ params, searchParams }: Props) {
  const d = await getDoctorPage((await params).slug);
  if (!d) notFound();
  const activeSlug = (await searchParams)?.procedure;
  const active = d.procedures.find((p) => p.slug === activeSlug);
  const shown = active ? d.reviews.filter((r) => r.procedures.some((p) => p.slug === active.slug)) : d.reviews;
  const countFor = (slug: string) => d.reviews.filter((r) => r.procedures.some((p) => p.slug === slug)).length;
  return (
    <main>
      <div className="wrap">
        <p className="small"><Link href="/">← Home</Link></p>
        <h1>{d.name}</h1>
        <p className="muted" style={{ margin: "0 0 8px" }}>{specialtyLabel(d)}</p>
        {d.hospitals.length > 0 && (
          <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>
            {d.hospitals.map((h) => <li key={h.id}>{h.name}, {CITY_LABEL[h.city]}</li>)}
          </ul>
        )}
        {(d.years_experience ?? 0) > 0 && <p className="muted" style={{ margin: "8px 0 0" }}>{d.years_experience} year{d.years_experience === 1 ? "" : "s"} of experience</p>}
        {d.qualifications.trim() && (
          <>
            <h2>Qualifications</h2>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.qualifications}</p>
          </>
        )}
        {d.short_description.trim() && (
          <>
            <h2>About</h2>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.short_description}</p>
          </>
        )}

        <h2>Patient reviews ({shown.length}{active ? ` about ${active.name}` : ""})</h2>
        {d.procedures.length > 0 && (
          <div className="row" style={{ gap: 6, marginBottom: 4 }} aria-label="Filter reviews by procedure">
            <Link href={`/doctors/${d.slug}`} className={`pill${active ? "" : " ok"}`}>All</Link>
            {d.procedures.map((p) => (
              <Link key={p.id} href={`/doctors/${d.slug}?procedure=${p.slug}`} className={`pill${active?.slug === p.slug ? " ok" : ""}`}>
                {p.name} ({countFor(p.slug)})
              </Link>
            ))}
          </div>
        )}
        {shown.length === 0 && <p className="muted">No reviews yet.</p>}
        {shown.map((r) => <ReviewCard key={r.id} review={r} />)}
        <ShareBox />
      </div>
    </main>
  );
}
