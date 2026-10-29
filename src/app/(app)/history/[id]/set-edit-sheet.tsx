"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button, IconButton } from "@/components/ui/button";
import { RpePicker } from "@/components/workout/rpe-picker";
import { setColumns } from "@/components/workout/set-row";
import {
  Field,
  FieldLabel,
  displayWeight,
  num,
  storedWeight,
  trim,
} from "@/components/exercise/set-value-field";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  addLoggedSet,
  deleteLoggedSet,
  editLoggedSet,
} from "@/lib/actions/history-edit";
import { prescribedToken } from "@/lib/rpe";
import { cn, haptic } from "@/lib/utils";

type SetType = "normal" | "warmup" | "drop" | "failure";

/** A logged set as the editor needs it. Weights in kilograms, as stored. */
export type LoggedSet = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  targetRpe: number | null;
  setType: string;
  done: boolean;
};

type Common = {
  trackingType: string;
  unit: "kg" | "lb";
  /** Sheet heading — the exercise and which set, e.g. "Bench Press · Set 3". */
  title: string;
};

/**
 * A set on your own finished workout, as one tap target that opens its editor.
 *
 * The whole row is the target rather than a pencil beside it: history is a
 * browsing surface, not the workout screen's data table, so a 44 px row is
 * affordable — and a row that answers a tap is what a lifter tries first when
 * a number is wrong. The values are rendered on the server and passed in, so
 * this row can't drift from someone else's read-only one.
 */
export function SetEditRow({
  setId,
  set,
  canDelete,
  label,
  children,
  ...common
}: Common & {
  setId: string;
  set: LoggedSet;
  /** False on the workout's only set — that is a delete of the workout. */
  canDelete: boolean;
  /** Accessible name for the row, e.g. "Set 3, 100 kg × 5". */
  label: string;
  children: React.ReactNode;
}) {
  const { open, opening, show, hide } = useSheetOpening();
  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={`${label}. Edit set.`}
        className="press flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-[13px]"
      >
        {children}
      </button>
      {opening > 0 && (
        <SetEditSheet
          key={opening}
          open={open}
          {...common}
          mode={{ kind: "edit", setId, canDelete }}
          initial={set}
          onClose={hide}
        />
      )}
    </>
  );
}

/**
 * The foot of an exercise's set list: a set you did and forgot to tick. Starts
 * from the last set above it, because the forgotten set is nearly always
 * another one of those.
 */
export function AddSetRow({
  workoutExerciseId,
  template,
  ...common
}: Common & { workoutExerciseId: string; template: LoggedSet | null }) {
  const { open, opening, show, hide } = useSheetOpening();
  return (
    <>
      <button
        type="button"
        onClick={show}
        className="press text-text-2 flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-[13px] font-semibold"
      >
        <Plus className="text-text-3 size-4 w-5 shrink-0" strokeWidth={2.4} />
        Add a set
      </button>
      {opening > 0 && (
        <SetEditSheet
          key={opening}
          open={open}
          {...common}
          mode={{ kind: "add", workoutExerciseId }}
          initial={{
            weightKg: template?.weightKg ?? null,
            reps: template?.reps ?? null,
            seconds: template?.seconds ?? null,
            distanceM: template?.distanceM ?? null,
            rpe: null,
            targetRpe: null,
            // A warm-up carried forward would add a set that doesn't count.
            setType: template?.setType === "warmup" ? "normal" : (template?.setType ?? "normal"),
            done: true,
          }}
          onClose={hide}
        />
      )}
    </>
  );
}

/**
 * Open state plus a counter that keys the sheet. Each opening remounts the
 * editor, so it starts from what the server says the set is now rather than
 * from a draft somebody abandoned — while the sheet stays mounted after closing,
 * which is what lets it animate out. Nothing mounts until the first tap: a
 * workout has dozens of rows and almost none get opened.
 */
function useSheetOpening() {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  return {
    open,
    opening,
    show: () => {
      haptic.light();
      setOpening((n) => n + 1);
      setOpen(true);
    },
    hide: () => setOpen(false),
  };
}

const TYPES: { value: SetType; label: string }[] = [
  { value: "normal", label: "Working" },
  { value: "warmup", label: "Warm-up" },
  { value: "drop", label: "Drop" },
  { value: "failure", label: "Failure" },
];

/**
 * Correct a logged set after the session — every value it holds, in one sheet
 * with one Save.
 *
 * A draft and an explicit Save, unlike the workout screen's commit-on-blur
 * cells, because every save here re-derives the workout's totals and the
 * exercise's records: a write per keystroke would be a record rebuild per
 * digit, and a half-typed "1" on the way to "120" would briefly un-PR you.
 * Save sits in the footer, in the thumb zone, and is neutral rather than volt —
 * a correction is not a completed set.
 *
 * Delete is the title row's trash icon, like every options sheet in the app,
 * and confirms in place: it is the one control here with no undo.
 */
function SetEditSheet({
  open,
  mode,
  initial,
  trackingType,
  unit,
  title,
  onClose,
}: Common & {
  open: boolean;
  mode:
    | { kind: "edit"; setId: string; canDelete: boolean }
    | { kind: "add"; workoutExerciseId: string };
  initial: LoggedSet;
  onClose: () => void;
}) {
  const router = useRouter();
  const keyboardInset = useKeyboardInset();
  const columns = setColumns(trackingType);

  const [weight, setWeight] = useState(
    initial.weightKg != null ? trim(displayWeight(initial.weightKg, unit)) : "",
  );
  const [reps, setReps] = useState(initial.reps != null ? String(initial.reps) : "");
  const [seconds, setSeconds] = useState(
    initial.seconds != null ? String(initial.seconds) : "",
  );
  const [distance, setDistance] = useState(
    initial.distanceM != null ? String(initial.distanceM) : "",
  );
  const [rpe, setRpe] = useState(initial.rpe);
  const [setType, setSetType] = useState<SetType>(
    (TYPES.some((t) => t.value === initial.setType)
      ? initial.setType
      : "normal") as SetType,
  );
  const [done, setDone] = useState(initial.done);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hasWeight = columns.includes("weight") || columns.includes("assist");
  // Only the columns this exercise records are sent; the rest stay as stored,
  // which for a set logged through this app is null.
  const values = {
    weightKg: hasWeight
      ? (() => {
          const w = num(weight);
          return w != null ? storedWeight(w, unit) : null;
        })()
      : initial.weightKg,
    reps: columns.includes("reps") ? num(reps) : initial.reps,
    seconds: columns.includes("seconds") ? num(seconds) : initial.seconds,
    distanceM: columns.includes("distance") ? num(distance) : initial.distanceM,
  };
  const records =
    (values.reps ?? 0) > 0 ||
    (values.seconds ?? 0) > 0 ||
    (values.distanceM ?? 0) > 0;

  // Compared in the display unit, so a lb reader's untouched 225 never reads
  // as changed by a round trip through kilograms.
  const dirty =
    mode.kind === "add" ||
    (hasWeight &&
      weight !==
        (initial.weightKg != null
          ? trim(displayWeight(initial.weightKg, unit))
          : "")) ||
    values.reps !== initial.reps ||
    values.seconds !== initial.seconds ||
    values.distanceM !== initial.distanceM ||
    rpe !== initial.rpe ||
    setType !== initial.setType ||
    done !== initial.done;

  function finish() {
    haptic.light();
    // The totals, the PR badge and every row are server-rendered. Refresh and
    // close in one transition — a state update after an `await` is not part of
    // the outer one — so the sheet stays up, its button busy, until the new
    // numbers land, and never closes onto the old ones.
    start(() => {
      router.refresh();
      onClose();
    });
  }

  function save() {
    setError(null);
    start(async () => {
      // An untouched weight is sent as stored rather than re-converted, or a
      // lb reader's save would nudge it by the conversion's rounding.
      const weightKg =
        hasWeight &&
        weight ===
          (initial.weightKg != null
            ? trim(displayWeight(initial.weightKg, unit))
            : "")
          ? initial.weightKg
          : values.weightKg;
      const payload = { ...values, weightKg, rpe, setType };
      const res =
        mode.kind === "edit"
          ? await editLoggedSet(mode.setId, { ...payload, done })
          : await addLoggedSet(mode.workoutExerciseId, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      finish();
    });
  }

  function remove() {
    if (mode.kind !== "edit") return;
    setError(null);
    start(async () => {
      const res = await deleteLoggedSet(mode.setId);
      if (!res.ok) {
        setError(res.error);
        setConfirmDelete(false);
        return;
      }
      finish();
    });
  }

  const footer = confirmDelete ? (
    <div className="space-y-2" style={{ paddingBottom: keyboardInset }}>
      <Button block size="lg" variant="danger" loading={pending} onClick={remove}>
        <Trash2 className="size-4" />
        Delete set
      </Button>
      <Button block variant="ghost" onClick={() => setConfirmDelete(false)}>
        Keep it
      </Button>
    </div>
  ) : (
    <div style={{ paddingBottom: keyboardInset }}>
      <Button
        block
        size="lg"
        variant="solid"
        loading={pending}
        disabled={!dirty || (done && !records)}
        onClick={save}
      >
        {mode.kind === "add" ? "Add set" : "Save changes"}
      </Button>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      titleAction={
        mode.kind === "edit" && mode.canDelete && !confirmDelete ? (
          <IconButton
            label="Delete this set"
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-[18px]" />
          </IconButton>
        ) : undefined
      }
      footer={footer}
    >
      <div className="space-y-5 px-4 pb-4">
        {confirmDelete ? (
          <p className="text-text-2 text-[14px] leading-relaxed">
            The set is removed from this workout. Its totals and your records
            for this exercise are recalculated from what remains.
          </p>
        ) : (
          <>
            {mode.kind === "edit" && (
              <Segmented
                label="Performed"
                options={[
                  { value: "done", label: "Done" },
                  { value: "skipped", label: "Skipped" },
                ]}
                value={done ? "done" : "skipped"}
                onChange={(v) => setDone(v === "done")}
              />
            )}

            <Segmented
              label="Set type"
              options={TYPES}
              value={setType}
              onChange={setSetType}
            />

            {columns.map((column) => (
              <Field
                key={column}
                idPrefix="history-set"
                column={column}
                unit={unit}
                value={
                  column === "weight" || column === "assist"
                    ? weight
                    : column === "reps"
                      ? reps
                      : column === "seconds"
                        ? seconds
                        : distance
                }
                onChange={
                  column === "weight" || column === "assist"
                    ? setWeight
                    : column === "reps"
                      ? setReps
                      : column === "seconds"
                        ? setSeconds
                        : setDistance
                }
              />
            ))}

            {/* Hidden for a skipped set: rating a set you didn't do is a
                contradiction, and the server drops it anyway. */}
            {done && (
              <div>
                <FieldLabel>
                  <Gauge className="size-3.5" />
                  Effort (RPE)
                </FieldLabel>
                <div className="mt-1.5">
                  <RpePicker
                    value={rpe}
                    onChange={setRpe}
                    idPrefix="history-set"
                    hint={
                      initial.targetRpe != null ? (
                        <>
                          The routine prescribed{" "}
                          <span className="num text-text-2">
                            {prescribedToken(initial.targetRpe)}
                          </span>
                          . Pick what it actually felt like.
                        </>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            )}

            <p className="text-text-3 text-[13px] leading-relaxed">
              {done
                ? "Saving recalculates this workout's totals and your records for this exercise."
                : "A skipped set stays on the workout but counts for nothing."}
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="text-danger text-[13px]">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/**
 * A small radiogroup of equal chips. Selected is neutral, not volt: these are
 * classifications of a set, not state the lifter just produced.
 */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        role="radiogroup"
        aria-label={label}
        className="mt-1.5 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => {
              haptic.light();
              onChange(o.value);
            }}
            className={cn(
              "tap press rounded-field h-11 border text-[13px] font-semibold",
              o.value === value
                ? "border-hairline-strong bg-surface-3 text-text-1"
                : "border-hairline bg-surface-2 text-text-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
