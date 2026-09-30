import Link from "next/link";
import { getDb } from "@/lib/db";

export default async function Dashboard() {
  const db = getDb();
  const c = async (sql: string) => (await db.get<{ c: number }>(sql))!.c;
  const stats = [
    ["Doctors", await c("SELECT COUNT(*) AS c FROM doctors"), "/admin/doctors"],
    ["Hospitals", await c("SELECT COUNT(*) AS c FROM hospitals"), "/admin/hospitals"],
    ["Reviews", await c("SELECT COUNT(*) AS c FROM reviews"), "/admin/reviews"],
    ["Pending submissions", await c("SELECT COUNT(*) AS c FROM submissions WHERE status='pending'"), "/admin/submissions"],
    ["Pending removal requests", await c("SELECT COUNT(*) AS c FROM removal_requests WHERE status='pending'"), "/admin/removals"],
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
