"use client";

import * as React from "react";
import Link from "next/link";
import { useLinkPending } from "./route-progress";
import { cn } from "@/lib/utils";

/**
 * A `<Link>` that says it heard you.
 *
 * A tap on a dynamic route used to leave the old screen frozen until the
 * server answered, with nothing to distinguish "loading" from "didn't
 * register". This tints the tapped row for as long as the navigation is in
 * flight and feeds the global route rail.
 *
 * The tint is an always-mounted overlay whose opacity toggles, per the
 * `useLinkStatus` guidance — a element that appears on pending would shift the
 * layout of the very row being tapped. Neutral, never volt: volt means state
 * that matters, and "I am fetching this" isn't a result.
 */
export function PendingLink({
  className,
  children,
  tint = true,
  ...props
}: React.ComponentProps<typeof Link> & { tint?: boolean }) {
  return (
    <Link {...props} className={cn("relative", className)}>
      {children}
      {tint && <Tint />}
    </Link>
  );
}

function Tint() {
  const pending = useLinkPending();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] bg-white/[0.055] transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
