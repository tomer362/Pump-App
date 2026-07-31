"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AnimatePresence,
  Reorder,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Clock,
  Ellipsis,
  Gauge,
  GripVertical,
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
import {
  SetRow,
  columnLabel,
  setColumns,
  setGridTemplate,
  type SetDraft,
} from "./set-row";
import { RestTimerBar, useRestTimer } from "./rest-timer";
import { ExercisePicker } from "./exercise-picker";
import { PlateCalculator } from "./plate-calculator";
import { IntervalRunner } from "./interval-runner";
import { FinishSheet } from "./finish-sheet";
import { Elapsed } from "@/components/ui/elapsed";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useLongPress } from "@/hooks/use-long-press";
import {
  addSet,
  addExercisesToWorkout,
  discardWorkout,
  removeSet,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  updateSet,
  updateWorkoutExerciseSettings,
  updateWorkoutMeta,
} from "@/lib/actions/workout";
import { setCoopResting } from "@/lib/actions/coop";
import type { FullWorkout } from "@/lib/queries/workout";
import { cn, estimate1RM, formatDuration, formatWeight, haptic } from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";

type ExerciseDraft = FullWorkout["exercises"][number] & { sets: never };

/**
 * Rows and exercises appearing and leaving. Duration-based rather than a
 * spring: these animate `height`, and a spring's overshoot on a collapsing row
 * makes the table below it bounce. 200 ms is the house speed for the routine.
 */
const LIST_TRANSITION = {
  duration: 0.2,
  ease: [0.25, 1, 0.5, 1],
} as const;

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
  uploadsEnabled,
}: {
  workout: FullWorkout;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
  /** Existing 1RM per exercise, so a PR can be flagged the instant it happens. */
  current1rm: Record<string, number>;
  /** False when the deployment has no Blob store — then no photo control. */
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const keyboardInset = useKeyboardInset();
  // Scoped to this workout so a stale timer from another session is ignored.
  const timer = useRestTimer(workout.id);

  const [blocks, setBlocks] = useState<Block[]>(() =>
    workout.exercises.map(toBlock),
  );
  const [name, setName] = useState(workout.name);
  const [note, setNote] = useState(workout.note ?? "");

  // `workout` is the RSC payload from whichever load produced this mount.
  // None of the per-set actions call `revalidatePath` (see the comment on
  // `addExercisesToWorkout` below), so the Router Cache keeps serving the
  // payload from first load even after the DB has moved on. Tapping the
  // exercise name navigates away and back, remounting this component with
  // that same stale `workout` — which would otherwise re-seed `blocks` over
  // whatever the lifter just typed. `seededFrom` is the payload useState()
  // already seeded from; `reseeded` caps the correction to once per mount so
  // a second navigation can't seed twice; `dirty` refuses the correction
  // entirely once the user has touched anything, so a slow refresh landing
  // after they've resumed editing doesn't clobber the new edits with the
  // stale ones it fetched.
  const seededFrom = useRef(workout);
  const reseeded = useRef(false);
  const dirty = useRef(false);

  // Ask Next for a fresh RSC payload the moment this screen mounts. This is
  // the only re-seed trigger — see the ref block above.
  useEffect(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (workout === seededFrom.current || reseeded.current || dirty.current) {
      return;
    }
    reseeded.current = true;
    seededFrom.current = workout;
    setBlocks(workout.exercises.map(toBlock));
    setName(workout.name);
    setNote(workout.note ?? "");
  }, [workout]);

  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [typeMenuFor, setTypeMenuFor] = useState<{ blockId: string; setId: string } | null>(null);
  const [plateFor, setPlateFor] = useState<number | null>(null);
  const [intervalFor, setIntervalFor] = useState<Block | null>(null);
  const [prFlash, setPrFlash] = useState<string | null>(null);

  const bestByExercise = useRef(current1rm);

  const totals = useMemo(() => {
    let volume = 0;
    let sets = 0;
    let unfinished = 0;
    for (const b of blocks) {
      for (const s of b.sets) {
        if (!s.completed) {
          unfinished++;
          continue;
        }
        if (s.setType === "warmup") continue;
        sets++;
        volume += (s.weightKg ?? 0) * (s.reps ?? 0);
      }
    }
    return { volume, sets, unfinished };
  }, [blocks]);

  // Feeds the picker so a lift already on the board says so before you add it
  // a second time. Counted, because a second block of the same lift is legal.
  const alreadyIn = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of blocks) counts[b.exerciseId] = (counts[b.exerciseId] ?? 0) + 1;
    return counts;
  }, [blocks]);

  /* ---------------------------------------------------------------------- */
  /* Mutations — optimistic locally, persisted in the background.            */
  /* ---------------------------------------------------------------------- */

  const patchSet = useCallback(
    (blockId: string, setId: string, patch: Partial<SetDraft>) => {
      dirty.current = true;
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
      // Fired directly, not inside startTransition: tapping the exercise name
      // unmounts this component to navigate, and React is free to abandon an
      // in-flight transition on unmount — which would silently drop the write.
      void updateSet(setId, {
        weightKg: patch.weightKg,
        reps: patch.reps,
        seconds: patch.seconds,
        distanceM: patch.distanceM,
        rpe: patch.rpe,
        setType: patch.setType,
      });
    },
    [],
  );

  const toggleComplete = useCallback(
    (block: Block, set: SetDraft) => {
      dirty.current = true;
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

      // In a superset the rest comes after the last exercise in the group, not
      // between its members — going straight to the partner is the point.
      const partnerPending =
        block.supersetGroup != null &&
        blocks.some(
          (b) =>
            b.id !== block.id &&
            b.supersetGroup === block.supersetGroup &&
            b.sets.some((s) => s.setType !== "warmup" && !s.completed),
        );

      // Completing a working set starts the rest clock — Strong's key behaviour.
      if (next && set.setType !== "warmup") {
        const restSeconds = block.restSeconds ?? defaultRestSeconds;
        if (!partnerPending) {
          timer.start(restSeconds);

          // In a co-op session, publish the rest so the others see you're
          // between sets rather than idle.
          if (workout.coopSessionId) {
            void setCoopResting(workout.coopSessionId, restSeconds);
          }
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

      void updateSet(set.id, { completed: next });
    },
    [blocks, defaultRestSeconds, timer, workout.coopSessionId],
  );

  const appendSet = useCallback(async (block: Block) => {
    dirty.current = true;
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
                  distanceM: last?.distanceM ?? null,
                  rpe: last?.rpe ?? null,
                  completed: false,
                },
              ],
            },
      ),
    );
  }, []);

  /**
   * Mark the set behind an interval round as done. The runner is a full-screen
   * timer, so without this the rounds happened but nothing was recorded — and
   * an interval-only workout could never be finished, since Finish requires at
   * least one completed set.
   */
  const completeIntervalRound = useCallback(
    (blockId: string, setIndex: number, seconds: number) => {
      dirty.current = true;
      let setId: string | undefined;

      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const target = b.sets[setIndex];
          if (!target || target.completed) return b;
          setId = target.id;
          return {
            ...b,
            sets: b.sets.map((s, i) =>
              i === setIndex ? { ...s, seconds, completed: true } : s,
            ),
          };
        }),
      );

      if (!setId) return;
      void updateSet(setId, { seconds, completed: true });
    },
    [],
  );

  const dropSet = useCallback((blockId: string, setId: string) => {
    dirty.current = true;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : { ...b, sets: b.sets.filter((s) => s.id !== setId) },
      ),
    );
    void removeSet(setId);
  }, []);

  const dropExercise = useCallback((blockId: string) => {
    dirty.current = true;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setMenuFor(null);
    void removeWorkoutExercise(blockId);
  }, []);

  const addExercises = useCallback(
    async (ids: string[]) => {
      dirty.current = true;
      setPicking(false);
      if (!ids.length) return;
      const res = await addExercisesToWorkout(workout.id, ids);
      if (!res.ok || !res.data) return;

      // Append from the action's return value rather than refreshing. A
      // refresh would update the server payload while this component's local
      // state — the set values being typed, and the running rest timer —
      // stayed put, so the new exercises would simply never appear.
      setBlocks((prev) => [
        ...prev,
        ...res.data!.added.map((a) => ({
          id: a.id,
          exerciseId: a.exerciseId,
          name: a.name,
          primaryMuscle: a.primaryMuscle,
          equipment: a.equipment,
          trackingType: a.trackingType,
          notes: null,
          restSeconds: a.restSeconds,
          supersetGroup: null,
          intervalWorkSeconds: null,
          intervalRestSeconds: null,
          previous: [],
          sets: [
            {
              id: a.setId,
              position: 0,
              setType: "normal" as SetType,
              weightKg: null,
              reps: null,
              seconds: null,
              distanceM: null,
              rpe: null,
              completed: false,
            },
          ],
        })),
      ]);
    },
    [workout.id],
  );

  const saveMeta = useCallback(
    (patch: { name?: string; note?: string | null }) => {
      dirty.current = true;
      void updateWorkoutMeta(workout.id, patch);
    },
    [workout.id],
  );

  const setRest = useCallback(
    (blockId: string, seconds: number | null) => {
      dirty.current = true;
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, restSeconds: seconds } : b)),
      );
      void updateWorkoutExerciseSettings(blockId, { restSeconds: seconds });
    },
    [],
  );

  const setBlockNotes = useCallback((blockId: string, notes: string | null) => {
    dirty.current = true;
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, notes } : b)),
    );
    void updateWorkoutExerciseSettings(blockId, { notes });
  }, []);

  /**
   * Move an exercise up or down. Buttons rather than a drag handle: the set
   * rows already own the horizontal drag (swipe to delete), the screen is
   * full of focusable inputs, and a 44px tap target is the thing that works
   * one-handed with a phone at arm's length.
   */
  const moveBlock = useCallback(
    (blockId: string, delta: -1 | 1) => {
      const from = blocks.findIndex((b) => b.id === blockId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= blocks.length) return;

      dirty.current = true;
      const next = [...blocks];
      [next[from], next[to]] = [next[to], next[from]];
      haptic.light();
      setMenuFor(null);
      setBlocks(next);
      void reorderWorkoutExercises(
        workout.id,
        next.map((b) => b.id),
      );
    },
    [blocks, workout.id],
  );

  /**
   * Drag reorder, from the compact list. Applied on every crossing so the list
   * under the finger is the truth, but only written once the finger lifts —
   * dragging past four exercises is four crossings and would be four writes.
   */
  const reorderBlocks = useCallback((next: Block[]) => {
    dirty.current = true;
    setBlocks(next);
  }, []);

  const persistOrder = useCallback(
    (ordered: Block[]) => {
      haptic.light();
      void reorderWorkoutExercises(
        workout.id,
        ordered.map((b) => b.id),
      );
    },
    [workout.id],
  );

  const setSuperset = useCallback(
    (blockId: string, supersetGroup: string | null) => {
      dirty.current = true;
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, supersetGroup } : b)),
      );
      void updateWorkoutExerciseSettings(blockId, { supersetGroup });
    },
    [],
  );

  const setInterval = useCallback(
    (blockId: string, work: number | null, rest: number | null) => {
      dirty.current = true;
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, intervalWorkSeconds: work, intervalRestSeconds: rest }
            : b,
        ),
      );
      void updateWorkoutExerciseSettings(blockId, {
        intervalWorkSeconds: work,
        intervalRestSeconds: rest,
      });
    },
    [],
  );

  const menuBlock = blocks.find((b) => b.id === menuFor) ?? null;
  const optionsSet =
    (typeMenuFor &&
      blocks
        .find((b) => b.id === typeMenuFor.blockId)
        ?.sets.find((s) => s.id === typeMenuFor.setId)) ||
    null;
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
            <Elapsed
              start={workout.startedAt}
              className="num text-volt block text-[12px] leading-tight font-bold"
            />
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
        {/* initial={false} — the exercises already on screen at mount are the
            plan, not an event. Only what the lifter adds mid-session animates. */}
        <AnimatePresence initial={false}>
          {blocks.map((block) => (
            <ExerciseBlock
              key={block.id}
              block={block}
              unit={unit}
              prFlash={prFlash}
              canReorder={blocks.length > 1}
              onRequestReorder={() => setReordering(true)}
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
        </AnimatePresence>

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
        onSetDuration={timer.setDuration}
      />

      {/* --- Sheets --- */}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={addExercises}
        alreadyIn={alreadyIn}
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
            onSetSuperset={(g) => setSuperset(menuBlock.id, g)}
            onSetInterval={(w, r) => setInterval(menuBlock.id, w, r)}
            onMove={(delta) => moveBlock(menuBlock.id, delta)}
            canMoveUp={blocks[0]?.id !== menuBlock.id}
            canMoveDown={blocks[blocks.length - 1]?.id !== menuBlock.id}
            canReorder={blocks.length > 1}
            onReorderAll={() => {
              setMenuFor(null);
              setReordering(true);
            }}
            onRemove={() => dropExercise(menuBlock.id)}
          />
        )}
      </Sheet>

      {/* The compact list: names only. An exercise block is a whole table tall,
          and dragging one of those past three others on a phone screen is a
          scroll fight. Stripped to one row each, the whole workout is in the
          thumb's reach at once. */}
      <Sheet
        open={reordering}
        onClose={() => setReordering(false)}
        title="Reorder exercises"
        dragToDismiss={false}
        footer={
          <Button block variant="volt" onClick={() => setReordering(false)}>
            Done
          </Button>
        }
      >
        <ReorderList
          blocks={blocks}
          onReorder={reorderBlocks}
          onCommit={persistOrder}
        />
      </Sheet>

      <Sheet
        open={typeMenuFor != null}
        onClose={() => setTypeMenuFor(null)}
        title="Set options"
      >
        {optionsSet && (
          <SetOptions
            set={optionsSet}
            onSetType={(setType) => {
              if (!typeMenuFor) return;
              patchSet(typeMenuFor.blockId, typeMenuFor.setId, { setType });
              setTypeMenuFor(null);
            }}
            onSetRpe={(rpe) => {
              if (!typeMenuFor) return;
              patchSet(typeMenuFor.blockId, typeMenuFor.setId, { rpe });
            }}
          />
        )}
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
          onRoundComplete={(setIndex, seconds) =>
            completeIntervalRound(intervalFor.id, setIndex, seconds)
          }
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
        uploadsEnabled={uploadsEnabled}
        unfinishedCount={totals.unfinished}
        onNameChange={(v) => {
          setName(v);
          saveMeta({ name: v });
        }}
        onNoteChange={(v) => {
          setNote(v);
          saveMeta({ note: v || null });
        }}
        onDiscard={() => {
          // Hand off to the existing confirmation — discarding is never one tap.
          setFinishing(false);
          setConfirmDiscard(true);
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
  canReorder,
  onRequestReorder,
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
  /** False for a one-exercise workout — there is nothing to reorder against. */
  canReorder: boolean;
  onRequestReorder: () => void;
  onOpenMenu: () => void;
  onOpenPlate: (kg: number) => void;
  onRunInterval: () => void;
  onPatchSet: (setId: string, patch: Partial<SetDraft>) => void;
  onToggle: (set: SetDraft) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onOpenTypeMenu: (setId: string) => void;
}) {
  const reduce = useReducedMotion();
  const longPress = useLongPress(onRequestReorder);
  const columns = setColumns(block.trackingType);
  const showWeight = columns.includes("weight");

  const isInterval =
    block.intervalWorkSeconds != null && block.intervalWorkSeconds > 0;

  // Warm-ups don't consume a set number, matching how lifters count.
  let workingIndex = 0;

  const heaviest = Math.max(
    0,
    ...block.sets.map((s) => (s.setType !== "warmup" ? (s.weightKg ?? 0) : 0)),
  );

  return (
    <motion.section
      // layout="position" and not plain layout: reordering should slide the
      // block, but a set being added inside it must not also resize-animate
      // the whole exercise — that reads as the page breathing.
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={LIST_TRANSITION}
      className="mb-2 overflow-hidden">
      {/* Hold this row to reorder. `select-none` and `-webkit-touch-callout`
          because otherwise iOS answers a long press on a link with its own
          text-selection handles and preview card, on top of ours. */}
      <div
        {...(canReorder ? longPress : {})}
        style={canReorder ? { WebkitTouchCallout: "none" } : undefined}
        className={cn(
          "flex items-center gap-2 px-4 pt-4 pb-2",
          canReorder && "select-none",
        )}
      >
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
        style={{ gridTemplateColumns: setGridTemplate(columns) }}
      >
        <span className="text-center">Set</span>
        <span className="text-center">Previous</span>
        {columns.map((column) => (
          <span key={column} className="text-center">
            {columnLabel(column, unit)}
          </span>
        ))}
        <span />
      </div>

      <div className="divide-hairline divide-y">
        <AnimatePresence initial={false}>
          {block.sets.map((set, i) => {
            if (set.setType !== "warmup") workingIndex++;
            return (
              <motion.div
                key={set.id}
                // Height, not y-translate: the rows below have to move out of
                // the way, and a table where rows slide over each other reads
                // as a glitch rather than an insertion.
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={
                  reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }
                }
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={LIST_TRANSITION}
                className="relative overflow-hidden"
              >
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
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <button
        onClick={onAddSet}
        className="press text-text-2 hover:text-text-1 hairline-t flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold"
      >
        <Plus className="size-4" strokeWidth={2.6} />
        Add set
      </button>
    </motion.section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The reorder list. Hairline rows rather than cards — cards are the social
 * feed's device, and this is a table of contents. Same `Reorder` + explicit
 * `useDragControls` pattern as the routine builder, so the two ordering
 * surfaces in the app feel like one gesture.
 */
function ReorderList({
  blocks,
  onReorder,
  onCommit,
}: {
  blocks: Block[];
  onReorder: (next: Block[]) => void;
  onCommit: (ordered: Block[]) => void;
}) {
  return (
    <Reorder.Group axis="y" values={blocks} onReorder={onReorder}>
      {blocks.map((block, i) => (
        <ReorderRow
          key={block.id}
          block={block}
          last={i === blocks.length - 1}
          // Closed over this render's array, which the reorder above has
          // already rewritten by the time the finger lifts.
          onCommit={() => onCommit(blocks)}
        />
      ))}
    </Reorder.Group>
  );
}

function ReorderRow({
  block,
  last,
  onCommit,
}: {
  block: Block;
  last: boolean;
  onCommit: () => void;
}) {
  const controls = useDragControls();
  const working = block.sets.filter((s) => s.setType !== "warmup").length;

  return (
    <Reorder.Item
      value={block}
      // Only the handle drags. The row is 44px of thumb, and a whole-row
      // listener inside a scrolling sheet catches every attempt to scroll it.
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      className={cn(
        "bg-surface-1 tap relative flex items-center gap-2.5 pr-4",
        !last && "hairline-b",
      )}
    >
      <button
        onPointerDown={(e) => {
          haptic.light();
          controls.start(e);
        }}
        aria-label={`Drag ${block.name} to reorder`}
        className="text-text-3 tap grid shrink-0 touch-none place-items-center px-3"
      >
        <GripVertical className="size-[18px]" />
      </button>

      {block.supersetGroup && (
        <span className="text-volt border-volt/50 grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold">
          {block.supersetGroup}
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
        {block.name}
      </span>

      <span className="num text-text-3 shrink-0 text-[13px]">
        {working} {working === 1 ? "set" : "sets"}
      </span>
    </Reorder.Item>
  );
}

/* -------------------------------------------------------------------------- */

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

const SET_TYPES: [SetType, string, string][] = [
  ["normal", "Normal", "Counts toward volume and records"],
  ["warmup", "Warm-up", "Excluded from volume and records"],
  ["drop", "Drop set", "Performed straight after the previous set"],
  ["failure", "To failure", "Taken to muscular failure"],
];

/** RPE is logged on the half point from 6 up — below that nobody bothers. */
const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function SetOptions({
  set,
  onSetType,
  onSetRpe,
}: {
  set: SetDraft;
  onSetType: (type: SetType) => void;
  onSetRpe: (rpe: number | null) => void;
}) {
  return (
    <div className="px-4 pb-5">
      {SET_TYPES.map(([value, label, desc]) => (
        <button
          key={value}
          onClick={() => onSetType(value)}
          className="press hairline-b flex w-full items-center gap-3 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{label}</span>
            <span className="text-text-3 block text-[13px]">{desc}</span>
          </span>
          {set.setType === value && (
            <Check className="text-volt size-[18px] shrink-0" strokeWidth={2.8} />
          )}
        </button>
      ))}

      <div className="pt-5">
        <SheetLabel>
          <Gauge className="size-3.5" />
          Effort (RPE)
        </SheetLabel>
        <div className="grid grid-cols-5 gap-1.5">
          <button
            onClick={() => onSetRpe(null)}
            className={cn(
              "press rounded-field h-10 border text-[13px] font-semibold",
              set.rpe == null
                ? "border-volt bg-volt-fade text-volt"
                : "border-hairline bg-surface-2 text-text-2",
            )}
          >
            —
          </button>
          {RPE_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => onSetRpe(v)}
              className={cn(
                "press num rounded-field h-10 border text-[13px] font-semibold",
                set.rpe === v
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
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseOptions({
  block,
  defaultRestSeconds,
  onSetRest,
  onSetNotes,
  onSetSuperset,
  onSetInterval,
  onMove,
  canMoveUp,
  canMoveDown,
  canReorder,
  onReorderAll,
  onRemove,
}: {
  block: Block;
  defaultRestSeconds: number;
  onSetRest: (seconds: number | null) => void;
  onSetNotes: (notes: string | null) => void;
  onSetSuperset: (group: string | null) => void;
  onSetInterval: (work: number | null, rest: number | null) => void;
  onMove: (delta: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canReorder: boolean;
  onReorderAll: () => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(block.notes ?? "");
  const rest = block.restSeconds ?? defaultRestSeconds;
  const intervalOn = block.intervalWorkSeconds != null;

  return (
    <div className="space-y-6 px-4 pb-5">
      <div>
        <SheetLabel>Rest timer</SheetLabel>
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
        <SheetLabel>Order</SheetLabel>
        <div className="flex gap-2">
          <Button block variant="solid" disabled={!canMoveUp} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" strokeWidth={2.4} />
            Move up
          </Button>
          <Button
            block
            variant="solid"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" strokeWidth={2.4} />
            Move down
          </Button>
        </div>
        {/* The drag list has no affordance of its own — a long press is
            invisible. This is where someone looking for "reorder" arrives. */}
        {canReorder && (
          <>
            <Button block variant="solid" className="mt-2" onClick={onReorderAll}>
              <GripVertical className="size-4" strokeWidth={2.4} />
              Reorder all
            </Button>
            <p className="text-text-3 mt-2 text-[12px] leading-snug">
              Or hold any exercise name on the workout screen.
            </p>
          </>
        )}
      </div>

      <div>
        <SheetLabel>
          <Link2 className="size-3.5" />
          Superset group
        </SheetLabel>
        <p className="text-text-3 mb-2 text-[12px] leading-snug">
          Exercises sharing a letter are performed back to back — no rest timer
          between them.
        </p>
        <div className="flex gap-2">
          {[null, "A", "B", "C", "D"].map((g) => (
            <button
              key={g ?? "none"}
              onClick={() => onSetSuperset(g)}
              className={cn(
                "press rounded-field h-10 flex-1 border text-[13px] font-semibold",
                block.supersetGroup === g
                  ? "border-volt bg-volt-fade text-volt"
                  : "border-hairline bg-surface-2 text-text-2",
              )}
            >
              {g ?? "None"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SheetLabel>
          <Timer className="size-3.5" />
          Interval mode
        </SheetLabel>
        <p className="text-text-3 mb-2 text-[12px] leading-snug">
          Replaces manual logging with a work/rest countdown and spoken cues.
        </p>
        <div className="flex gap-2">
          {[
            { label: "Off", work: null, restSec: null },
            { label: "30/30", work: 30, restSec: 30 },
            { label: "40/20", work: 40, restSec: 20 },
            { label: "20/10", work: 20, restSec: 10 },
            { label: "60/60", work: 60, restSec: 60 },
          ].map((preset) => {
            const on =
              preset.work == null
                ? !intervalOn
                : block.intervalWorkSeconds === preset.work &&
                  block.intervalRestSeconds === preset.restSec;
            return (
              <button
                key={preset.label}
                onClick={() => onSetInterval(preset.work, preset.restSec)}
                className={cn(
                  "press num rounded-field h-10 flex-1 border text-[13px] font-semibold",
                  on
                    ? "border-volt bg-volt-fade text-volt"
                    : "border-hairline bg-surface-2 text-text-2",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SheetLabel>
          <StickyNote className="size-3.5" />
          Note
        </SheetLabel>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onSetNotes(notes.trim() || null)}
          placeholder="Cues, machine settings, seat height…"
        />
      </div>

      <Button block variant="danger" onClick={onRemove}>
        <Trash2 className="size-4" />
        Remove exercise
      </Button>
    </div>
  );
}

function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
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
