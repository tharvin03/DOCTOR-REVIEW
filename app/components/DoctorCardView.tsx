import Link from "@/app/components/PLink";
import type { DoctorCard } from "@/lib/queries";

export default function DoctorCardView({ d, procedure }: { d: DoctorCard; procedure?: { slug: string; name: string } }) {
  return (
    <div className="card">
      <h3><Link href={`/doctors/${d.slug}${procedure ? `?procedure=${procedure.slug}` : ""}`}>{d.name}</Link></h3>
      <div className="muted small">{d.specialty}</div>
      {d.hospitals.length > 0 && <p style={{ margin: "6px 0" }}>{d.hospitals.map((h) => h.name).join(" · ")}</p>}
      {d.procedures.length > 0 && <div>{d.procedures.map((p) => <span className="pill" key={p.id}>{p.name}</span>)}</div>}
      <div className="small muted" style={{ marginTop: 6 }}>
        {procedure && d.matching_count !== undefined
          ? `${d.matching_count} review${d.matching_count === 1 ? "" : "s"} about ${procedure.name} · ${d.review_count} in total`
          : `${d.review_count} review${d.review_count === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
