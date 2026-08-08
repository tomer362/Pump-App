"use client";

import { cn } from "@/lib/utils";

/** RPE is logged on the half point from 6 up — below that nobody bothers. */
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/**
 * The effort chips, shared by the workout screen's set options and the
 * quick-log sheet.
 *
 * One definition rather than two, because the two surfaces write the same
 * column: a value offered in one place and not the other would read as a bug
 * in whichever screen the user reached second. Volt marks the chosen chip —
 * that is state the user set, which is what the accent is for.
 */
export function RpePicker({
  value,
  onChange,
  idPrefix,
}: {
  value: number | null;
  onChange: (rpe: number | null) => void;
  /** Distinguishes the two instances when both are in the tree. */
  idPrefix?: string;
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
        How hard the set felt. 10 is a set you couldn&apos;t have added a rep
        to; 8 leaves two in the tank.
      </p>
    </>
  );
}
