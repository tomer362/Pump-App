"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
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
  onPatch: (
    patch: Partial<SetDraft>,
    opts?: { fill?: boolean; local?: boolean },
  ) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onOpenTypeMenu: () => void;
}) {
  const reduce = useReducedMotion();
  // Counts flips into "done" rather than mirroring `completed`, so the burst
  // replays on every tick and never fires for a row that mounts already done.
  const [pop, setPop] = useState(0);
  const wasCompleted = useRef(set.completed);
  useEffect(() => {
    if (set.completed && !wasCompleted.current) setPop((n) => n + 1);
    wasCompleted.current = set.completed;
  }, [set.completed]);

  const x = useMotionValue(0);
  // The bin fades in as the row is dragged left, so the gesture is
  // discoverable — and only takes taps once it is actually showing, so a
  // closed row's checkmark and inputs are never shadowed by it.
  const binOpacity = useTransform(x, [-90, -30, 0], [1, 0.5, 0]);
  const binPointer = useTransform(x, (v) => (v < -8 ? "auto" : "none"));

  /**
   * The swipe is started by hand rather than by motion's own listener.
   *
   * Motion won't begin a drag whose pointer-down landed on a form control, and
   * the two number inputs are most of this row's width — so the gesture worked
   * from the narrow strips at either end and did nothing from the middle. That
   * inconsistency is most of what made it feel broken. Starting the session
   * ourselves makes the whole row swipeable; a tap still focuses the input,
   * because a drag only begins once the pointer has actually moved.
   */
  const dragControls = useDragControls();

  // Rows are keyed by set id, so this is belt-and-braces against DOM reuse
  // leaving a new row parked at the previous one's offset.
  useEffect(() => {
    x.set(0);
  }, [set.id, x]);

  const columns = setColumns(trackingType);

  const remove = () => {
    haptic.medium();
    onDelete();
  };

  return (
    <div className="relative">
      {/* Delete affordance revealed by the swipe. A real button, so a row left
          half-open can be finished with a tap rather than re-swiped. */}
      <motion.button
        type="button"
        aria-label={`Delete set ${index}`}
        tabIndex={-1}
        onClick={remove}
        style={{ opacity: binOpacity, pointerEvents: binPointer }}
        className="bg-danger-fade absolute inset-y-0 right-0 flex w-[90px] items-center justify-end pr-5"
      >
        <Trash2 className="text-danger size-[18px]" strokeWidth={2.2} />
      </motion.button>

      <motion.div
        drag="x"
        // Vertical scrolling stays with the page. Without this the browser has
        // to wait for the gesture to resolve before it will scroll, which is
        // what made the list feel like it was catching on every row.
        style={{ x, touchAction: "pan-y" }}
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        dragDirectionLock
        // Without this the row can coast past the constraint on a flick and
        // settle half-open — one of the states that read as broken.
        dragMomentum={false}
        dragListener={false}
        dragControls={dragControls}
        onPointerDown={(e) => {
          // Except while this row is being edited: with the keyboard up, a
          // sideways drag is someone placing a caret, not deleting the set
          // they are in the middle of typing into.
          const active = document.activeElement;
          if (active instanceof HTMLInputElement && e.currentTarget.contains(active)) {
            return;
          }
          dragControls.start(e);
        }}
        onDragEnd={(_, info) => {
          // A swipe only counts if it was unambiguously sideways: scrolling
          // the list with a thumb that drifts left is not a delete.
          const sideways =
            Math.abs(info.offset.x) > Math.abs(info.offset.y) * 2;
          const decisive =
            info.offset.x < -80 || (info.velocity.x < -800 && info.offset.x < -40);
          if (sideways && decisive) remove();
          // Spring back rather than jump back — the instant reset was the
          // other half of why this felt broken.
          else animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
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
              onPatch={onPatch}
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
              "press relative grid h-9 w-11 place-items-center rounded-[10px] transition-colors",
              set.completed
                ? "bg-volt text-black"
                : "bg-surface-2 text-text-3 hover:text-text-1",
            )}
          >
            {/* A ring thrown off the tick. This is the moment the whole screen
                exists for, and haptics are Android-only — it needs to land
                visually too. Un-ticking is a correction, so it stays silent. */}
            {pop > 0 && !reduce && (
              <motion.span
                key={pop}
                initial={{ opacity: 0.85, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.85 }}
                transition={{ duration: 0.42, ease: [0.25, 1, 0.5, 1] }}
                className="border-volt pointer-events-none absolute inset-0 rounded-[10px] border-2"
              />
            )}
            <motion.span
              key={pop}
              // No entrance on mount or on un-ticking — only on the flip to done.
              initial={pop === 0 || reduce ? false : { scale: 0.45 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 620, damping: 20 }}
              className="grid place-items-center"
            >
              <Check className="size-[18px]" strokeWidth={3} />
            </motion.span>
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
  onPatch,
}: {
  column: SetColumn;
  set: SetDraft;
  previous: Previous;
  unit: "kg" | "lb";
  onPatch: (
    patch: Partial<SetDraft>,
    opts?: { fill?: boolean; local?: boolean },
  ) => void;
}) {
  if (column === "weight") {
    // One parser for both channels, so what you see mid-keystroke is exactly
    // what gets written on blur — including the lb→kg conversion.
    const submit = (raw: string, local: boolean) => {
      const n = raw === "" ? null : Number(raw);
      if (n != null && !Number.isFinite(n)) return;
      onPatch(
        { weightKg: n == null ? null : unit === "kg" ? n : lbToKg(n) },
        // Typing a value carries it down the empty sets below it —
        // clearing one never does. See `patchSet` for the exact run.
        { fill: n != null, local },
      );
    };
    return (
      <NumberCell
        value={
          set.weightKg == null
            ? ""
            : String(
                Math.round(
                  (unit === "kg" ? set.weightKg : kgToLb(set.weightKg)) * 100,
                ) / 100,
              )
        }
        placeholder={
          previous?.weightKg != null ? formatWeight(previous.weightKg, unit) : "0"
        }
        completed={set.completed}
        onDraft={(raw) => submit(raw, true)}
        onCommit={(raw) => submit(raw, false)}
      />
    );
  }

  const field = column === "reps" ? "reps" : column === "seconds" ? "seconds" : "distanceM";
  const current = set[field];
  const prior = previous?.[field] ?? null;

  const submit = (raw: string, local: boolean) => {
    const n = raw === "" ? null : Math.round(Number(raw));
    if (n != null && !Number.isFinite(n)) return;
    onPatch({ [field]: n } as Partial<SetDraft>, { fill: n != null, local });
  };

  return (
    <NumberCell
      value={current == null ? "" : String(current)}
      placeholder={prior != null ? String(prior) : "0"}
      completed={set.completed}
      integer
      onDraft={(raw) => submit(raw, true)}
      onCommit={(raw) => submit(raw, false)}
    />
  );
}

/**
 * A numeric cell that persists on blur/Enter, so re-renders can't fight the
 * user's typing, and shows the previous session's value as a placeholder —
 * that's what makes an unchanged set a single tap.
 *
 * `onDraft` is the second, local-only channel: it reports every keystroke so
 * the fill down the sets below can keep up with what's being typed, without
 * a round-trip per character. `onCommit` is still the only thing that writes.
 */
function NumberCell({
  value,
  placeholder,
  completed,
  integer,
  onDraft,
  onCommit,
}: {
  value: string;
  placeholder: string;
  completed: boolean;
  integer?: boolean;
  onDraft?: (raw: string) => void;
  onCommit: (raw: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);

  // Refs so the teardown below can read the latest values without listing them
  // as deps — re-subscribing `pagehide` on every keystroke would be silly.
  const localRef = useRef(local);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    localRef.current = local;
  }, [local]);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    valueRef.current = value;
    if (!focused.current) setLocal(value);
  }, [value]);

  // Blur normally commits, but two paths skip it: navigating away unmounts this
  // row before the blur handler runs, and iOS swiping the installed PWA away
  // fires no ordinary DOM events at all. Both would lose the pending edit.
  useEffect(() => {
    const commitIfDirty = () => {
      if (focused.current && localRef.current !== valueRef.current) {
        onCommitRef.current(localRef.current);
      }
    };
    window.addEventListener("pagehide", commitIfDirty);
    return () => {
      window.removeEventListener("pagehide", commitIfDirty);
      commitIfDirty();
    };
  }, []);

  return (
    <input
      value={local}
      inputMode={integer ? "numeric" : "decimal"}
      enterKeyHint="done"
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        // Select-all means overwriting is one tap, not tap-then-clear.
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        setLocal(raw);
        onDraft?.(raw);
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
