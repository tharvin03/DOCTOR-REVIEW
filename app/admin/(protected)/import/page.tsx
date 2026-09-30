// The import previews/commits rows one by one against the database; allow it time on Vercel.
export const maxDuration = 60;

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
