"use client";

import { cn } from "@/lib/utils";
import { RPE_VALUES } from "@/lib/rpe";

/**
 * The effort chips, shared by every surface that writes an RPE: the workout
 * screen's set options, the quick-log sheet, the history detail page, and the
 * routine builder's *prescribed* effort.
 *
 * One definition rather than several, because they all write the same scale: a
 * value offered in one place and not another reads as a bug in whichever screen
 * the user reached second — and did, for a while. The routine builder hand-rolled
 * its own chips and its array was missing 6.5, so a routine could not prescribe
 * an effort that a logged set could record. Volt marks the chosen chip; that is
 * state the user set, which is what the accent is for.
 *
 * The scale itself lives in `lib/rpe.ts`, not here: server actions validate
 * against it, and they can't import a client component.
 */
export function RpePicker({
  value,
  onChange,
  idPrefix,
  hint,
}: {
  value: number | null;
  onChange: (rpe: number | null) => void;
  /** Distinguishes the instances when more than one is in the tree. */
  idPrefix?: string;
  /**
   * Replaces the default explanation. The scale is the same everywhere but the
   * sentence is not: a routine prescribes an effort ahead of time, a set records
   * one afterwards.
   */
  hint?: React.ReactNode;
}) {
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Effort (RPE)"
        className="grid grid-cols-5 gap-1.5"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value == null}
          aria-label="No effort rating"
          id={idPrefix ? `${idPrefix}-rpe-none` : undefined}
          onClick={() => onChange(null)}
          className={cn(
            "press rounded-field h-10 border text-[13px] font-semibold",
            // Selected, but neutral: "no rating" is the state every set starts
            // in, and volt on a default is the decoration the accent rule
            // exists to prevent. Still distinct from the unselected chips.
            value == null
              ? "border-hairline bg-surface-3 text-text-1"
              : "border-hairline bg-surface-2 text-text-2",
          )}
        >
          —
        </button>
        {RPE_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={`RPE ${v}`}
            onClick={() => onChange(v)}
            className={cn(
              "press num rounded-field h-10 border text-[13px] font-semibold",
              value === v
                ? "border-volt bg-volt-fade text-volt"
                : "border-hairline bg-surface-2 text-text-2",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="text-text-3 mt-2 text-[12px] leading-snug">
        {hint ?? (
          <>
            How hard the set felt. 10 is a set you couldn&apos;t have added a rep
            to; 8 leaves two in the tank.
          </>
        )}
      </p>
    </>
  );
}
