/**
 * Extension hooks. All are intentionally NO-OPS for now; wire them up later
 * without touching the callers. Everything here runs server-side only.
 */

// ---------------------------------------------------------------------------
// PLACEHOLDER: Discord webhook (add later).
// Set DISCORD_WEBHOOK_URL in the server environment (never expose it to the
// browser / NEXT_PUBLIC_*), then implement the POST below.
// ---------------------------------------------------------------------------
export async function notifyDiscord(_event: {
  type: "submission" | "removal_request";
  summary: string;
}): Promise<void> {
  // const url = process.env.DISCORD_WEBHOOK_URL;
  // if (!url) return;
  // await fetch(url, {
  //   method: "POST",
  //   headers: { "content-type": "application/json" },
  //   body: JSON.stringify({ content: `[${_event.type}] ${_event.summary}`.slice(0, 1900) }),
  // });
}

// HOOK: CAPTCHA verification (e.g. Cloudflare Turnstile / hCaptcha). Not enabled yet.
export async function verifyCaptcha(_token: string | null): Promise<boolean> {
  return true;
}

// HOOK: rate limiting / bot protection (per IP or fingerprint). Not enabled yet.
export async function checkRateLimit(_bucket: string, _key: string): Promise<boolean> {
  return true;
}
