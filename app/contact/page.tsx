import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact | Doctor Reviews Malaysia" };

export default function Contact() {
  const email = process.env.CONTACT_EMAIL || "contact@example.com";
  return (
    <main>
      <div className="wrap">
        <h1>Contact</h1>
        <p>For corrections, questions or partnership enquiries, email <a href={`mailto:${email}`}>{email}</a>.</p>
        <p>To have a review removed, please use the <a href="/request-removal">removal request form</a>.</p>
      </div>
    </main>
  );
}
