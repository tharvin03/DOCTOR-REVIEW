import type { MetadataRoute } from "next";
import { allVisibleDoctorSlugs } from "@/lib/queries";
export const dynamic = "force-dynamic";


export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL || "http://localhost:3000";
  return [{ url: base }, ...allVisibleDoctorSlugs().map((d) => ({ url: `${base}/doctors/${d.slug}` }))];
}
