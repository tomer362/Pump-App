"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { Check, Trash2 } from "lucide-react";
import { cn, formatWeight, haptic, kgToLb, lbToKg } from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";

export type SetDraft = {
  id: string;
  position: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  completed: boolean;
  isPr?: boolean;
};

/**
 * Which value columns an exercise's tracking type puts on the row. Kept here
 * so the header in `workout-screen` and the rows themselves can't drift apart
 * — the columns have to line up for this to read as a table.
 */
export type SetColumn = "weight" | "reps" | "seconds" | "distance";

export function setColumns(trackingType: string): SetColumn[] {
  switch (trackingType) {
    case "reps":
      return ["reps"];
    case "time":
      return ["seconds"];
    case "distance_time":
      return ["distance", "seconds"];
    case "weight_time":
      return ["weight", "seconds"];
    default:
      return ["weight", "reps"];
  }
}

/** The `SetDraft` field each value column edits. */
export type ValueField = "weightKg" | "reps" | "seconds" | "distanceM";

const COLUMN_FIELD: Record<SetColumn, ValueField> = {
  weight: "weightKg",
  reps: "reps",
  seconds: "seconds",
  distance: "distanceM",
};

/**
 * Push `value` down the sets below `from`, so filling in the first set of an
 * exercise prescribes the rest of it — the common case is four sets of the
 * same thing, and typing it four times is four times the work.
 *
 * A set the lifter has already given a number of its own is left alone and the
 * run continues past it; `locked` sets (completed ones on the workout screen)
 * are records of work performed, not a plan, so they're never rewritten.
 * `owned` is what an earlier keystroke of this same run filled: those follow
 * the source cell, otherwise typing "100" would strand the sets below on the
 * "1" and clearing the field would leave them stuck.
 */
export function cascadeBelow<S, K extends keyof S>({
  sets,
  from,
  field,
  value,
  keyOf,
  owned,
  locked,
}: {
  sets: S[];
  from: number;
  field: K;
  value: S[K];
  keyOf: (set: S) => string;
  owned: ReadonlySet<string>;
  locked?: (set: S) => boolean;
}): { sets: S[]; filled: string[] } {
  const filled: string[] = [];

  const next = sets.map((set, i) => {
    if (i <= from || locked?.(set)) return set;
    const key = keyOf(set);
    // Nothing to give an untouched set when the source itself is empty.
    if (!owned.has(key) && (set[field] != null || value == null)) return set;
    filled.push(key);
    return set[field] === value ? set : { ...set, [field]: value };
  });

  return { sets: filled.length ? next : sets, filled };
}

export function setGridTemplate(columns: SetColumn[]) {
  return `28px minmax(46px, 0.9fr) ${columns
    .map(() => "minmax(56px, 1fr)")
    .join(" ")} 44px`;
}

export function columnLabel(column: SetColumn, unit: "kg" | "lb") {
  switch (column) {
    case "weight":
      return unit;
    case "reps":
      return "Reps";
    case "seconds":
      return "Secs";
    case "distance":
      return "Metres";
  }
}

const TYPE_LABEL: Record<SetType, string> = {
  normal: "",
  warmup: "W",
  drop: "D",
  failure: "F",
};

const TYPE_COLOR: Record<SetType, string> = {
  normal: "text-text-2",
  warmup: "text-[#7fb3ff]",
  drop: "text-[#c191ff]",
  failure: "text-danger",
};

export function SetRow({
  set,
  index,
  unit,
  trackingType,
  previous,
  onPatch,
  onValueFocus,
  onValueDraft,
  onValueCommit,
  onToggleComplete,
  onDelete,
  onOpenTypeMenu,
}: {
  set: SetDraft;
  /** Display index among non-warmup sets — warmups don't consume a number. */
  index: number;
  unit: "kg" | "lb";
  trackingType: string;
  previous: {
    weightKg: number | null;
    reps: number | null;
    seconds: number | null;
    distanceM?: number | null;
  } | null;
  onPatch: (patch: Partial<SetDraft>) => void;
  /** A value cell took focus — the start of a fresh cascade run. */
  onValueFocus: (field: ValueField) => void;
  /** Every keystroke, local only. */
  onValueDraft: (field: ValueField, value: number | null) => void;
  /** Blur or Enter — the point at which the value reaches the server. */
  onValueCommit: (field: ValueField, value: number | null) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onOpenTypeMenu: () => void;
}) {
  const x = useMotionValue(0);
  // The bin fades in as the row is dragged left, so the gesture is discoverable.
  const binOpacity = useTransform(x, [-90, -30, 0], [1, 0.5, 0]);

  const columns = setColumns(trackingType);

  return (
    <div className="relative">
      {/* Delete affordance revealed by the swipe. */}
      <motion.div
        style={{ opacity: binOpacity }}
        className="bg-danger-fade absolute inset-y-0 right-0 flex w-[90px] items-center justify-end pr-5"
      >
        <Trash2 className="text-danger size-[18px]" strokeWidth={2.2} />
      </motion.div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        dragDirectionLock
        onDragEnd={(_, info) => {
          if (info.offset.x < -70 || info.velocity.x < -500) {
            haptic.medium();
            onDelete();
          } else {
            x.set(0);
          }
        }}
        className={cn(
          "relative px-3 py-1.5 transition-colors",
          // Completed rows tint volt — the single strongest state signal.
          set.completed ? "bg-volt-fade" : "bg-bg",
        )}
      >
        {/* Columns: set · previous · values… · check. Built as an inline grid
            template so columns line up across rows regardless of which inputs
            the exercise's tracking type shows. */}
        <div
          className="grid w-full items-center gap-1.5"
          style={{ gridTemplateColumns: setGridTemplate(columns) }}
        >
          {/* Set number / type tag. Also the way into per-set options — RPE
              lives there rather than in a column, because it's an occasional
              annotation and a sixth column would crush the row on a phone. */}
          <button
            onClick={() => {
              haptic.light();
              onOpenTypeMenu();
            }}
            className={cn(
              "press h-9 rounded-lg leading-none",
              set.setType === "normal"
                ? set.completed
                  ? "text-black/70"
                  : "text-text-2"
                : TYPE_COLOR[set.setType],
            )}
            aria-label={`Set ${index} options`}
          >
            <span className="num block text-[14px] font-bold">
              {set.setType === "normal" ? index : TYPE_LABEL[set.setType]}
            </span>
            {set.rpe != null && (
              <span
                className={cn(
                  "num mt-0.5 block text-[9px] font-bold",
                  set.completed ? "text-black/45" : "text-text-3",
                )}
              >
                @{set.rpe}
              </span>
            )}
          </button>

          {/* Previous — tap to copy into the inputs */}
          <button
            onClick={() => {
              if (!previous) return;
              haptic.light();
              onPatch({
                weightKg: previous.weightKg ?? set.weightKg,
                reps: previous.reps ?? set.reps,
                seconds: previous.seconds ?? set.seconds,
                distanceM: previous.distanceM ?? set.distanceM,
              });
            }}
            disabled={!previous}
            className={cn(
              "num h-9 truncate text-center text-[13px] font-medium",
              set.completed ? "text-black/50" : "text-text-3",
              previous && "press active:text-volt",
            )}
          >
            {previousLabel(previous, columns, unit)}
          </button>

          {columns.map((column) => (
            <ValueCell
              key={column}
              column={column}
              set={set}
              previous={previous}
              unit={unit}
              onFocus={onValueFocus}
              onDraft={onValueDraft}
              onCommit={onValueCommit}
            />
          ))}

          {/* Complete */}
          <button
            onClick={() => {
              haptic.medium();
              onToggleComplete();
            }}
            aria-label={set.completed ? "Mark set incomplete" : "Complete set"}
            aria-pressed={set.completed}
            className={cn(
              "press grid h-9 w-11 place-items-center rounded-[10px] transition-colors",
              set.completed
                ? "bg-volt text-black"
                : "bg-surface-2 text-text-3 hover:text-text-1",
            )}
          >
            <Check className="size-[18px]" strokeWidth={3} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type Previous = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM?: number | null;
} | null;

/** The last session's value for this set, in whatever the exercise measures. */
function previousLabel(
  previous: Previous,
  columns: SetColumn[],
  unit: "kg" | "lb",
) {
  if (!previous) return "—";

  const parts = columns
    .map((column) => {
      switch (column) {
        case "weight":
          return previous.weightKg != null
            ? formatWeight(previous.weightKg, unit)
            : null;
        case "reps":
          return previous.reps != null ? String(previous.reps) : null;
        case "seconds":
          return previous.seconds != null ? `${previous.seconds}s` : null;
        case "distance":
          return previous.distanceM != null ? `${previous.distanceM}m` : null;
      }
    })
    .filter((p): p is string => p != null);

  return parts.length ? parts.join("×") : "—";
}

function ValueCell({
  column,
  set,
  previous,
  unit,
  onFocus,
  onDraft,
  onCommit,
}: {
  column: SetColumn;
  set: SetDraft;
  previous: Previous;
  unit: "kg" | "lb";
  onFocus: (field: ValueField) => void;
  onDraft: (field: ValueField, value: number | null) => void;
  onCommit: (field: ValueField, value: number | null) => void;
}) {
  const field = COLUMN_FIELD[column];
  const isWeight = field === "weightKg";
  const current = set[field];
  const prior = previous?.[field] ?? null;

  // One parse for both channels. The value a keystroke cascades downward has to
  // be the same number the blur then persists, or the row would settle onto
  // something other than what the sets below were given.
  const relay =
    (to: (field: ValueField, value: number | null) => void) => (raw: string) => {
      if (raw === "") return to(field, null);
      const n = isWeight ? Number(raw) : Math.round(Number(raw));
      if (!Number.isFinite(n)) return;
      to(field, isWeight && unit === "lb" ? lbToKg(n) : n);
    };

  return (
    <NumberCell
      value={
        current == null
          ? ""
          : isWeight
            ? String(
                Math.round((unit === "kg" ? current : kgToLb(current)) * 100) /
                  100,
              )
            : String(current)
      }
      placeholder={
        prior == null ? "0" : isWeight ? formatWeight(prior, unit) : String(prior)
      }
      completed={set.completed}
      integer={!isWeight}
      onFocus={() => onFocus(field)}
      onDraft={relay(onDraft)}
      onCommit={relay(onCommit)}
    />
  );
}

/**
 * A numeric cell that only commits on blur/Enter, so re-renders can't fight
 * the user's typing, and shows the previous session's value as a placeholder
 * — that's what makes an unchanged set a single tap.
 *
 * `onDraft` is the separate live channel the cascade rides on. It reports what
 * has been typed without disturbing `local`, so the commit guard above stays
 * exactly as strict as it was: this cell is still the only writer of its own
 * text, and a cascade landing on a *different* row's `value` reaches that row
 * through the unfocused branch of the effect below.
 */
function NumberCell({
  value,
  placeholder,
  completed,
  integer,
  onFocus,
  onDraft,
  onCommit,
}: {
  value: string;
  placeholder: string;
  completed: boolean;
  integer?: boolean;
  onFocus: () => void;
  onDraft: (raw: string) => void;
  onCommit: (raw: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);

  return (
    <input
      value={local}
      inputMode={integer ? "numeric" : "decimal"}
      enterKeyHint="done"
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        onFocus();
        // Select-all means overwriting is one tap, not tap-then-clear.
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        setLocal(raw);
        onDraft(raw);
      }}
      onBlur={() => {
        focused.current = false;
        onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        "num h-9 w-full rounded-[10px] text-center text-[16px] font-semibold",
        "border outline-none transition-colors",
        completed
          ? "border-transparent bg-transparent text-black placeholder:text-black/30"
          : "border-hairline bg-surface-2 text-text-1 placeholder:text-text-3/60 focus:border-volt/60",
      )}
    />
  );
}
