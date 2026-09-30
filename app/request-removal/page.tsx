import SubmitButton from "@/app/components/SubmitButton";
import type { Metadata } from "next";
import { submitRemoval } from "@/app/actions";

export const metadata: Metadata = { title: "Request removal | Doctor Reviews Malaysia" };

export default async function RemovalPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; link?: string }> }) {
  const sp = await searchParams;
  return (
    <main>
      <div className="wrap">
        <h1>Request removal of a review</h1>
        <p className="muted">Tell us which review you want removed and why. We review every request.</p>
        {sp.sent && <p className="notice success">Request received. Thank you.</p>}
        {sp.error && <p className="notice error">Please fill in all fields{sp.error === "rate" ? " (too many requests, try later)" : ""}.</p>}
        <form action={submitRemoval} className="card stack">
          <div className="hp" aria-hidden="true"><label>Leave empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div><label htmlFor="name">Your name</label><input id="name" name="name" type="text" required maxLength={200} /></div>
          <div><label htmlFor="rl">Link to the review (on this site or the original source)</label>
            <input id="rl" name="review_link" type="text" required maxLength={2000} defaultValue={sp.link ?? ""} /></div>
          <div><label htmlFor="rs">Reason</label><textarea id="rs" name="reason" required maxLength={3000} /></div>
          <SubmitButton className="btn" pendingText="Sending…">Submit request</SubmitButton>
        </form>
      </div>
    </main>
  );
}
