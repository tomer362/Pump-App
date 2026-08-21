"use client";

import { REST_PRESETS, restLabel } from "@/lib/rest";
import { cn } from "@/lib/utils";

/**
 * Rest duration chips, shared by the exercise sheet and the per-set sheet.
 *
 * Rest resolves through three levels — set override, then the exercise, then
 * `user.default_rest_seconds` — so the control has to express *two* different
 * kinds of "nothing": inherit the level above (`null`) and don't rest at all
 * (`0`). Those used to be conflated: the exercise sheet's chip was labelled
 * "Off" and wrote `null`, which the workout screen then read as "fall back to
 * the default", so turning rest off gave you the default rest. `null` is now
 * spelled "Inherit" and shows what it currently resolves to, and "Off" means
 * off.
 */
export function RestPicker({
  value,
  inherited,
  inheritLabel,
  onChange,
  idPrefix,
  hint,
}: {
  /** The stored value at this level: a duration, 0 for none, null to inherit. */
  value: number | null;
  /** What `null` resolves to here, so the inherit chip can name it. */
  inherited: number;
  /** What the level above is called — "exercise" or "your default". */
  inheritLabel: string;
  onChange: (seconds: number | null) => void;
  /** Distinguishes the instances when more than one is in the tree. */
  idPrefix?: string;
  hint?: React.ReactNode;
}) {
  /**
   * A value that isn't one of ours still has to read back. Imports, an LLM plan
   * and the API all accept 0–1800, so `150` is reachable — and a control that
   * highlights nothing is indistinguishable from one saying "no rest set",
   * which is how a routine's rest looked lost. Sorted in, so the odd one out
   * sits where its duration belongs rather than tacked on the end.
   */
  const presets =
    value != null && !(REST_PRESETS as readonly number[]).includes(value)
      ? [...REST_PRESETS, value].sort((a, b) => a - b)
      : REST_PRESETS;

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Rest duration"
        className="grid grid-cols-3 gap-1.5"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value == null}
          aria-label={`Inherit ${inheritLabel}, currently ${restLabel(inherited)}`}
          id={idPrefix ? `${idPrefix}-rest-inherit` : undefined}
          onClick={() => onChange(null)}
          className={cn(
            "press rounded-field col-span-3 h-10 border text-[13px] font-semibold",
            // Selected but neutral: inheriting is the state everything starts
            // in, and volt on a default is the decoration the accent rule
            // exists to prevent.
            value == null
              ? "border-hairline bg-surface-3 text-text-1"
              : "border-hairline bg-surface-2 text-text-2",
          )}
        >
          Same as {inheritLabel}{" "}
          <span className="num text-text-3">({restLabel(inherited)})</span>
        </button>

        {presets.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            aria-label={s === 0 ? "No rest" : `Rest ${restLabel(s)}`}
            onClick={() => onChange(s)}
            className={cn(
              "press num rounded-field h-10 border text-[13px] font-semibold",
              value === s
                ? "border-volt bg-volt-fade text-volt"
                : "border-hairline bg-surface-2 text-text-2",
            )}
          >
            {restLabel(s)}
          </button>
        ))}
      </div>
      {hint && (
        <p className="text-text-3 mt-2 text-[12px] leading-snug">{hint}</p>
      )}
    </>
  );
}
