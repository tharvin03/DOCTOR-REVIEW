import SubmitButton from "@/app/components/SubmitButton";
import { NameCheck } from "./EntityPicker";
import { saveHospital } from "@/app/admin/actions";

export default function HospitalForm({ h }: { h?: { id: number; name: string; city: string; address: string } }) {
  return (
    <form action={saveHospital} className="stack">
      {h && <input type="hidden" name="id" value={h.id} />}
      <NameCheck kind="hospital" defaultValue={h?.name} excludeId={h?.id} label="Hospital name (search first to avoid duplicates)" />
      <div><label htmlFor="c">City</label><select id="c" name="city" defaultValue={h?.city ?? "KL"}><option>KL</option><option>Melaka</option></select></div>
      <div><label htmlFor="a">Address (optional)</label><input id="a" name="address" type="text" defaultValue={h?.address} /></div>
      <SubmitButton className="btn" pendingText="Saving…">Save hospital</SubmitButton>
    </form>
  );
}
