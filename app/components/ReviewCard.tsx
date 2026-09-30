"use client";
import { useEffect, useRef, useState } from "react";
import type { PublicReview } from "@/lib/queries";

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export default function ReviewCard({ review: r }: { review: PublicReview }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Show "See more" only when the clamped text is actually cut off (depends on screen width).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = () => { if (!open) setOverflows(el.scrollHeight > el.clientHeight + 1); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [open, r.review_text]);
  const long = overflows || open;
  const href = r.source_link ? safeHref(r.source_link) : null;
  return (
    <article className="card review" id={`review-${r.id}`}>
      {r.tags && <div className="tags">{r.tags}</div>}
      {r.procedures.length > 0 && <div style={{ margin: "0 0 6px" }}>{r.procedures.map((p) => <span className="pill" key={p.id}>{p.name}</span>)}</div>}
      <div ref={bodyRef} className={`body${open ? "" : " clamped"}`}>{r.review_text}</div>
      {long && (
        <button type="button" className="linkbtn small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "See less" : "See more"}
        </button>
      )}
      <div className="meta">
        {r.reviewer_name && <span>{r.reviewer_name}</span>}
        {r.review_date && <time dateTime={r.review_date}>{r.review_date}</time>}
        {!href && <span>{r.source_type}</span>}
        <span>{r.hospital_name}</span>
      </div>
      <div className="row">
        {href && (
          <a className="btn small" href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {r.source_type} ↗
          </a>
        )}
      </div>
    </article>
  );
}
