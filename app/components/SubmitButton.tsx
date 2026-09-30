"use client";
import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button with built-in feedback: while its form's action runs it shows a spinner,
 * disables itself (no double submits) and, if it drags on, says so.
 */
export default function SubmitButton({
  children, className = "btn", pendingText, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [pending]);
  return (
    <button {...rest} className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending && <span className="spin" aria-hidden="true" />}
      {pending ? (slow ? "Still working…" : pendingText ?? children) : children}
    </button>
  );
}
