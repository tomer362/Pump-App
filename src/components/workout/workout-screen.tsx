"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  Clock,
  Ellipsis,
  Plus,
  Timer,
  Trash2,
  Calculator,
  StickyNote,
  Link2,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Badge, Textarea } from "@/components/ui/primitives";
import { SetRow, type SetDraft } from "./set-row";
import { RestTimerBar, useRestTimer } from "./rest-timer";
import { ExercisePicker } from "./exercise-picker";
import { PlateCalculator } from "./plate-calculator";
import { IntervalRunner } from "./interval-runner";
import { FinishSheet } from "./finish-sheet";
import { useElapsed } from "@/hooks/use-elapsed";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  addSet,
  addExercisesToWorkout,
  discardWorkout,
  removeSet,
  removeWorkoutExercise,
  updateSet,
  updateWorkoutExerciseSettings,
  updateWorkoutMeta,
} from "@/lib/actions/workout";
import { setCoopResting } from "@/lib/actions/coop";
import type { FullWorkout } from "@/lib/queries/workout";
import { cn, estimate1RM, formatDuration, formatWeight, haptic } from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";

type ExerciseDraft = FullWorkout["exercises"][number] & { sets: never };

type Block = {
  id: string;
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  notes: string | null;
  restSeconds: number | null;
  supersetGroup: string | null;
  intervalWorkSeconds: number | null;
  intervalRestSeconds: number | null;
  previous: { weightKg: number | null; reps: number | null; seconds: number | null }[];
  sets: SetDraft[];
};

export function WorkoutScreen({
  workout,
  unit,
  defaultRestSeconds,
  current1rm,
}: {
  workout: FullWorkout;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
  /** Existing 1RM per exercise, so a PR can be flagged the instant it happens. */
  current1rm: Record<string, number>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const elapsed = useElapsed(workout.startedAt);
  const keyboardInset = useKeyboardInset();
  const timer = useRestTimer();

  const [blocks, setBlocks] = useState<Block[]>(() =>
    workout.exercises.map(toBlock),
  );
  const [name, setName] = useState(workout.name);
  const [note, setNote] = useState(workout.note ?? "");

  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [typeMenuFor, setTypeMenuFor] = useState<{ blockId: string; setId: string } | null>(null);
  const [plateFor, setPlateFor] = useState<number | null>(null);
  const [intervalFor, setIntervalFor] = useState<Block | null>(null);
  const [prFlash, setPrFlash] = useState<string | null>(null);

  const bestByExercise = useRef(current1rm);

  const totals = useMemo(() => {
    let volume = 0;
    let sets = 0;
    for (const b of blocks) {
      for (const s of b.sets) {
        if (!s.completed || s.setType === "warmup") continue;
        sets++;
        volume += (s.weightKg ?? 0) * (s.reps ?? 0);
      }
    }
    return { volume, sets };
  }, [blocks]);

  /* ---------------------------------------------------------------------- */
  /* Mutations — optimistic locally, persisted in the background.            */
  /* ---------------------------------------------------------------------- */

  const patchSet = useCallback(
    (blockId: string, setId: string, patch: Partial<SetDraft>) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id !== blockId
            ? b
            : {
                ...b,
                sets: b.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
              },
        ),
      );
      startTransition(async () => {
        await updateSet(setId, {
          weightKg: patch.weightKg,
          reps: patch.reps,
          seconds: patch.seconds,
          distanceM: patch.distanceM,
          rpe: patch.rpe,
          setType: patch.setType,
        });
      });
    },
    [],
  );

  const toggleComplete = useCallback(
    (block: Block, set: SetDraft) => {
      const next = !set.completed;

      setBlocks((prev) =>
        prev.map((b) =>
          b.id !== block.id
            ? b
            : {
                ...b,
                sets: b.sets.map((s) =>
                  s.id === set.id ? { ...s, completed: next } : s,
                ),
              },
        ),
      );

      // Completing a working set starts the rest clock — Strong's key behaviour.
      if (next && set.setType !== "warmup") {
        const restSeconds = block.restSeconds ?? defaultRestSeconds;
        timer.start(restSeconds);

        // In a co-op session, publish the rest so the others see you're between
        // sets rather than idle.
        if (workout.coopSessionId) {
          void setCoopResting(workout.coopSessionId, restSeconds);
        }

        const est =
          set.weightKg != null && set.reps != null
            ? estimate1RM(set.weightKg, set.reps)
            : 0;
        const best = bestByExercise.current[block.exerciseId] ?? 0;
        if (est > best + 0.01) {
          bestByExercise.current[block.exerciseId] = est;
          setPrFlash(set.id);
          haptic.success();
          window.setTimeout(() => setPrFlash((v) => (v === set.id ? null : v)), 2600);
        }
      }
      if (!next) {
        timer.stop();
        if (workout.coopSessionId) void setCoopResting(workout.coopSessionId, null);
      }

      startTransition(async () => {
        await updateSet(set.id, { completed: next });
      });
    },
    [defaultRestSeconds, timer, workout.coopSessionId],
  );

  const appendSet = useCallback(async (block: Block) => {
    haptic.light();
    const res = await addSet(block.id);
    if (!res.ok || !res.data) return;
    const last = block.sets[block.sets.length - 1];
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== block.id
          ? b
          : {
              ...b,
              sets: [
                ...b.sets,
                {
                  id: res.data!.setId,
                  position: b.sets.length,
                  setType: "normal",
                  weightKg: last?.weightKg ?? null,
                  reps: last?.reps ?? null,
                  seconds: last?.seconds ?? null,
                  distanceM: null,
                  rpe: null,
                  completed: false,
                },
              ],
            },
      ),
    );
  }, []);

  const dropSet = useCallback((blockId: string, setId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : { ...b, sets: b.sets.filter((s) => s.id !== setId) },
      ),
    );
    startTransition(async () => {
      await removeSet(setId);
    });
  }, []);

  const dropExercise = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setMenuFor(null);
    startTransition(async () => {
      await removeWorkoutExercise(blockId);
    });
  }, []);

  const addExercises = useCallback(
    async (ids: string[]) => {
      setPicking(false);
      if (!ids.length) return;
      const res = await addExercisesToWorkout(workout.id, ids);
      if (res.ok) router.refresh();
    },
    [workout.id, router],
  );

  const saveMeta = useCallback(
    (patch: { name?: string; note?: string | null }) => {
      startTransition(async () => {
        await updateWorkoutMeta(workout.id, patch);
      });
    },
    [workout.id],
  );

  const setRest = useCallback(
    (blockId: string, seconds: number | null) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, restSeconds: seconds } : b)),
      );
      startTransition(async () => {
        await updateWorkoutExerciseSettings(blockId, { restSeconds: seconds });
      });
    },
    [],
  );

  const setBlockNotes = useCallback((blockId: string, notes: string | null) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, notes } : b)),
    );
    startTransition(async () => {
      await updateWorkoutExerciseSettings(blockId, { notes });
    });
  }, []);

  const menuBlock = blocks.find((b) => b.id === menuFor) ?? null;
  const anyCompleted = totals.sets > 0;

  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="min-h-screen-d"
      // Lift content above the on-screen keyboard so the row being edited and
      // its checkmark stay visible while typing.
      style={{ paddingBottom: keyboardInset }}
    >
      {/* Sticky header: identity, elapsed, and the exit. */}
      {/* Solid, not translucent. This is the screen you read at arm's length
          between sets — a blurred bar buys nothing and any device that fails
          to composite the blur would let exercise names ghost through it. */}
      <header className="bg-bg hairline-b sticky top-0 z-30 pt-safe inset-safe-x">
        <div className="flex h-12 items-center gap-1 px-2">
          <IconButton
            label="Back"
            onClick={() => router.push("/feed")}
            className="text-text-2"
          >
            <ChevronLeft className="size-6" strokeWidth={2.4} />
          </IconButton>

          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[15px] font-semibold">{name}</div>
            <div className="num text-volt text-[12px] leading-tight font-bold">
              {formatDuration(elapsed)}
            </div>
          </div>

          <Button
            variant="volt"
            size="sm"
            onClick={() => {
              haptic.medium();
              setFinishing(true);
            }}
            disabled={!anyCompleted}
          >
            Finish
          </Button>
        </div>

        <div className="text-text-3 flex items-center justify-center gap-4 px-4 pb-2 text-[12px]">
          <span className="num">
            <span className="text-text-1 font-semibold">{totals.sets}</span> sets
          </span>
          <span className="bg-hairline h-3 w-px" />
          <span className="num">
            <span className="text-text-1 font-semibold">
              {formatWeight(totals.volume, unit)}
            </span>{" "}
            {unit} volume
          </span>
          {workout.loadMultiplier !== 1 && (
            <>
              <span className="bg-hairline h-3 w-px" />
              <Badge tone="volt">
                {workout.loadMultiplier > 1 ? "+" : ""}
                {Math.round((workout.loadMultiplier - 1) * 100)}%
              </Badge>
            </>
          )}
        </div>
      </header>

      <main className="pb-40">
        {blocks.map((block) => (
          <ExerciseBlock
            key={block.id}
            block={block}
            unit={unit}
            prFlash={prFlash}
            onOpenMenu={() => setMenuFor(block.id)}
            onOpenPlate={(kg) => setPlateFor(kg)}
            onRunInterval={() => setIntervalFor(block)}
            onPatchSet={(setId, patch) => patchSet(block.id, setId, patch)}
            onToggle={(set) => toggleComplete(block, set)}
            onDeleteSet={(setId) => dropSet(block.id, setId)}
            onAddSet={() => appendSet(block)}
            onOpenTypeMenu={(setId) =>
              setTypeMenuFor({ blockId: block.id, setId })
            }
          />
        ))}

        <div className="space-y-2 px-4 py-5">
          <Button block variant="solid" onClick={() => setPicking(true)}>
            <Plus className="size-4" strokeWidth={2.6} />
            Add exercise
          </Button>
          <Button
            block
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard workout
          </Button>
        </div>
      </main>

      <RestTimerBar
        state={timer.state}
        remaining={timer.remaining}
        onStop={timer.stop}
        onAdjust={timer.adjust}
      />

      {/* --- Sheets --- */}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={addExercises}
      />

      <Sheet
        open={menuBlock != null}
        onClose={() => setMenuFor(null)}
        title={menuBlock?.name}
      >
        {menuBlock && (
          <ExerciseOptions
            block={menuBlock}
            defaultRestSeconds={defaultRestSeconds}
            onSetRest={(s) => setRest(menuBlock.id, s)}
            onSetNotes={(n) => setBlockNotes(menuBlock.id, n)}
            onRemove={() => dropExercise(menuBlock.id)}
          />
        )}
      </Sheet>

      <Sheet
        open={typeMenuFor != null}
        onClose={() => setTypeMenuFor(null)}
        title="Set type"
      >
        <div className="px-4 pb-4">
          {(
            [
              ["normal", "Normal", "Counts toward volume and records"],
              ["warmup", "Warm-up", "Excluded from volume and records"],
              ["drop", "Drop set", "Performed straight after the previous set"],
              ["failure", "To failure", "Taken to muscular failure"],
            ] as [SetType, string, string][]
          ).map(([value, label, desc]) => (
            <button
              key={value}
              onClick={() => {
                if (!typeMenuFor) return;
                patchSet(typeMenuFor.blockId, typeMenuFor.setId, {
                  setType: value,
                });
                setTypeMenuFor(null);
              }}
              className="press hairline-b flex w-full flex-col items-start py-3 text-left last:border-b-0"
            >
              <span className="text-[15px] font-medium">{label}</span>
              <span className="text-text-3 text-[13px]">{desc}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={plateFor != null}
        onClose={() => setPlateFor(null)}
        title="Plate calculator"
      >
        {plateFor != null && <PlateCalculator targetKg={plateFor} unit={unit} />}
      </Sheet>

      {intervalFor && (
        <IntervalRunner
          block={intervalFor}
          onClose={() => setIntervalFor(null)}
        />
      )}

      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this workout?"
      >
        <div className="px-4 pb-5">
          <p className="text-text-2 text-[14px] leading-relaxed">
            Every set you logged in this session will be deleted. This can&apos;t be
            undone.
          </p>
          <div className="mt-5 space-y-2">
            <Button
              block
              variant="danger"
              onClick={async () => {
                await discardWorkout(workout.id);
                router.replace("/feed");
              }}
            >
              <Trash2 className="size-4" />
              Discard workout
            </Button>
            <Button block variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep going
            </Button>
          </div>
        </div>
      </Sheet>

      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        workoutId={workout.id}
        defaultName={name}
        defaultNote={note}
        unit={unit}
        onNameChange={(v) => {
          setName(v);
          saveMeta({ name: v });
        }}
        onNoteChange={(v) => {
          setNote(v);
          saveMeta({ note: v || null });
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseBlock({
  block,
  unit,
  prFlash,
  onOpenMenu,
  onOpenPlate,
  onRunInterval,
  onPatchSet,
  onToggle,
  onDeleteSet,
  onAddSet,
  onOpenTypeMenu,
}: {
  block: Block;
  unit: "kg" | "lb";
  prFlash: string | null;
  onOpenMenu: () => void;
  onOpenPlate: (kg: number) => void;
  onRunInterval: () => void;
  onPatchSet: (setId: string, patch: Partial<SetDraft>) => void;
  onToggle: (set: SetDraft) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onOpenTypeMenu: (setId: string) => void;
}) {
  const showWeight =
    block.trackingType === "weight_reps" || block.trackingType === "weight_time";
  const showReps =
    block.trackingType === "weight_reps" || block.trackingType === "reps";
  const showTime =
    block.trackingType === "time" ||
    block.trackingType === "distance_time" ||
    block.trackingType === "weight_time";

  const isInterval =
    block.intervalWorkSeconds != null && block.intervalWorkSeconds > 0;

  // Warm-ups don't consume a set number, matching how lifters count.
  let workingIndex = 0;

  const heaviest = Math.max(
    0,
    ...block.sets.map((s) => (s.setType !== "warmup" ? (s.weightKg ?? 0) : 0)),
  );

  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {block.supersetGroup && (
          <span className="text-volt border-volt/50 grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold">
            {block.supersetGroup}
          </span>
        )}
        <Link
          href={`/exercises/${block.exerciseId}`}
          className="text-volt min-w-0 flex-1 truncate text-[16px] font-semibold"
        >
          {block.name}
        </Link>

        {isInterval && (
          <IconButton label="Run interval timer" size="sm" onClick={onRunInterval}>
            <Timer className="size-[18px]" />
          </IconButton>
        )}
        {showWeight && heaviest > 0 && (
          <IconButton
            label="Plate calculator"
            size="sm"
            onClick={() => onOpenPlate(heaviest)}
          >
            <Calculator className="size-[18px]" />
          </IconButton>
        )}
        <IconButton label="Exercise options" size="sm" onClick={onOpenMenu}>
          <Ellipsis className="size-[18px]" />
        </IconButton>
      </div>

      {block.notes && (
        <p className="text-text-3 px-4 pb-2 text-[13px] leading-snug">
          {block.notes}
        </p>
      )}

      {block.restSeconds != null && block.restSeconds > 0 && (
        <div className="text-text-3 flex items-center gap-1.5 px-4 pb-2 text-[12px]">
          <Clock className="size-3.5" strokeWidth={2.2} />
          <span className="num">
            Rest {formatDuration(block.restSeconds)}
          </span>
        </div>
      )}

      {/* Column headers — this is a data table, not a card list. */}
      <div
        className="text-text-3 grid items-center gap-1.5 px-3 pb-1 text-[10px] font-bold tracking-[0.08em] uppercase"
        style={{
          gridTemplateColumns: `28px minmax(52px, 1fr) ${
            showWeight ? "minmax(58px, 1fr)" : ""
          } ${showReps || showTime ? "minmax(58px, 1fr)" : ""} 44px`,
        }}
      >
        <span className="text-center">Set</span>
        <span className="text-center">Previous</span>
        {showWeight && <span className="text-center">{unit}</span>}
        {showReps ? (
          <span className="text-center">Reps</span>
        ) : showTime ? (
          <span className="text-center">Secs</span>
        ) : null}
        <span />
      </div>

      <div className="divide-hairline divide-y">
        {block.sets.map((set, i) => {
          if (set.setType !== "warmup") workingIndex++;
          return (
            <div key={set.id} className="relative">
              <SetRow
                set={set}
                index={workingIndex}
                unit={unit}
                trackingType={block.trackingType}
                previous={block.previous[i] ?? null}
                onPatch={(patch) => onPatchSet(set.id, patch)}
                onToggleComplete={() => onToggle(set)}
                onDelete={() => onDeleteSet(set.id)}
                onOpenTypeMenu={() => onOpenTypeMenu(set.id)}
              />
              <AnimatePresence>
                {prFlash === set.id && <PrBurst />}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <button
        onClick={onAddSet}
        className="press text-text-2 hover:text-text-1 hairline-t flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold"
      >
        <Plus className="size-4" strokeWidth={2.6} />
        Add set
      </button>
    </section>
  );
}

/** Gold burst on a new record. Non-blocking — never interrupts the next set. */
function PrBurst() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: 8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className="pointer-events-none absolute top-1/2 right-14 z-10 -translate-y-1/2"
    >
      <span className="bg-pr flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-[0.06em] text-black uppercase">
        PR
      </span>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseOptions({
  block,
  defaultRestSeconds,
  onSetRest,
  onSetNotes,
  onRemove,
}: {
  block: Block;
  defaultRestSeconds: number;
  onSetRest: (seconds: number | null) => void;
  onSetNotes: (notes: string | null) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(block.notes ?? "");
  const rest = block.restSeconds ?? defaultRestSeconds;

  return (
    <div className="space-y-6 px-4 pb-5">
      <div>
        <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
          Rest timer
        </p>
        <div className="flex gap-2">
          {[0, 60, 90, 120, 180, 240].map((s) => (
            <button
              key={s}
              onClick={() => onSetRest(s === 0 ? null : s)}
              className={cn(
                "press num h-10 flex-1 rounded-field border text-[13px] font-semibold",
                (s === 0 ? block.restSeconds == null : rest === s)
                  ? "border-volt bg-volt-fade text-volt"
                  : "border-hairline bg-surface-2 text-text-2",
              )}
            >
              {s === 0 ? "Off" : s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-text-3 mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
          <StickyNote className="size-3.5" />
          Note
        </p>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onSetNotes(notes.trim() || null)}
          placeholder="Cues, machine settings, seat height…"
        />
      </div>

      {block.supersetGroup && (
        <p className="text-text-3 flex items-center gap-1.5 text-[13px]">
          <Link2 className="size-4" />
          Superset group {block.supersetGroup}
        </p>
      )}

      <Button block variant="danger" onClick={onRemove}>
        <Trash2 className="size-4" />
        Remove exercise
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function toBlock(e: FullWorkout["exercises"][number]): Block {
  return {
    id: e.id,
    exerciseId: e.exerciseId,
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    equipment: e.equipment,
    trackingType: e.trackingType,
    notes: e.notes,
    restSeconds: e.restSeconds,
    supersetGroup: e.supersetGroup,
    intervalWorkSeconds: e.intervalWorkSeconds,
    intervalRestSeconds: e.intervalRestSeconds,
    previous: e.previous,
    sets: e.sets.map((s) => ({
      id: s.id,
      position: s.position,
      setType: s.setType,
      weightKg: s.weightKg,
      reps: s.reps,
      seconds: s.seconds,
      distanceM: s.distanceM,
      rpe: s.rpe,
      completed: s.completedAt != null,
    })),
  };
}

export type { Block, ExerciseDraft };
