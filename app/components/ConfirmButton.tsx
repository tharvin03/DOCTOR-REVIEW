"use client";
export default function ConfirmButton({ message, children, className = "btn small danger" }: { message: string; children: React.ReactNode; className?: string }) {
  return <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
