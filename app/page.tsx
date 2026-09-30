import Link from "next/link";
import SearchForm from "./components/SearchForm";
import ShareBox from "./components/ShareBox";
import { STATES } from "@/lib/constants";
import { listProcedures, listSpecialties } from "@/lib/queries";

const ERRORS: Record<string, string> = {
  missing: "Please write a message.", consent: "Consent is required to submit.",
  link: "The link must start with http:// or https://.", rate: "Too many submissions. Try again later.",
  captcha: "Captcha check failed.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Find a private-hospital doctor in Malaysia</h1>
          <p>Read patient reviews from public sources, each linked back to where it was originally posted.</p>
          <SearchForm
            states={Object.values(STATES).map(({ slug, label }) => ({ slug, label }))}
            specialties={await listSpecialties()}
            procedures={await listProcedures()}
          />
        </div>
      </section>
      <main>
        <div className="wrap">
          {sp.error && <p className="notice error">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
          <ShareBox sent={sp.sent === "1"} />
          <p style={{ textAlign: "right", margin: "24px 0 0", fontSize: ".7rem" }}>
            <Link href="/request-removal" className="muted">Request removal</Link>
          </p>
        </div>
      </main>
    </>
  );
}
