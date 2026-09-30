import Flash from "@/app/components/Flash";
import HospitalForm from "@/app/components/HospitalForm";

export default async function NewHospital({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  return <><h1>Add hospital</h1><Flash {...(await searchParams)} /><HospitalForm /></>;
}
