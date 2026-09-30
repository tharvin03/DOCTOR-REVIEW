import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReviewCard from "@/app/components/ReviewCard";
import ShareBox from "@/app/components/ShareBox";
import { CITY_LABEL } from "@/lib/constants";
import { doctorMeta, getDoctorPage, specialtyLabel } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getDoctorPage((await params).slug);
  if (!d) return {};
  const m = doctorMeta(d);
  return { title: m.title, description: m.description, alternates: { canonical: `/doctors/${d.slug}` }, openGraph: { title: m.title, description: m.description } };
}

export default async function DoctorPage({ params }: Props) {
  const d = await getDoctorPage((await params).slug);
  if (!d) notFound();
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
        {d.procedures.length > 0 && <div>{d.procedures.map((p) => <span className="pill" key={p.id}>{p.name}</span>)}</div>}
        {d.short_description && <p>{d.short_description}</p>}

        <h2>Patient reviews ({d.reviews.length})</h2>
        {d.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        {d.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        <ShareBox />
      </div>
    </main>
  );
}
