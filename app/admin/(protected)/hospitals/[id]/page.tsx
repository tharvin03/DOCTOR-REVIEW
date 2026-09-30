import { notFound } from "next/navigation";
import Flash from "@/app/components/Flash";
import HospitalForm from "@/app/components/HospitalForm";
import { getDb } from "@/lib/db";

export default async function EditHospital({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const h = await getDb().get<{ id: number; name: string; city: string; address: string }>("SELECT id, name, city, address FROM hospitals WHERE id=?", Number((await params).id) || 0);
  if (!h) notFound();
  return <><h1>Edit {h.name}</h1><Flash {...(await searchParams)} /><HospitalForm h={h} /></>;
}
