"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Call before a programmatic navigation (router.push) so the top bar starts. */
export const startNav = () => window.dispatchEvent(new Event("nav:start"));

const SLOW_MS = 8000;
const GIVE_UP_MS = 30000;

/**
 * Global loading feedback: a thin progress bar for every navigation (link clicks, GET forms,
 * router.push), a "still loading" note when it drags on, and an offline banner.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);
  const timers = useRef<{ slow?: ReturnType<typeof setTimeout>; giveUp?: ReturnType<typeof setTimeout>; idle?: ReturnType<typeof setTimeout> }>({});

  const clear = () => Object.values(timers.current).forEach((t) => clearTimeout(t));

  const finish = useCallback(() => {
    clear();
    setSlow(false);
    setState((s) => (s === "loading" ? "done" : s));
    timers.current.idle = setTimeout(() => setState("idle"), 400);
  }, []);

  const start = useCallback(() => {
    clear();
    setSlow(false);
    setState("loading");
    timers.current.slow = setTimeout(() => setSlow(true), SLOW_MS);
    timers.current.giveUp = setTimeout(finish, GIVE_UP_MS);
  }, [finish]);

  // The page changed: the navigation is over.
  useEffect(() => { finish(); }, [pathname, search, finish]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-no-progress")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page or #anchor
      start();
    };
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      // Server-action forms show progress on their button instead; plain GET forms reload the page.
      if (form.getAttribute("action")?.startsWith("javascript:") || form.method.toLowerCase() === "post") return;
      start();
    };
    const setNet = () => setOffline(!navigator.onLine);
    setNet();
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("nav:start", start);
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("nav:start", start);
      window.removeEventListener("online", setNet);
      window.removeEventListener("offline", setNet);
      clear();
    };
  }, [start]);

  // Desktop only (phones have no cursor): show the "busy" pointer while loading.
  useEffect(() => {
    document.body.classList.toggle("is-loading", state === "loading");
  }, [state]);

  return (
    <>
      <div className={`navbar ${state}`} aria-hidden="true" />
      {offline ? (
        <div className="toast offline" role="alert">You're offline. Check your connection; nothing can be saved until you're back.</div>
      ) : slow ? (
        <div className="toast" role="status">Still loading… the connection is slow, or the database is waking up.</div>
      ) : null}
    </>
  );
}
