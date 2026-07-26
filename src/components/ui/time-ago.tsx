"use client";

import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "@/lib/utils";

/**
 * Relative timestamp that survives hydration.
 *
 * Server and client render at different instants, so "2m" on the server can be
 * "3m" by the time React hydrates — a mismatch that blows away the subtree.
 * The first paint uses the server's string, then a post-mount effect refreshes
 * it and keeps it ticking.
 */
export function TimeAgo({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  // Memoised so a re-render with the same ISO string doesn't produce a new
  // Date identity and restart the interval.
  const at = useMemo(
    () => (typeof date === "string" ? new Date(date) : date),
    [date],
  );
  const [label, setLabel] = useState(() => timeAgo(at));

  useEffect(() => {
    const update = () => setLabel(timeAgo(at));
    update();
    // A minute is fine: the label's finest granularity is minutes.
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [at]);

  return (
    <time
      dateTime={at.toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
