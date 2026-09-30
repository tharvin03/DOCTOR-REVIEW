"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { checkRateLimit, notifyDiscord, verifyCaptcha } from "@/lib/hooks";
import { isHttpUrl } from "@/lib/normalize";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function submitExperience(fd: FormData) {
  if (str(fd, "website")) redirect("/?sent=1"); // honeypot: pretend success
  if (!(await verifyCaptcha(str(fd, "captcha")))) redirect("/?error=captcha");
  if (!(await checkRateLimit("submission", await clientKey()))) redirect("/?error=rate");

  const message = str(fd, "message").slice(0, 3000);
  const link = str(fd, "link").slice(0, 2000);
  if (!message) redirect("/?error=missing#share");
  if (fd.get("consent") !== "on") redirect("/?error=consent#share");
  if (link && !isHttpUrl(link)) redirect("/?error=link#share");

  await getDb().run("INSERT INTO submissions (message, link, consent) VALUES (?,?,1)", message, link);
  await notifyDiscord({ type: "submission", summary: message.slice(0, 200) });
  redirect("/?sent=1#share");
}

export async function submitRemoval(fd: FormData) {
  if (str(fd, "website")) redirect("/request-removal?sent=1");
  if (!(await verifyCaptcha(str(fd, "captcha")))) redirect("/request-removal?error=captcha");
  if (!(await checkRateLimit("removal", await clientKey()))) redirect("/request-removal?error=rate");

  const name = str(fd, "name").slice(0, 200);
  const link = str(fd, "review_link").slice(0, 2000);
  const reason = str(fd, "reason").slice(0, 3000);
  if (!name || !link || !reason) redirect("/request-removal?error=missing");

  await getDb().run("INSERT INTO removal_requests (name, review_link, reason) VALUES (?,?,?)", name, link, reason);
  await notifyDiscord({ type: "removal_request", summary: `${name}: ${link}`.slice(0, 200) });
  redirect("/request-removal?sent=1");
}
