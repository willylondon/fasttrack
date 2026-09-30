"use client";

import { useLinkStatus } from "next/link";

// This is a Link descendant so rapid/newer navigation uses Next's own pending
// lifecycle rather than a custom timer that can get stuck after Back or Cancel.
export function NavigationPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] bg-primary/15 motion-reduce:animate-none" />
      <span role="status" className="sr-only">Opening page…</span>
    </>
  );
}
