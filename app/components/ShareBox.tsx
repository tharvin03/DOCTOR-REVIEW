import { submitExperience } from "@/app/actions";

export default function ShareBox({ sent }: { sent?: boolean }) {
  return (
    <section className="card" id="share">
      <h2 style={{ marginTop: 0 }}>Share your experience</h2>
      {sent && <p className="notice success">Thank you. Your submission is pending review.</p>}
      <form action={submitExperience} className="stack">
        <div className="hp" aria-hidden="true">
          <label>Leave empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <div>
          <label htmlFor="msg">Your experience (please mention the doctor and hospital)</label>
          <textarea id="msg" name="message" required maxLength={3000} />
        </div>
        <div>
          <label htmlFor="lnk">Link to your original post <span className="muted">(optional)</span></label>
          <input id="lnk" name="link" type="url" placeholder="https://" />
        </div>
        <label className="check">
          <input type="checkbox" name="consent" required />
          <span>I consent to my submission being reviewed and possibly published on this site.</span>
        </label>
        <button className="btn">Submit</button>
      </form>
    </section>
  );
}
