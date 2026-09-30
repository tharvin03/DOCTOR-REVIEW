import Link from "next/link";
import { getDb } from "@/lib/db";

export default function Dashboard() {
  const db = getDb();
  const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  const stats = [
    ["Doctors", c("SELECT COUNT(*) c FROM doctors"), "/admin/doctors"],
    ["Hospitals", c("SELECT COUNT(*) c FROM hospitals"), "/admin/hospitals"],
    ["Reviews", c("SELECT COUNT(*) c FROM reviews"), "/admin/reviews"],
    ["Pending submissions", c("SELECT COUNT(*) c FROM submissions WHERE status='pending'"), "/admin/submissions"],
    ["Pending removal requests", c("SELECT COUNT(*) c FROM removal_requests WHERE status='pending'"), "/admin/removals"],
  ] as const;
  return (
    <>
      <h1>Admin</h1>
      <div className="grid2">
        {stats.map(([l, n, h]) => <Link key={l} href={h} className="card" style={{ textDecoration: "none", color: "inherit" }}><div className="muted small">{l}</div><strong style={{ fontSize: "1.6rem" }}>{n}</strong></Link>)}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn" href="/admin/reviews/new">Add review</Link>
        <Link className="btn secondary" href="/admin/import">Import Excel</Link>
      </div>
    </>
  );
}
