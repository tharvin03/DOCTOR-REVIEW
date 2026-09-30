"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="spin inline" aria-hidden="true" /> : null;
}

/** Drop-in for next/link that shows a small spinner beside the link while its page loads. */
export default function PLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Pending />
    </Link>
  );
}
