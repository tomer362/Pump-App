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
import { Check, Clock, Pencil, Trash2 } from "lucide-react";
import {
  cn,
  formatDuration,
  formatWeight,
  haptic,
  kgToLb,
  lbToKg,
} from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";
import { rpeSubscript } from "@/lib/rpe";
import { EASE_OUT_QUART } from "@/lib/motion";
import { useRemaining } from "./rest-timer";

export type SetDraft = {
  id: string;
  position: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  /** What it felt like, rated by the lifter. */
  rpe: number | null;
  /** What the routine prescribed. Rendered as `→8`, never as a rating. */
  targetRpe: number | null;
  /** Rest after this set, overriding the exercise's. Null inherits. */
  restSeconds: number | null;
  completed: boolean;
  isPr?: boolean;
};

/**
 * Which value columns an exercise's tracking type puts on the row. Kept here
 * so the header in `workout-screen` and the rows themselves can't drift apart
 * — the columns have to line up for this to read as a table.
 */
export type SetColumn = "weight" | "assist" | "reps" | "seconds" | "distance";

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
    // Same input and same stored column as `weight`, and deliberately the same
    // width — it is still the load cell of the table. It is a separate column
    // only so the header can say which direction is progress: an assisted
    // machine's number is help received, and 40 in that cell is a worse set
    // than 20. See `lib/tracking.ts` for what that costs it downstream.
    case "assist_reps":
      return ["assist", "reps"];
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
    // The minus is the whole message: this column comes *off* your bodyweight,
    // so the trend that means you are getting stronger is downward. A header
    // reading plain "kg" over a counterweight is the misreading that made the
    // machine look like it was loading you.
    case "assist":
      return `−${unit}`;
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
  flash,
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
  /** Just jumped to from elsewhere on the screen — tinted so it's findable. */
  flash?: boolean;
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
  const subscript = rpeSubscript(set);

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
          // select-none because the whole row is the drag target: a swipe that
          // starts on the set number and travels sideways is how a selection
          // gets painted across the row. The inputs opt back in — globals.css.
          "relative px-3 py-1.5 transition-colors duration-500 select-none",
          // Completed rows tint volt — the single strongest state signal.
          // The jump flash is deliberately neutral: it marks a row you still
          // owe, and volt here would read as "already done".
          set.completed ? "bg-volt-fade" : flash ? "bg-surface-2" : "bg-bg",
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
              annotation and a sixth column would crush the row on a phone.
              (Nine half-points at a 44px tap target is 396px of chips; there is
              no one-tap version of this scale that fits a phone, which is why
              it is a sheet.)

              The subscript carries one of three things (`rpeSubscript` owns the
              table): `@8` you rated it, `@–` it's done and you haven't, `→8`
              the routine prescribed it. The `@–` placeholder shows on every
              completed set because it used to appear only once a rating existed,
              so the one gesture that sets an RPE was advertised by the state it
              produced and by nothing else — the feature read as missing
              entirely. The button is a fixed h-9 whichever it shows, so none of
              them costs a reflow.

              A prescription is a *glyph* apart, not a shade apart: two greys at
              9px on a phone in a gym are not a difference, and on a completed
              row's volt tint they collapse. Volt is out of the question — it
              marks state the lifter produced, and a target is the one thing here
              they haven't. */}
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
            aria-label={
              set.rpe != null
                ? `Set ${index} options — effort ${set.rpe}`
                : subscript?.kind === "prescribed"
                  ? `Set ${index} options — target effort ${set.targetRpe}, not yet rated`
                  : `Set ${index} options — no effort rating`
            }
          >
            <span className="num block text-[14px] font-bold">
              {set.setType === "normal" ? index : TYPE_LABEL[set.setType]}
            </span>
            {subscript && (
              <span
                aria-hidden
                className={cn(
                  "num mt-0.5 block text-[9px] font-bold",
                  set.completed
                    ? subscript.kind === "rated"
                      ? "text-black/45"
                      : "text-black/25"
                    : "text-text-3",
                )}
              >
                {subscript.text}
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
                // Distinct from the checkmark's key below — they are siblings,
                // and sharing `pop` made every tick a duplicate-key warning.
                key={`ring-${pop}`}
                initial={{ opacity: 0.85, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.85 }}
                transition={{ duration: 0.42, ease: EASE_OUT_QUART }}
                className="border-volt pointer-events-none absolute inset-0 rounded-[10px] border-2"
              />
            )}
            <motion.span
              key={`check-${pop}`}
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

/**
 * The rest that follows a set, as its own strip between two rows.
 *
 * Deliberately not a sixth column: rest is not a measurement of the set, it's
 * the gap after it, and the whole point of putting it in the flow of the table
 * is that you can see where the gaps are uneven. Small caps, no numerals in the
 * table's own column grid — a divider that happens to carry a value.
 *
 * It is recessed (`bg-surface-1`) only while the set above is unticked. Once
 * that set is done the gap has been *served*, which is the same finished state
 * the row above carries, so it takes the same tint — a block of completed sets
 * used to read as stripes, volt row, grey gap, volt row. The recess stays where
 * it still answers something live: the rest you have yet to take. That also
 * means the strip no longer snaps back to grey when the timer's 2.5s "Rest
 * done" window expires; the finished rest simply stays finished.
 *
 * Volt marks a set that carries its *own* rest rather than the exercise's. That
 * is state the lifter set, which is exactly what the accent is for, and it is
 * the only way to tell the two apart once the sheet is closed.
 *
 * 40px rather than 44: this repeats between every working set, so the tap rule's
 * minimum would add ~90px to a three-set exercise on the one screen the design
 * keeps dense. It matches the height of `RpePicker`'s chips, which is the
 * established floor for a repeated control in this app, and it is full-bleed
 * horizontally — the axis a thumb actually misses in.
 */
export function RestStrip({
  seconds,
  override,
  completed,
  runningTotal,
  onEdit,
  onOpenTimer,
}: {
  /** Resolved rest, after the set → exercise → account fallback. */
  seconds: number;
  /** True when this set carries its own value instead of inheriting. */
  override: boolean;
  /**
   * The set above is ticked, so this gap has been served rather than merely
   * configured. Carries the completed row's tint.
   */
  completed: boolean;
  /**
   * The running timer's full duration when *this* gap is the one counting down,
   * else null. Non-null swaps in the live variant, which is the only strip that
   * subscribes to the clock.
   */
  runningTotal: number | null;
  /**
   * Open the rest editor for this gap. The primary action on an idle strip:
   * tapping it no longer starts the clock, it opens the sheet where the duration
   * is adjusted and — once the set above is completed — the rest is started.
   * Starting a rest for a set you haven't finished isn't a thing you'd want.
   */
  onEdit: () => void;
  /**
   * Reveals the rest bar — its controls (pause, ±15s, skip), not a settings
   * sheet. The primary action on the strip whose gap is counting down.
   */
  onOpenTimer: () => void;
}) {
  if (runningTotal != null) {
    return (
      <LiveRestStrip
        total={runningTotal}
        override={override}
        onOpen={onOpenTimer}
        onEdit={onEdit}
      />
    );
  }
  // Idle, whether or not it carries a duration: the whole strip opens the
  // editor. There is no tap-to-start here anymore — start lives inside the
  // sheet, behind the completion gate.
  return (
    <RestStripShell
      onPrimary={onEdit}
      label={
        seconds === 0
          ? "No rest after this set. Tap to change it."
          : `Rest ${formatDuration(seconds)} after this set${
              override ? ", set just for this set" : ""
            }. Tap to adjust or start.`
      }
      accent={override}
      served={completed}
      value={seconds === 0 ? "None" : formatDuration(seconds)}
    />
  );
}

/**
 * The strip for the gap that is actually running.
 *
 * Same countdown as the bar, from the same store, because two numbers on one
 * screen describing one rest have to agree — the bar used to read 1:56 while
 * the strip three rows up still said 2:00, and there is no reading of that
 * which isn't a bug. The draining track is the bar's own device, reused: it is
 * the same rest, so it gets the same language.
 */
function LiveRestStrip({
  total,
  override,
  onOpen,
  onEdit,
}: {
  total: number;
  override: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const remaining = useRemaining();
  const progress = total > 0 ? remaining / total : 0;
  // The store holds a finished rest for a couple of seconds so the 0:00 is
  // seen. The strip used to spend those seconds still saying "RESTING", which
  // is the one thing the rest is no longer doing; it now says so in the same
  // words and the same volt the bar uses, and drops the drain overlay so the
  // gap settles to one flat tint instead of an empty trough.
  const done = remaining === 0;

  return (
    <RestStripShell
      onPrimary={onOpen}
      onEdit={onEdit}
      label={
        done
          ? "Rest complete. Open the rest timer."
          : `Resting, ${formatDuration(remaining)} left. Open the rest timer.`
      }
      accent
      running
      done={done}
      value={formatDuration(remaining)}
      track={done ? undefined : progress}
      caption={done ? "Rest done" : override ? "Rest" : "Resting"}
    />
  );
}

function RestStripShell({
  onPrimary,
  onEdit,
  label,
  accent,
  running,
  served,
  done,
  value,
  track,
  caption = "Rest",
}: {
  /** Tapping the body of the strip: start the rest, or open the running timer. */
  onPrimary: () => void;
  /** The pencil, opening the duration editor. Omitted when the body edits. */
  onEdit?: () => void;
  label: string;
  /** Volt: either a set carrying its own value, or the gap that's running. */
  accent: boolean;
  running?: boolean;
  /** The gap is behind you: the set above it is complete. */
  served?: boolean;
  /** The running rest has hit zero and is on its way out. */
  done?: boolean;
  value: string;
  /** 0–1 remaining, drawn as a draining fill. */
  track?: number;
  caption?: string;
}) {
  // A div, not a button: the pencil is its own button and buttons don't nest.
  return (
    <div
      className={cn(
        "hairline-t relative flex h-10 w-full items-center overflow-hidden",
        // 500ms is `SetRow`'s own tint transition: ticking a set has to colour
        // the row and the gap under it as one movement, not two.
        "transition-colors duration-500",
        // `bg-volt-tint` is `bg-volt-fade` over the page background, already
        // blended — the same colour this strip has always rendered, but opaque,
        // so it, the completed row above it and the rest bar are one state by
        // construction rather than by all three happening to sit on
        // `--color-bg`. A served gap gets it too: it is the same finished state
        // as the row, which is why a run of completed sets stopped striping.
        running || done || served ? "bg-volt-tint" : "bg-surface-1",
      )}
    >
      {track != null && (
        <span
          aria-hidden
          className="bg-volt-fade absolute inset-y-0 left-0 w-full origin-left"
          style={{
            transform: `scaleX(${track})`,
            transition: "transform 250ms linear",
          }}
        />
      )}
      <button
        onClick={() => {
          haptic.light();
          onPrimary();
        }}
        aria-label={label}
        className="press relative flex h-full min-w-0 flex-1 items-center justify-center gap-2 select-none"
      >
        <Clock
          className={cn("size-3", accent ? "text-volt" : "text-text-3")}
          strokeWidth={2.4}
        />
        <span
          className={cn(
            "text-[10px] font-bold tracking-[0.1em] uppercase",
            done ? "text-volt" : "text-text-3",
          )}
        >
          {caption}
        </span>
        <span
          className={cn(
            "num text-[12px] font-semibold",
            accent ? "text-volt" : "text-text-2",
          )}
        >
          {value}
        </span>
      </button>
      {onEdit && (
        <button
          onClick={() => {
            haptic.light();
            onEdit();
          }}
          aria-label="Edit rest"
          className="press text-text-3 relative grid h-full place-items-center px-3.5"
        >
          <Pencil className="size-3.5" strokeWidth={2.2} />
        </button>
      )}
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
        case "assist":
          return previous.weightKg != null
            ? `−${formatWeight(previous.weightKg, unit)}`
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
  // `assist` writes the same column: it is a weight, only pointing the other
  // way, and a second storage field would have to be kept in step with this one
  // through every fill, copy-previous and routine import.
  if (column === "weight" || column === "assist") {
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
