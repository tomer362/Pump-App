"use client";

import { ChevronDown, ChevronUp, PackageOpen } from "lucide-react";
import { IMPORTED_HINT_LIMIT } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * The one-line offer to reveal exercises the default scope is hiding —
 * the ones that arrived attached to a routine somebody sent.
 *
 * It is a hint rather than a filter chip because the answer is almost always
 * "no". Someone searching "curl" wants their own curls; the imported ones are
 * a footnote, and a permanent control would give a footnote the same weight as
 * the search box. It only ever renders when the user has *narrowed* — an
 * unfiltered picker shows the library as it is, with no editorialising.
 *
 * Nothing here is volt. Volt means a completed set, a running timer, a PR —
 * state that matters — and an exercise you haven't asked for isn't that. The
 * count is spelled out in the accessible name too, so the badge on the rows
 * below is never the only thing carrying the meaning.
 */
export function ImportedReveal({
  count,
  capped,
  open,
  onToggle,
  className,
}: {
  count: number;
  /** More matches exist than were fetched — say "25+", not a wrong number. */
  capped: boolean;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const shown = capped ? `${IMPORTED_HINT_LIMIT}+` : String(count);
  const spoken = capped
    ? `more than ${IMPORTED_HINT_LIMIT} exercises`
    : `${count} ${count === 1 ? "exercise" : "exercises"}`;

  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      aria-label={
        open
          ? `Hide ${spoken} from imported routines`
          : `Show ${spoken} from imported routines`
      }
      className={cn(
        "press tap flex w-full items-center gap-3 px-4 py-3 text-left",
        className,
      )}
    >
      <PackageOpen className="text-text-3 size-4 shrink-0" />
      <span className="text-text-2 flex-1 text-[14px]">
        {open ? "Hide" : "Show"} <span className="num">{shown}</span> from
        imported routines
      </span>
      {open ? (
        <ChevronUp className="text-text-3 size-4 shrink-0" />
      ) : (
        <ChevronDown className="text-text-3 size-4 shrink-0" />
      )}
    </button>
  );
}

/**
 * What the two list surfaces need to know about the probe results, derived in
 * one place so the picker and the browser can't disagree about when the hint
 * appears or what number it shows.
 */
export function importedRevealState<T>(imported: T[]) {
  const capped = imported.length > IMPORTED_HINT_LIMIT;
  return {
    /** Never render more than the cap, whatever came back. */
    rows: capped ? imported.slice(0, IMPORTED_HINT_LIMIT) : imported,
    count: capped ? IMPORTED_HINT_LIMIT : imported.length,
    capped,
    show: imported.length > 0,
  };
}
