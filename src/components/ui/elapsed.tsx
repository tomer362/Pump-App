"use client";

import { useElapsed } from "@/hooks/use-elapsed";
import { formatDuration } from "@/lib/utils";

/**
 * A running clock that survives hydration.
 *
 * Same trap as `<TimeAgo>`: the server renders "32:06" and by the time React
 * hydrates it's "32:11", and a text mismatch throws away the whole subtree —
 * on the active-workout pill, that means remounting the thing whose entire job
 * is to persist. The server's string is kept for the first paint and the
 * interval corrects it within a second.
 */
export function Elapsed({
  start,
  running = true,
  className,
}: {
  start: Date | string | number;
  running?: boolean;
  className?: string;
}) {
  const seconds = useElapsed(start, running);
  return (
    <span className={className} suppressHydrationWarning>
      {formatDuration(seconds)}
    </span>
  );
}
