import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSimilar, normalizeDoctorName, normalizeHospitalName } from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const db = getDb();

  if (kind === "doctor") {
    const nq = normalizeDoctorName(q);
    if (!nq) return NextResponse.json([]);
    const rows = await db.all<{ id: number; name: string; name_norm: string; specialty: string; hospitals: string | null }>(
      `SELECT d.id, d.name, d.name_norm, s.name AS specialty,
         (SELECT string_agg(h.name, ', ') FROM doctor_hospitals dh JOIN hospitals h ON h.id = dh.hospital_id WHERE dh.doctor_id = d.id) AS hospitals
       FROM doctors d JOIN specialties s ON s.id = d.specialty_id`,
    );
    const out = rows
      .filter((r) => r.name_norm.includes(nq) || isSimilar(nq, r.name_norm))
      .map((r) => ({ id: r.id, name: r.name, detail: [r.specialty, r.hospitals].filter(Boolean).join(" · "), exact: r.name_norm === nq }))
      .sort((a, b) => Number(b.exact) - Number(a.exact) || a.name.localeCompare(b.name))
      .slice(0, 8);
    return NextResponse.json(out);
  }
  if (kind === "hospital") {
    const nq = normalizeHospitalName(q);
    if (!nq) return NextResponse.json([]);
    const rows = await db.all<{ id: number; name: string; name_norm: string; city: string }>("SELECT id, name, name_norm, city FROM hospitals");
    const out = rows
      .filter((r) => r.name_norm.includes(nq) || isSimilar(nq, r.name_norm))
      .map((r) => ({ id: r.id, name: r.name, city: r.city, detail: r.city, exact: r.name_norm === nq }))
      .sort((a, b) => Number(b.exact) - Number(a.exact) || a.name.localeCompare(b.name))
      .slice(0, 8);
    return NextResponse.json(out);
  }
  return NextResponse.json({ error: "bad kind" }, { status: 400 });
}
