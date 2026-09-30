export const CITIES = ["KL", "Melaka"] as const;
export type City = (typeof CITIES)[number];

export const STATES: Record<string, { slug: string; label: string; city: City }> = {
  kl: { slug: "kl", label: "Kuala Lumpur", city: "KL" },
  melaka: { slug: "melaka", label: "Melaka", city: "Melaka" },
};
export const CITY_LABEL: Record<City, string> = { KL: "Kuala Lumpur", Melaka: "Melaka" };

export const SOURCE_TYPES = [
  "Google review",
  "Article",
  "Forum or social post",
  "Patient submission",
  "Other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SITE_NAME = "Doctor Reviews Malaysia";
export const DISCLAIMER = "Reviews are patient opinions from public sources, not medical advice.";
