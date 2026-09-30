"use client";
import SubmitButton from "./SubmitButton";

export default function ConfirmButton({ message, children, className = "btn small danger" }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <SubmitButton className={className} pendingText="Deleting…" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </SubmitButton>
  );
}
