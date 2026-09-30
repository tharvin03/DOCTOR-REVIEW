import SubmitButton from "@/app/components/SubmitButton";
import Link from "@/app/components/PLink";
import { logout } from "../actions";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main>
      <div className="wrap">
        <nav className="admin-nav">
          {[["/admin", "Dashboard"], ["/admin/doctors", "Doctors"], ["/admin/hospitals", "Hospitals"], ["/admin/reviews", "Reviews"],
            ["/admin/specialties", "Specialties"], ["/admin/procedures", "Procedures"], ["/admin/source-types", "Source types"], ["/admin/import", "Excel import"],
            ["/admin/submissions", "Submissions"], ["/admin/removals", "Removal requests"]].map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}
          <form action={logout} style={{ display: "inline" }}><SubmitButton className="linkbtn" pendingText="Logging out…">Log out</SubmitButton></form>
        </nav>
        {children}
      </div>
    </main>
  );
}
