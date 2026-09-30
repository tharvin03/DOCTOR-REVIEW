import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DISCLAIMER, SITE_NAME } from "@/lib/constants";

// Content comes from SQLite and changes at runtime; never prerender at build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: { default: `${SITE_NAME} | Private hospital doctors in KL & Melaka`, template: `%s` },
  description: "Find private-hospital doctors in Kuala Lumpur and Melaka and read patient reviews with links to their original sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="logo">{SITE_NAME}</Link>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <p style={{ margin: 0 }}>{DISCLAIMER}</p>
            <nav>
              <Link href="/request-removal">Request removal</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
