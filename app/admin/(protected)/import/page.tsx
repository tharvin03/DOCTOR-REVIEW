import ImportClient from "@/app/components/ImportClient";

export default function ImportPage() {
  return (
    <>
      <h1>Excel import</h1>
      <p className="muted">Doctors are matched by name and hospitals by name + city; existing ones are reused and only missing ones are created. You will see a preview before anything is saved.</p>
      <ImportClient />
    </>
  );
}
