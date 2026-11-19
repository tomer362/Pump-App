"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Replace,
  Trash2,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button, IconButton } from "@/components/ui/button";
import { FieldLabel } from "@/components/exercise/set-value-field";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { showToast } from "@/components/ui/toast";
import {
  editWorkoutDetails,
  moveLoggedExercise,
  removeLoggedExercise,
  replaceLoggedExercise,
} from "@/lib/actions/history-edit";
import type { ExerciseListItem } from "@/lib/queries/exercise";
import { cn, haptic } from "@/lib/utils";
import { SetEditSheet } from "./set-edit-sheet";

// Behind a dynamic import, as on the workout screen: the library is the
// heaviest thing on this page and almost nobody opens it here.
const ExercisePicker = dynamic(() =>
  import("@/components/workout/exercise-picker").then((m) => m.ExercisePicker),
);

const INPUT = cn(
  "border-hairline bg-surface-2 text-text-1 rounded-[12px] border px-3",
  // 16px minimum, or iOS zooms the whole page on focus.
  "h-12 w-full text-[16px] outline-none focus:border-volt/60 transition-colors",
);

/** `YYYY-MM-DDTHH:mm` in the device's zone — what `datetime-local` speaks. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/**
 * Name, date, start time, duration and note of a finished workout. A change of
 * date or time moves the session in history and re-ranks every record in it —
 * see `editWorkoutDetails`.
 */
export function EditWorkoutDetails({
  workoutId,
  name,
  note,
  startedAt,
  durationSeconds,
}: {
  workoutId: string;
  name: string;
  note: string | null;
  /** ISO instant. */
  startedAt: string;
  durationSeconds: number;
}) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  return (
    <>
      <Button
        variant="solid"
        onClick={() => {
          haptic.light();
          setOpening((n) => n + 1);
          setOpen(true);
        }}
        aria-label="Edit workout details"
      >
        <Pencil className="size-4" />
      </Button>
      {opening > 0 && (
        <DetailsSheet
          key={opening}
          open={open}
          onClose={() => setOpen(false)}
          workoutId={workoutId}
          initial={{ name, note, startedAt, durationSeconds }}
        />
      )}
    </>
  );
}

function DetailsSheet({
  open,
  onClose,
  workoutId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  initial: {
    name: string;
    note: string | null;
    startedAt: string;
    durationSeconds: number;
  };
}) {
  const router = useRouter();
  const keyboardInset = useKeyboardInset();
  // Mounted only on a tap, so the device's zone is the one formatting this.
  const [start, setStart] = useState(() =>
    toLocalInput(new Date(initial.startedAt)),
  );
  const [name, setName] = useState(initial.name);
  const [note, setNote] = useState(initial.note ?? "");
  const [minutes, setMinutes] = useState(
    String(Math.max(1, Math.round(initial.durationSeconds / 60))),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const minutesNum = Number(minutes);
  const startDate = new Date(start);
  const valid =
    name.trim().length > 0 &&
    Number.isInteger(minutesNum) &&
    minutesNum >= 1 &&
    minutesNum <= 24 * 60 &&
    !Number.isNaN(startDate.getTime());

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await editWorkoutDetails(workoutId, {
        name: name.trim(),
        note: note.trim() || null,
        startedAt: startDate.toISOString(),
        durationMinutes: minutesNum,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      haptic.light();
      startTransition(() => {
        router.refresh();
        onClose();
      });
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit workout"
      footer={
        <div style={{ paddingBottom: keyboardInset }}>
          <Button
            block
            size="lg"
            variant="solid"
            loading={pending}
            disabled={!valid}
            onClick={save}
          >
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-4 pb-4">
        <div>
          <FieldLabel htmlFor="workout-edit-name">Name</FieldLabel>
          <input
            id="workout-edit-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={cn(INPUT, "mt-1.5")}
          />
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="min-w-0">
            <FieldLabel htmlFor="workout-edit-start">Started</FieldLabel>
            <input
              id="workout-edit-start"
              type="datetime-local"
              value={start}
              max={toLocalInput(new Date())}
              onChange={(e) => setStart(e.target.value)}
              className={cn(INPUT, "num mt-1.5 min-w-0")}
            />
          </div>
          <div>
            <FieldLabel htmlFor="workout-edit-minutes">Minutes</FieldLabel>
            <input
              id="workout-edit-minutes"
              value={minutes}
              inputMode="numeric"
              onFocus={(e) => {
                const el = e.currentTarget;
                requestAnimationFrame(() => el.select());
              }}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
              className={cn(INPUT, "num mt-1.5 text-center font-bold")}
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="workout-edit-note">Note</FieldLabel>
          <textarea
            id="workout-edit-note"
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            className={cn(INPUT, "mt-1.5 h-auto resize-none py-2.5")}
          />
        </div>

        <p className="text-text-3 text-[13px] leading-relaxed">
          Moving the date moves the session in your history and every
          exercise&apos;s chart, and your records are recalculated.
        </p>

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
 * The `…` beside an exercise's name on your own finished workout: move it,
 * swap it for the exercise you actually did, or remove it.
 */
export function ExerciseOptions({
  workoutExerciseId,
  exerciseId,
  name,
  trackingType,
  isFirst,
  isLast,
  canRemove,
}: {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  trackingType: string;
  isFirst: boolean;
  isLast: boolean;
  /** False on the workout's only exercise — that is a delete of the workout. */
  canRemove: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    setConfirmRemove(false);
    setError(null);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Couldn't save");
        setConfirmRemove(false);
        return;
      }
      haptic.light();
      start(() => {
        router.refresh();
        close();
      });
    });
  }

  return (
    <>
      <IconButton
        label={`Options for ${name}`}
        size="sm"
        className="hit-slop -mr-1.5"
        onClick={() => {
          haptic.light();
          setOpen(true);
        }}
      >
        <MoreHorizontal className="size-[18px]" />
      </IconButton>

      <Sheet
        open={open}
        onClose={close}
        title={name}
        titleAction={
          canRemove && !confirmRemove ? (
            <IconButton
              label="Remove this exercise"
              variant="danger"
              size="sm"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="size-[18px]" />
            </IconButton>
          ) : undefined
        }
        dismissLabel={confirmRemove ? undefined : "Done"}
        footer={
          confirmRemove ? (
            <div className="space-y-2">
              <Button
                block
                size="lg"
                variant="danger"
                loading={pending}
                onClick={() => run(() => removeLoggedExercise(workoutExerciseId))}
              >
                <Trash2 className="size-4" />
                Remove exercise
              </Button>
              <Button block variant="ghost" onClick={() => setConfirmRemove(false)}>
                Keep it
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-2 px-4 pb-4">
          {confirmRemove ? (
            <p className="text-text-2 text-[14px] leading-relaxed">
              {name} and every set under it are removed from this workout. Its
              totals and your records for {name} are recalculated from what
              remains.
            </p>
          ) : (
            <>
              <div
                role="group"
                aria-label="Order"
                className="grid grid-cols-2 gap-2"
              >
                <Button
                  variant="solid"
                  disabled={isFirst || pending}
                  onClick={() => run(() => moveLoggedExercise(workoutExerciseId, -1))}
                >
                  <ArrowUp className="size-4" />
                  Move up
                </Button>
                <Button
                  variant="solid"
                  disabled={isLast || pending}
                  onClick={() => run(() => moveLoggedExercise(workoutExerciseId, 1))}
                >
                  <ArrowDown className="size-4" />
                  Move down
                </Button>
              </div>
              <Button
                block
                variant="solid"
                disabled={pending}
                onClick={() => setReplacing(true)}
              >
                <Replace className="size-4" />
                Replace exercise
              </Button>
              <p className="text-text-3 pt-1 text-[13px] leading-relaxed">
                Replacing keeps every set as logged and moves it to the new
                exercise — its history and records, and {name}&apos;s, are
                recalculated.
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

      {/* A sibling, not a child: every Sheet portals to the body, so the one
          mounted second paints over the first. */}
      <ExercisePicker
        open={replacing}
        onClose={() => setReplacing(false)}
        mode="replace"
        replacing={{ id: exerciseId, name }}
        onConfirm={(ids, items) => {
          setReplacing(false);
          const id = ids[0];
          if (!id) return;
          const picked = items.find((e) => e.id === id);
          // The server refuses this too; saying so here saves the round trip.
          if (picked && picked.trackingType !== trackingType) {
            setError(
              `${picked.name} is measured differently — pick one that records the same values.`,
            );
            return;
          }
          run(() => replaceLoggedExercise(workoutExerciseId, id));
        }}
      />
    </>
  );
}

/**
 * The foot of a finished workout: an exercise you did and never logged. The
 * picker can return several; each opens its own first-set sheet in turn,
 * because an exercise is never stored empty.
 */
export function AddExerciseRow({
  workoutId,
  unit,
  alreadyIn,
}: {
  workoutId: string;
  unit: "kg" | "lb";
  alreadyIn: Record<string, number>;
}) {
  const [picking, setPicking] = useState(false);
  const [queue, setQueue] = useState<ExerciseListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  const head = queue[0];

  function next() {
    setOpen(false);
    const rest = queue.slice(1);
    // Let the sheet animate out before the next one keys in.
    setTimeout(() => {
      setQueue(rest);
      if (rest.length) {
        setOpening((n) => n + 1);
        setOpen(true);
      }
    }, 220);
  }

  return (
    <>
      <Button
        block
        variant="outline"
        onClick={() => {
          haptic.light();
          setPicking(true);
        }}
      >
        <Plus className="size-4" />
        Add an exercise
      </Button>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        alreadyIn={alreadyIn}
        onConfirm={(ids, items) => {
          setPicking(false);
          // An exercise created inline has no row here, and the set sheet
          // needs its tracking type — so it has to be picked again.
          const picked = ids
            .map((id) => items.find((e) => e.id === id))
            .filter((e): e is ExerciseListItem => e != null);
          if (picked.length < ids.length) {
            showToast("Created — pick it from the list to add it", "info");
          }
          if (!picked.length) return;
          setQueue(picked);
          setOpening((n) => n + 1);
          setOpen(true);
        }}
      />

      {head && opening > 0 && (
        <SetEditSheet
          key={`${opening}-${head.id}`}
          open={open}
          trackingType={head.trackingType}
          unit={unit}
          title={`${head.name} · First set`}
          mode={{ kind: "new-exercise", workoutId, exerciseId: head.id }}
          initial={{
            weightKg: null,
            reps: null,
            seconds: null,
            distanceM: null,
            rpe: null,
            targetRpe: null,
            setType: "normal",
            done: true,
          }}
          onClose={next}
        />
      )}
    </>
  );
}
