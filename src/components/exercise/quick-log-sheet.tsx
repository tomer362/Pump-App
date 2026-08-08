"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDays, Gauge, Minus, Plus, Trophy, Undo2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useMotionPreset } from "@/hooks/use-motion-preset";
import { REDUCED } from "@/lib/motion";
import { setColumns, type SetColumn } from "@/components/workout/set-row";
import { RpePicker } from "@/components/workout/rpe-picker";
import {
  dayKeyToLocalDate,
  shiftDay,
  todayKey,
  type DayKey,
} from "@/lib/day";
import {
  getQuickLogPrefill,
  quickLogSet,
  undoQuickLogSet,
  type QuickLogPrefill,
} from "@/lib/actions/quick-log";
import {
  cn,
  formatDayLabel,
  formatWeight,
  haptic,
  kgToLb,
  lbToKg,
} from "@/lib/utils";

/** Matches MAX_BACKDATE_DAYS in `lib/actions/quick-log.ts`. */
const MAX_BACKDATE_DAYS = 365;

export type QuickLogSetValues = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
};

type Logged = {
  setId: string;
  label: string;
  isPr: boolean;
  /** Shown on the row only when it isn't today — see the list below. */
  day: DayKey;
};

/**
 * Log one set against this exercise without starting a workout.
 *
 * Prefilled from the last session's top set, because the overwhelmingly common
 * case is repeating what you did — that makes the whole interaction two taps.
 * The set counts the moment it is saved; see `lib/actions/quick-log.ts` for why
 * that needs a workout row of its own.
 */
export function QuickLogSheet({
  open,
  onClose,
  exerciseId,
  exerciseName,
  trackingType,
  unit,
  prefill,
  activeWorkoutId,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  trackingType: string;
  unit: "kg" | "lb";
  prefill: QuickLogSetValues | null;
  activeWorkoutId: string | null;
}) {
  const router = useRouter();
  const keyboardInset = useKeyboardInset();
  const { enabled, spring } = useMotionPreset();
  const columns = setColumns(trackingType);

  // Weight is held in the user's display unit and converted at the edge, the
  // same rule the rest of the app follows: kilograms are what gets stored.
  const [weight, setWeight] = useState(() =>
    prefill?.weightKg != null ? trim(displayWeight(prefill.weightKg, unit)) : "",
  );
  const [reps, setReps] = useState(() =>
    prefill?.reps != null ? String(prefill.reps) : "",
  );
  const [seconds, setSeconds] = useState(() =>
    prefill?.seconds != null ? String(prefill.seconds) : "",
  );
  const [distance, setDistance] = useState(() =>
    prefill?.distanceM != null ? String(prefill.distanceM) : "",
  );

  const [rpe, setRpe] = useState<number | null>(null);
  // Safe as a plain initialiser, unlike the app's other time-relative values:
  // this sheet is mounted only after a tap — `{open && <QuickLogSheet/>}` in
  // the dock, and `QuickLogLauncher` mounts after its fetch — so it never
  // renders on the server and there is no hydration text to mismatch.
  const [day, setDay] = useState<DayKey>(todayKey);

  const [logged, setLogged] = useState<Logged[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const today = todayKey();
  const backdated = day !== today;

  // The receipt sits below the effort chips, which on a phone puts it under the
  // fold — so a saved set would look like nothing happened, and Undo would be
  // unreachable without a hunt. Scrolls the sheet's own scroller, not the
  // document, which the app never moves.
  const loggedRef = useRef<HTMLDivElement>(null);

  const values = {
    weight: num(weight),
    reps: num(reps),
    seconds: num(seconds),
    distance: num(distance),
  };

  // The same rule the action enforces: a set has to record something.
  const canSave =
    (values.reps ?? 0) > 0 ||
    (values.seconds ?? 0) > 0 ||
    (values.distance ?? 0) > 0;

  function save() {
    setError(null);
    startSaving(async () => {
      // Recomputed here rather than read off render state, so a sheet left open
      // across midnight sends the day it actually meant.
      const sentDay = day;
      const res = await quickLogSet({
        exerciseId,
        rpe,
        date: sentDay,
        tzOffsetMinutes: new Date().getTimezoneOffset(),
        weightKg:
          columns.includes("weight") && values.weight != null
            ? storedWeight(values.weight, unit)
            : null,
        reps: columns.includes("reps") ? (values.reps ?? null) : null,
        seconds: columns.includes("seconds") ? (values.seconds ?? null) : null,
        distanceM: columns.includes("distance")
          ? (values.distance ?? null)
          : null,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      const data = res.data;
      if (!data) return;

      haptic.light();
      setLogged((prev) => [
        {
          setId: data.setId,
          label: describe(data.weightKg, data.reps, values, unit, columns, rpe),
          isPr: data.isPr,
          day: sentDay,
        },
        ...prev,
      ]);
      requestAnimationFrame(() =>
        loggedRef.current?.scrollIntoView({
          block: "nearest",
          behavior: enabled ? "smooth" : "auto",
        }),
      );
      // The charts, the totals and the history list are all server-rendered.
      router.refresh();
    });
  }

  function undo(setId: string) {
    startSaving(async () => {
      const res = await undoQuickLogSet(setId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLogged((prev) => prev.filter((l) => l.setId !== setId));
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Log a set · ${exerciseName}`}
      footer={
        <div style={{ paddingBottom: keyboardInset }}>
          <Button
            variant="volt"
            block
            size="lg"
            loading={saving}
            disabled={!canSave}
            onClick={save}
          >
            {/* The thumb is already here, so this is the last place backdating
                can be made impossible to do silently. */}
            {backdated
              ? `Log set · ${formatDayLabel(dayKeyToLocalDate(day))}`
              : logged.length > 0
                ? "Log another set"
                : "Log set"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-4 pb-4">
        <DayField day={day} today={today} onChange={setDay} />

        {columns.map((column) => (
          <Field
            key={column}
            column={column}
            unit={unit}
            value={
              column === "weight"
                ? weight
                : column === "reps"
                  ? reps
                  : column === "seconds"
                    ? seconds
                    : distance
            }
            onChange={
              column === "weight"
                ? setWeight
                : column === "reps"
                  ? setReps
                  : column === "seconds"
                    ? setSeconds
                    : setDistance
            }
          />
        ))}

        {/* After the numbers, because effort is the judgement you make once
            you know what you did — and it is optional, so it stays out of the
            path between the steppers and the pinned button. */}
        <div>
          <FieldLabel>
            <Gauge className="size-3.5" />
            Effort (RPE)
          </FieldLabel>
          <div className="mt-1.5">
            <RpePicker value={rpe} onChange={setRpe} idPrefix="quick-log" />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-red-400">
            {error}
          </p>
        )}

        {logged.length > 0 && (
          <div
            ref={loggedRef}
            className="border-hairline divide-hairline divide-y rounded-[12px] border"
          >
            {logged.map((l) => (
              // Springs in with the same grammar as a completed set on the
              // workout screen — this *is* a completed set.
              <motion.div
                key={l.setId}
                layout
                initial={
                  enabled
                    ? { opacity: 0, y: -8, backgroundColor: "rgba(215,255,62,0.14)" }
                    : { opacity: 0 }
                }
                animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
                transition={enabled ? spring.snappy : REDUCED}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="num block text-[15px] font-semibold">
                    {l.label}
                  </span>
                  {/* Three identical "100 kg × 5" rows, two of them for last
                      Tuesday, would be lying at the moment you reach for Undo. */}
                  {l.day !== today && (
                    <span className="text-text-3 block text-[12px]">
                      {formatDayLabel(dayKeyToLocalDate(l.day))}
                    </span>
                  )}
                </span>
                {l.isPr && (
                  // Gold alone is not distinguishable from volt for a
                  // colourblind reader — it always ships with the trophy and
                  // the letters PR.
                  <span className="bg-pr-fade text-pr flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
                    <Trophy className="size-3" strokeWidth={2.6} />
                    PR
                  </span>
                )}
                <button
                  onClick={() => undo(l.setId)}
                  disabled={saving}
                  aria-label="Undo this set"
                  className="tap press text-text-3 grid size-9 place-items-center"
                >
                  <Undo2 className="size-4" strokeWidth={2.2} />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {activeWorkoutId && !backdated && (
          // Never silently redirects the numbers already typed — it just says
          // the running session exists. Hidden while backdating: that session
          // is today's, and pointing at it would be advice for the wrong day.
          <p className="text-text-3 text-[13px] leading-relaxed">
            You have a workout running.{" "}
            <Link
              href={`/workout/${activeWorkoutId}`}
              className="text-volt font-semibold"
            >
              Log it there instead
            </Link>{" "}
            to keep the session together.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Opens the quick-log sheet for a row that has no server-rendered prefill —
 * the exercise library, where fetching the last set of every visible row would
 * be a query per row for a control most of them never get tapped.
 *
 * Mounted only once the user has asked for it, so the fetch is the tap.
 */
export function QuickLogLauncher({
  exerciseId,
  unit,
  onClose,
}: {
  exerciseId: string;
  unit: "kg" | "lb";
  onClose: () => void;
}) {
  const [state, setState] = useState<QuickLogPrefill | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getQuickLogPrefill(exerciseId).then((res) => {
      if (!live) return;
      if (res.ok && res.data) setState(res.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [exerciseId]);

  useEffect(() => {
    if (failed) onClose();
  }, [failed, onClose]);

  if (!state) return null;

  return (
    <QuickLogSheet
      open
      onClose={onClose}
      exerciseId={exerciseId}
      exerciseName={state.name}
      trackingType={state.trackingType}
      unit={unit}
      prefill={state.last}
      activeWorkoutId={state.activeWorkoutId}
    />
  );
}

const FIELD_LABEL =
  "text-text-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase";

/**
 * `htmlFor` only when there is a real form control to point at — the RPE chips
 * are a radiogroup of buttons, which a `<label>` cannot name, so that one
 * carries its own `aria-label` and this renders as plain text.
 */
function FieldLabel({
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

/**
 * Which day the set happened on.
 *
 * Today, yesterday, and a native `<input type="date">` for anything older —
 * native because it is the platform picker (the iOS wheel), it enforces
 * `min`/`max` and its own accessibility for free, and hand-rolled calendar
 * chrome is exactly the auto-generated look the design system rules out.
 *
 * Today is the default, so it is *neutral*: volt appears only once you have
 * deliberately backdated, which is the state that actually matters here.
 */
function DayField({
  day,
  today,
  onChange,
}: {
  day: DayKey;
  today: DayKey;
  onChange: (day: DayKey) => void;
}) {
  const yesterday = shiftDay(today, -1);
  const custom = day !== today && day !== yesterday;

  function pick(next: DayKey) {
    haptic.light();
    onChange(next);
  }

  return (
    <div>
      <FieldLabel htmlFor="quick-log-date">
        <CalendarDays className="size-3.5" />
        Date
      </FieldLabel>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <DayChip selected={day === today} onClick={() => pick(today)}>
          Today
        </DayChip>
        <DayChip
          backdated
          selected={day === yesterday}
          onClick={() => pick(yesterday)}
        >
          Yesterday
        </DayChip>
        <label
          className={cn(
            "tap press rounded-field relative grid h-11 place-items-center border",
            "text-[13px] font-semibold",
            custom
              ? "border-volt bg-volt-fade text-volt"
              : "border-hairline bg-surface-2 text-text-2",
          )}
        >
          <span className={custom ? "num" : undefined}>
            {custom ? formatDayLabel(dayKeyToLocalDate(day)) : "Pick a date"}
          </span>
          {/* Laid over the chip rather than styled in place: the intrinsic
              rendering of a date input is unstyleable enough across engines
              that fighting it costs more than hiding it. 16px so focusing it
              never zooms the page on iOS. */}
          <input
            id="quick-log-date"
            type="date"
            value={day}
            min={shiftDay(today, -MAX_BACKDATE_DAYS)}
            max={today}
            aria-label="Date this set was done"
            onChange={(e) => {
              if (e.target.value) pick(e.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer text-[16px] opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

function DayChip({
  selected,
  backdated = false,
  onClick,
  children,
}: {
  selected: boolean;
  backdated?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "tap press rounded-field h-11 border text-[13px] font-semibold",
        !selected
          ? "border-hairline bg-surface-2 text-text-2"
          : backdated
            ? "border-volt bg-volt-fade text-volt"
            : "border-hairline bg-surface-3 text-text-1",
      )}
    >
      {children}
    </button>
  );
}

const STEP: Record<SetColumn, number> = {
  weight: 2.5,
  reps: 1,
  seconds: 5,
  distance: 10,
};

function Field({
  column,
  unit,
  value,
  onChange,
}: {
  column: SetColumn;
  unit: "kg" | "lb";
  value: string;
  onChange: (v: string) => void;
}) {
  const step = STEP[column];
  const integer = column !== "weight" && column !== "distance";

  function bump(by: number) {
    haptic.light();
    const next = Math.max(0, (num(value) ?? 0) + by);
    onChange(integer ? String(Math.round(next)) : trim(next));
  }

  return (
    <div>
      <FieldLabel htmlFor={`quick-log-${column}`}>
        {LABEL[column](unit)}
      </FieldLabel>
      <div className="mt-1.5 flex items-stretch gap-2">
        <Stepper label={`Decrease ${column}`} onClick={() => bump(-step)}>
          <Minus className="size-5" strokeWidth={2.6} />
        </Stepper>
        <input
          id={`quick-log-${column}`}
          value={value}
          // 16px minimum, or iOS zooms the whole page on focus.
          inputMode={integer ? "numeric" : "decimal"}
          enterKeyHint="done"
          placeholder="0"
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
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

function Stepper({
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

const LABEL: Record<SetColumn, (unit: "kg" | "lb") => string> = {
  weight: (unit) => `Weight (${unit})`,
  reps: () => "Reps",
  seconds: () => "Seconds",
  distance: () => "Metres",
};

function num(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Drop a trailing `.0` so a stepped weight reads "62.5", not "62.50000". */
function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function displayWeight(kg: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

function storedWeight(shown: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? shown : lbToKg(shown);
}

function describe(
  weightKg: number | null,
  reps: number | null,
  values: { seconds: number | null; distance: number | null },
  unit: "kg" | "lb",
  columns: SetColumn[],
  rpe: number | null,
): string {
  const parts: string[] = [];
  if (columns.includes("weight") && weightKg != null) {
    parts.push(`${formatWeight(weightKg, unit)} ${unit}`);
  }
  if (columns.includes("reps") && reps != null) parts.push(`× ${reps}`);
  if (columns.includes("seconds") && values.seconds != null) {
    parts.push(`${values.seconds}s`);
  }
  if (columns.includes("distance") && values.distance != null) {
    parts.push(`${values.distance}m`);
  }
  const label = parts.join(" ") || "Logged";
  // Same shorthand the set row uses under the set number.
  return rpe != null ? `${label} @${rpe}` : label;
}
