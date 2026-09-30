import Link from "next/link";
import { notFound } from "next/navigation";
import DoctorForm from "@/app/components/DoctorForm";
import Flash from "@/app/components/Flash";
import { getDb } from "@/lib/db";

export default async function EditDoctor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const doctor = await getDb().get<{ id: number; name: string; slug: string; specialty_id: number; short_description: string; hidden: number }>(
    "SELECT id, name, slug, specialty_id, short_description, hidden FROM doctors WHERE id=?", Number((await params).id) || 0);
  if (!doctor) notFound();
  return (
    <>
      <h1>Edit {doctor.name}</h1>
      <p className="small"><Link href={`/doctors/${doctor.slug}`}>Public page</Link> (visible only when not hidden)</p>
      <Flash {...(await searchParams)} />
      <DoctorForm doctor={doctor} />
    </>
  );
}
