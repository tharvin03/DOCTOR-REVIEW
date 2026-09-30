/** Normalise a doctor name: trim, lowercase, drop leading "Dr"/"Dr.", collapse spaces. */
export function normalizeDoctorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^(dr\b\.?\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise a hospital name (used together with city for uniqueness). */
export function normalizeHospitalName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

/** Canonical display form: always "Dr Name". */
export function displayDoctorName(name: string): string {
  const base = name.trim().replace(/^(dr\b\.?\s*)+/i, "").replace(/\s+/g, " ");
  return `Dr ${base}`;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length][b.length];
}

/** Loose "did you mean the same one?" check between two already-normalised names. */
export function isSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true;
  const sortTokens = (s: string) => s.split(" ").sort().join(" ");
  if (sortTokens(a) === sortTokens(b)) return true;
  const max = Math.max(a.length, b.length);
  return levenshtein(a, b) <= Math.max(1, Math.floor(max * 0.2));
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
