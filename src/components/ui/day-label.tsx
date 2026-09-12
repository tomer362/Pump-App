"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDayLabel } from "@/lib/utils";

/**
 * "Today" / "Yesterday" / "Tuesday" — relative to the *device's* day.
 *
 * The server renders in UTC and the phone in its own zone, so around midnight
 * the two disagree and React throws the subtree away — on a list, the list.
 * Same shape as `<TimeAgo>`: paint the server's string, then correct it once
 * mounted, and suppress the warning for the one node that legitimately
 * differs.
 */
export function DayLabel({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const at = useMemo(
    () => (typeof date === "string" ? new Date(date) : date),
    [date],
  );
  const [label, setLabel] = useState(() => formatDayLabel(at));

  useEffect(() => {
    // A frame later, not synchronously: the first client render has to keep
    // the server's string for hydration, and the correction is one paint
    // behind it either way.
    const id = requestAnimationFrame(() => setLabel(formatDayLabel(at)));
    return () => cancelAnimationFrame(id);
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
