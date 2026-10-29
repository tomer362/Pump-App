"use client";

import { Minus, Plus } from "lucide-react";
import type { SetColumn } from "@/components/workout/set-row";
import { sanitizeDecimalInput } from "@/lib/set-input";
import { cn, haptic, kgToLb, lbToKg } from "@/lib/utils";

/**
 * One set value as a stepper and a big numeric field — the quick-log sheet's
 * control, shared with the history editor so a set reads and corrects the same
 * way wherever it is typed after the fact. The workout screen's table cells are
 * a different control on purpose: that screen is dense, these sheets are not.
 */
export const FIELD_LABEL =
  "text-text-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase";

/**
 * `htmlFor` only when there is a real form control to point at — the RPE chips
 * are a radiogroup of buttons, which a `<label>` cannot name, so that one
 * carries its own `aria-label` and this renders as plain text.
 */
export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  if (!htmlFor) return <p className={FIELD_LABEL}>{children}</p>;
  return (
    <label htmlFor={htmlFor} className={FIELD_LABEL}>
      {children}
    </label>
  );
}

export const STEP: Record<SetColumn, number> = {
  weight: 2.5,
  assist: 2.5,
  reps: 1,
  seconds: 5,
  distance: 10,
};

export function Field({
  column,
  unit,
  value,
  onChange,
  idPrefix = "quick-log",
}: {
  column: SetColumn;
  unit: "kg" | "lb";
  value: string;
  onChange: (v: string) => void;
  /** Keeps `<label htmlFor>` pointing at this instance's input. */
  idPrefix?: string;
}) {
  const step = STEP[column];
  // Assistance is a weight, so it steps in halves like one — stacks go up in
  // 2.5s but a band or a plate-loaded pad does not.
  const integer =
    column !== "weight" && column !== "assist" && column !== "distance";

  function bump(by: number) {
    haptic.light();
    const next = Math.max(0, (num(value) ?? 0) + by);
    onChange(integer ? String(Math.round(next)) : trim(next));
  }

  return (
    <div>
      <FieldLabel htmlFor={`${idPrefix}-${column}`}>
        {LABEL[column](unit)}
      </FieldLabel>
      <div className="mt-1.5 flex items-stretch gap-2">
        <Stepper label={`Decrease ${column}`} onClick={() => bump(-step)}>
          <Minus className="size-5" strokeWidth={2.6} />
        </Stepper>
        <input
          id={`${idPrefix}-${column}`}
          value={value}
          // 16px minimum, or iOS zooms the whole page on focus.
          inputMode={integer ? "numeric" : "decimal"}
          enterKeyHint="done"
          placeholder="0"
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }}
          onChange={(e) => onChange(sanitizeDecimalInput(e.target.value, integer))}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            "num border-hairline bg-surface-2 text-text-1 flex-1 rounded-[12px]",
            "h-12 text-center text-[20px] font-bold outline-none",
            "placeholder:text-text-3/50 focus:border-volt/60 border transition-colors",
          )}
        />
        <Stepper label={`Increase ${column}`} onClick={() => bump(step)}>
          <Plus className="size-5" strokeWidth={2.6} />
        </Stepper>
      </div>
    </div>
  );
}

export function Stepper({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press bg-surface-2 text-text-2 border-hairline grid size-12 shrink-0 place-items-center rounded-[12px] border"
    >
      {children}
    </button>
  );
}

export const LABEL: Record<SetColumn, (unit: "kg" | "lb") => string> = {
  weight: (unit) => `Weight (${unit})`,
  // Named, not just signed: this sheet has room for the word, and "assistance"
  // is what stops the number being read as load lifted.
  assist: (unit) => `Assistance (−${unit})`,
  reps: () => "Reps",
  seconds: () => "Seconds",
  distance: () => "Metres",
};

export function num(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Drop a trailing `.0` so a stepped weight reads "62.5", not "62.50000". */
export function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function displayWeight(kg: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

export function storedWeight(shown: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? shown : lbToKg(shown);
}
