import Link from "@/app/components/PLink";
import type { Metadata } from "next";
import DoctorCardView from "@/app/components/DoctorCardView";
import { searchDoctorsByName } from "@/lib/queries";

export const metadata: Metadata = { title: "Doctor name search | Patient Reviews", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const doctors = await searchDoctorsByName(q);
  return (
    <main>
      <div className="wrap">
        <p className="small"><Link href="/">← Home</Link></p>
        <h1>Results for “{q}”</h1>
        {q.trim().length < 2 ? <p className="muted">Enter at least 2 characters.</p>
          : doctors.length === 0 ? <p className="muted">No doctors found.</p>
          : doctors.map((d) => <DoctorCardView key={d.id} d={d} />)}
      </div>
    </main>
  );
}
