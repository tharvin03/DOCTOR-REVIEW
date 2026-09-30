import DoctorForm from "@/app/components/DoctorForm";
import Flash from "@/app/components/Flash";

export default async function NewDoctor({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  return <><h1>Add doctor</h1><Flash {...(await searchParams)} /><DoctorForm /></>;
}
