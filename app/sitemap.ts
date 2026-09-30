import type { MetadataRoute } from "next";
import { allVisibleDoctorSlugs } from "@/lib/queries";
export const dynamic = "force-dynamic";


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || "http://localhost:3000";
  return [{ url: base }, ...(await allVisibleDoctorSlugs()).map((d) => ({ url: `${base}/doctors/${d.slug}` }))];
}
