"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AnimatePresence,
  Reorder,
  motion,
  useDragControls,
  useIsPresent,
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
  Minus,
  Plus,
  Repeat2,
  Timer,
  Trash2,
  Calculator,
  StickyNote,
  Link2,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Badge, Segmented, Textarea } from "@/components/ui/primitives";
import {
  RestStrip,
  SetRow,
  columnLabel,
  setColumns,
  setGridTemplate,
  type SetDraft,
} from "./set-row";
import { RpePicker } from "./rpe-picker";
import { RestPicker } from "./rest-picker";
import { RestTimerBar, useRestTimer } from "./rest-timer";
import { useTransient } from "@/hooks/use-transient";
import { showToast, watchAction } from "@/components/ui/toast";
import { alignPrevious } from "@/lib/set-input";
import { isAssistedTracking } from "@/lib/tracking";
import { useScrollWatch } from "@/hooks/use-scroll-watch";
import { FinishSheet } from "./finish-sheet";
import { CoopStrip } from "./coop-strip";
import type { CoopSnapshot } from "@/lib/actions/coop";
import { Elapsed } from "@/components/ui/elapsed";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useLongPress } from "@/hooks/use-long-press";
import { useWorkoutActivity } from "@/hooks/use-workout-activity";
import { endWorkoutActivity } from "@/lib/workout-activity";
import { usePumpJam } from "./pump-jam";
import { RestAlertPrompt } from "./rest-alert-prompt";
import {
  addSet,
  addExercisesToWorkout,
  discardWorkout,
  removeSet,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  replaceWorkoutExercise,
  updateSet,
  updateSets,
  updateWorkoutExerciseSettings,
  updateWorkoutMeta,
} from "@/lib/actions/workout";
import { setCoopResting } from "@/lib/actions/coop";
import type { FullWorkout } from "@/lib/queries/workout";
import { cn, estimate1RM, formatDuration, formatWeight, haptic } from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";
import { prescribedToken } from "@/lib/rpe";
import { hasLoadablePlates } from "@/lib/equipment";
import { DUR, EASE_OUT_QUART, REDUCED, SPRING } from "@/lib/motion";

// All three open from a tap and none of them is on screen when the workout
// mounts — the one screen where the first paint is a sweaty thumb waiting.
const ExercisePicker = dynamic(() =>
  import("./exercise-picker").then((m) => m.ExercisePicker),
);
const PlateCalculator = dynamic(() =>
  import("./plate-calculator").then((m) => m.PlateCalculator),
);
const IntervalRunner = dynamic(() =>
  import("./interval-runner").then((m) => m.IntervalRunner),
);

/**
 * Rows and exercises appearing and leaving. Duration-based rather than a
 * spring: these animate `height`, and a spring's overshoot on a collapsing row
 * makes the table below it bounce. 200 ms is the house speed for the routine.
 */
const LIST_TRANSITION = {
  duration: DUR.base,
  ease: EASE_OUT_QUART,
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
  previous: {
    weightKg: number | null;
    reps: number | null;
    seconds: number | null;
    setType: string;
  }[];
  sets: SetDraft[];
};

/**
 * The sets on a block that hold something somebody put there — a number typed
 * into any column, an effort rating, or a completion.
 *
 * Two questions turn on it: whether removing this exercise is throwing work
 * away, and whether a replacement has anything worth offering to keep. Both
 * want the same answer, so it is written once. A set carrying only a rest
 * override or a set type doesn't count: neither is a performance, and both are
 * recreated by the block that replaces it.
 */
function loggedSets(block: Block) {
  return block.sets.filter(
    (s) =>
      s.completed ||
      s.weightKg != null ||
      s.reps != null ||
      s.seconds != null ||
      s.distanceM != null ||
      s.rpe != null,
  );
}

export function WorkoutScreen({
  workout,
  unit,
  currentUserId,
  defaultRestSeconds,
  current1rm,
  muscleWeekSets,
  coop,
  uploadsEnabled,
}: {
  workout: FullWorkout;
  unit: "kg" | "lb";
  currentUserId: string;
  defaultRestSeconds: number;
  /** Existing 1RM per exercise, so a PR can be flagged the instant it happens. */
  current1rm: Record<string, number>;
  /**
   * Sets per muscle over the last 7 days, from finished workouts only. What
   * this session adds is counted on the client, so the number moves as sets
   * land instead of being a figure from before the warm-up.
   */
  muscleWeekSets: Record<string, number>;
  /** The co-op roster, when this workout is part of a session. */
  coop: CoopSnapshot | null;
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

  /**
   * The exercise whose set was ticked most recently — see `nextTarget`. Seeded
   * from the logged times rather than starting empty, so a mid-superset reload
   * doesn't forget which half of the rotation you're on.
   */
  const [lastBlockId, setLastBlockId] = useState<string | null>(() =>
    lastWorkedBlock(workout),
  );

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
    setLastBlockId(lastWorkedBlock(workout));
    setBlocks(workout.exercises.map(toBlock));
    setName(workout.name);
    setNote(workout.note ?? "");
  }, [workout]);

  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  /**
   * A removal that would throw logged sets away, held until it is confirmed.
   * An untouched exercise is removed on the tap — there is nothing to lose and
   * a modal for it is friction on the one screen that can't afford any.
   */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  /**
   * A chosen replacement waiting on the one question only the lifter can
   * answer: the sets already logged were performed on the movement being
   * swapped out, and whether they belong to the one swapping in depends on how
   * similar the two are. Nothing has been written when this is set.
   */
  const [replaceAsk, setReplaceAsk] = useState<{
    blockId: string;
    exerciseId: string;
    name: string;
    count: number;
  } | null>(null);
  const [typeMenuFor, setTypeMenuFor] = useState<{ blockId: string; setId: string } | null>(null);
  /**
   * The rest sheet's target. `setId` null means the exercise as a whole — the
   * two scopes share one sheet because they are one decision with a scope, not
   * two features.
   */
  const [restFor, setRestFor] = useState<{
    blockId: string;
    setId: string | null;
  } | null>(null);
  const [plateFor, setPlateFor] = useState<number | null>(null);
  const [intervalFor, setIntervalFor] = useState<Block | null>(null);
  /**
   * Which rest the bar is *showing*, as that rest's `endsAt`.
   *
   * Visibility used to be the same bit as "a rest is running": ticking a set
   * started the clock and the bar took the bottom of the screen for the whole
   * two minutes — over the set table, which is exactly what you are reading and
   * typing into between sets. The clock is not the panel. The strip already
   * sitting in the gap counts down on its own, and tapping it opens this; any
   * other interaction closes it again and the rest keeps running underneath.
   *
   * Keyed on `endsAt` rather than a boolean so a *new* rest can never inherit
   * the previous one's open state — which is the whole failure mode being
   * fixed, in miniature.
   */
  const [restBarFor, setRestBarFor] = useState<number | null>(null);
  const [prFlash, flashPr] = useTransient<string | null>(null, 2600);

  // A copy, never the prop itself: this is written to as PRs land, and the
  // prop is the RSC payload — mutating it meant comparing against a hand-edited
  // copy of the first load's records for the rest of the session. A fresh
  // payload after `router.refresh()` is merged in by taking the higher figure,
  // so a record set this session (which the server only writes at finish) is
  // never forgotten and then celebrated twice.
  const bestByExercise = useRef<Record<string, number>>({ ...current1rm });
  useEffect(() => {
    for (const [id, value] of Object.entries(current1rm)) {
      bestByExercise.current[id] = Math.max(bestByExercise.current[id] ?? 0, value);
    }
  }, [current1rm]);

  /**
   * The live fill in progress: the cell driving it, the field, and the sets it
   * has written so far. See `patchSet` for why the run has to be remembered.
   */
  const fillRun = useRef<{
    setId: string;
    field: (typeof FILLABLE)[number];
    ids: string[];
  } | null>(null);

  const totals = useMemo(() => {
    let volume = 0;
    let sets = 0;
    let unfinished = 0;
    let planned = 0;
    let done = 0;
    for (const b of blocks) {
      for (const s of b.sets) {
        planned++;
        if (!s.completed) {
          unfinished++;
          continue;
        }
        done++;
        if (s.setType === "warmup") continue;
        sets++;
        volume += (s.weightKg ?? 0) * (s.reps ?? 0);
      }
    }
    return { volume, sets, unfinished, planned, done };
  }, [blocks]);

  /**
   * The set the lifter owes next. Everything that points somewhere — the rest
   * bar's "next", the jump pill — points here, so they can never disagree.
   *
   * Document order, except inside a superset: those exercises are performed in
   * rotation, so after a set on A1 the next thing to do is A2's set, not A1's
   * second. `lastBlockId` is which exercise was ticked last, which is the only
   * way to know where in the rotation we are.
   */
  const nextTarget = useMemo(
    () => findNextTarget(blocks, lastBlockId),
    [blocks, lastBlockId],
  );

  /**
   * A superset hands you straight to the partner with no rest, so there is no
   * rest bar to say where to go — this flags the seconds right after such a
   * set, when the pill should show even though the row is on screen.
   */
  const [supersetCue, flashSupersetCue, clearSupersetCue] = useTransient(false, 7000);

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
    (
      blockId: string,
      setId: string,
      patch: Partial<SetDraft>,
      opts?: { fill?: boolean; local?: boolean },
    ) => {
      dirty.current = true;
      const local = opts?.local === true;
      const field = FILLABLE.find((f) => f in patch);

      // The run only carries within one uninterrupted typing session. After
      // the first keystroke of "100" the sets below hold 1, so they are no
      // longer empty and the fill would stop dead on the "0" — for as long as
      // this run owns them they count as empty again. A different cell, or a
      // committed value, ends the run: editing a set later must not rewrite
      // the ones under it, which is the rule the commit-time fill was built on.
      const run = fillRun.current;
      const owned =
        field && run && run.setId === setId && run.field === field ? run.ids : [];

      const source = owned.length
        ? blocks.map((b) =>
            b.id !== blockId
              ? b
              : {
                  ...b,
                  sets: b.sets.map((s) =>
                    owned.includes(s.id) ? { ...s, [field!]: null } : s,
                  ),
                },
          )
        : blocks;

      // Typing a weight or a rep count carries it down the sets below, which
      // is how a straight-across working set gets logged in one entry instead
      // of four. It stops at the first set that already has a number for that
      // field, is completed, or is a warm-up — so editing one set later never
      // rewrites the ones under it, and a working weight never lands on a
      // warm-up.
      const ids = opts?.fill
        ? [setId, ...fillTargets(source, blockId, setId, patch)]
        : // Clearing the cell mid-run empties what the run filled, rather than
          // stranding them on a value the lifter has just deleted.
          [setId, ...owned];

      if (!local || !field) fillRun.current = null;
      else if (opts?.fill) fillRun.current = { setId, field, ids: ids.slice(1) };
      else if (owned.length) fillRun.current = { setId, field, ids: owned };
      else fillRun.current = null;

      setBlocks((prev) =>
        prev.map((b) =>
          b.id !== blockId
            ? b
            : {
                ...b,
                sets: b.sets.map((s) =>
                  ids.includes(s.id) ? { ...s, ...patch } : s,
                ),
              },
        ),
      );

      // A keystroke only moves local state. Persisting per character would be
      // a round-trip per digit on a phone, which the Neon budget rules out.
      if (local) return;

      const values = {
        weightKg: patch.weightKg,
        reps: patch.reps,
        seconds: patch.seconds,
        distanceM: patch.distanceM,
        rpe: patch.rpe,
        restSeconds: patch.restSeconds,
        setType: patch.setType,
      };
      // Fired directly, not inside startTransition: tapping the exercise name
      // unmounts this component to navigate, and React is free to abandon an
      // in-flight transition on unmount — which would silently drop the write.
      // One round-trip for the whole fill either way.
      if (ids.length > 1) void watchAction(updateSets(ids, values));
      else void watchAction(updateSet(setId, values));
    },
    [blocks],
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

      // Where we are in a superset rotation is "who was ticked last".
      if (next) setLastBlockId(block.id);
      // Any tick answers the previous cue, whatever it pointed at.
      clearSupersetCue();

      // Completing a working set starts the rest clock — Strong's key behaviour.
      if (next && set.setType !== "warmup") {
        // Three levels: this set's override, then the exercise, then the
        // account default. `0` at any level means no rest and stops the search,
        // which is why this is `??` and not `||`.
        const restSeconds =
          set.restSeconds ?? block.restSeconds ?? defaultRestSeconds;
        if (partnerPending) {
          // No rest means no rest bar, so nothing would otherwise name the
          // partner you're supposed to walk straight to. Surface the pill for
          // a few seconds even though its row may be in view.
          flashSupersetCue(true);
        } else if (restSeconds > 0) {
          // Tagged with the set, so the strip sitting in that gap can show the
          // same countdown as the bar rather than its planned duration.
          timer.start(restSeconds, set.id);

          // In a co-op session, publish the rest so the others see you're
          // between sets rather than idle.
          if (workout.coopSessionId) {
            void setCoopResting(workout.coopSessionId, restSeconds);
          }
        }

        // Never for an assisted machine: its weight column is help received,
        // `current1rm` holds no 1RM for it, so every set would "beat" a best
        // of zero and the gold burst would fire for needing more help.
        const est =
          !isAssistedTracking(block.trackingType) &&
          set.weightKg != null &&
          set.reps != null
            ? estimate1RM(set.weightKg, set.reps)
            : 0;
        const best = bestByExercise.current[block.exerciseId] ?? 0;
        if (est > best + 0.01) {
          bestByExercise.current[block.exerciseId] = est;
          flashPr(set.id);
          haptic.success();
        }
      }
      if (!next && timer.state?.setId === set.id) {
        // Only the rest this set started. Correcting a mis-tick three
        // exercises up used to stop the rest running for the set just done.
        timer.stop();
        if (workout.coopSessionId) void setCoopResting(workout.coopSessionId, null);
      }

      void watchAction(updateSet(set.id, { completed: next }), () => {
        // The tick was optimistic and the database never took it: untick,
        // or the header counts a set that isn't there.
        setBlocks((prev) =>
          prev.map((b) =>
            b.id !== block.id
              ? b
              : {
                  ...b,
                  sets: b.sets.map((s) =>
                    s.id === set.id ? { ...s, completed: !next } : s,
                  ),
                },
          ),
        );
      });
    },
    [
      blocks,
      defaultRestSeconds,
      timer,
      workout.coopSessionId,
      clearSupersetCue,
      flashPr,
      flashSupersetCue,
    ],
  );

  const appendSet = useCallback(async (block: Block) => {
    dirty.current = true;
    haptic.light();
    const res = await watchAction(addSet(block.id));
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
                  // Mirrors `addSet` on the server: the prescription carries
                  // forward, the rating does not — an appended set has not been
                  // performed, so it cannot already have felt like anything.
                  rpe: null,
                  targetRpe: last?.targetRpe ?? null,
                  // Same reasoning for the previous set's rest override.
                  restSeconds: last?.restSeconds ?? null,
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
      void watchAction(updateSet(setId, { seconds, completed: true }));
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
    void watchAction(removeSet(setId));
  }, []);

  const dropExercise = useCallback((blockId: string) => {
    dirty.current = true;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setMenuFor(null);
    void watchAction(removeWorkoutExercise(blockId));
  }, []);

  /**
   * Swap the movement on one block. The sets come back from the server rather
   * than being patched here, because only the server knows whether the logged
   * values survived: it refuses to keep them across a change of tracking type
   * however the sheet was answered, and a local guess would show numbers the
   * database no longer has.
   */
  const swapExercise = useCallback(
    async (blockId: string, exerciseId: string, keepValues: boolean) => {
      dirty.current = true;
      setReplaceFor(null);
      setReplaceAsk(null);
      const res = await watchAction(
        replaceWorkoutExercise(blockId, exerciseId, keepValues),
      );
      if (!res.ok || !res.data) return;
      const r = res.data;
      haptic.light();
      setBlocks((prev) =>
        prev.map((b) =>
          b.id !== blockId
            ? b
            : {
                ...b,
                exerciseId: r.exerciseId,
                name: r.name,
                primaryMuscle: r.primaryMuscle,
                equipment: r.equipment,
                trackingType: r.trackingType,
                notes: null,
                intervalWorkSeconds: null,
                intervalRestSeconds: null,
                previous: r.previous,
                sets: r.sets.map((s) => ({
                  id: s.id,
                  position: s.position,
                  setType: s.setType as SetType,
                  weightKg: s.weightKg,
                  reps: s.reps,
                  seconds: s.seconds,
                  distanceM: s.distanceM,
                  rpe: s.rpe,
                  targetRpe: s.targetRpe,
                  restSeconds: s.restSeconds,
                  completed: s.completed,
                })),
              },
        ),
      );
    },
    [],
  );

  const addExercises = useCallback(
    async (ids: string[]) => {
      dirty.current = true;
      setPicking(false);
      if (!ids.length) return;
      const res = await watchAction(addExercisesToWorkout(workout.id, ids));
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
              // Added by hand mid-workout, so nothing prescribed it.
              targetRpe: null,
              restSeconds: null,
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
      void watchAction(updateWorkoutMeta(workout.id, patch));
    },
    [workout.id],
  );

  /**
   * Rest for a whole exercise. Mirrors what the action does server-side: this
   * is the "entire exercise" setting, so the per-set overrides underneath it go
   * — otherwise a set previously pushed to 3m would quietly keep winning over
   * the value just chosen.
   */
  const setRest = useCallback(
    (blockId: string, seconds: number | null) => {
      dirty.current = true;
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                restSeconds: seconds,
                sets: b.sets.map((s) =>
                  s.restSeconds == null ? s : { ...s, restSeconds: null },
                ),
              }
            : b,
        ),
      );
      void watchAction(updateWorkoutExerciseSettings(blockId, { restSeconds: seconds }));
    },
    [],
  );

  const setBlockNotes = useCallback((blockId: string, notes: string | null) => {
    dirty.current = true;
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, notes } : b)),
    );
    void watchAction(updateWorkoutExerciseSettings(blockId, { notes }));
  }, []);

  /**
   * Move an exercise up or down. Buttons rather than a drag handle: the set
   * rows already own the horizontal drag (swipe to delete), the screen is
   * full of focusable inputs, and a 44px tap target is the thing that works
   * one-handed with a phone at arm's length.
   */
  const moveBlock = useCallback(
    (blockId: string, delta: -1 | 1) => {
      dirty.current = true;
      const from = blocks.findIndex((b) => b.id === blockId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= blocks.length) return;

      const next = [...blocks];
      [next[from], next[to]] = [next[to], next[from]];
      haptic.light();
      setMenuFor(null);
      setBlocks(next);
      void watchAction(reorderWorkoutExercises(
        workout.id,
        next.map((b) => b.id),
      ));
    },
    [blocks, workout.id],
  );

  /** Drag reordering, from the compact list. See `closeReorder`. */
  const reorderBlocks = useCallback(
    (ids: string[]) => {
      dirty.current = true;
      const byId = new Map(blocks.map((b) => [b.id, b]));
      const next = ids
        .map((id) => byId.get(id))
        .filter((b): b is Block => b != null);
      if (next.length !== blocks.length) return;
      haptic.light();
      setBlocks(next);
      void watchAction(reorderWorkoutExercises(workout.id, ids));
    },
    [blocks, workout.id],
  );

  /**
   * The order the sheet is currently showing. A ref, not state, and committed
   * only when the sheet closes.
   *
   * This used to write straight through on every drop, so the full exercise
   * blocks behind the sheet re-ordered live underneath it — tall rows sliding
   * about behind a modal, on a screen that is mostly numeric inputs. Both of the
   * reasons given for writing per drop turned out not to hold: the *decision* is
   * made when the sheet is dismissed, not on each intermediate drop, and
   * `Sheet` does route backdrop and Escape through `onClose`, so there is a
   * handler to hang it on after all. Nothing is lost by dismissing either way.
   */
  const pendingOrder = useRef<string[] | null>(null);

  const closeReorder = useCallback(() => {
    const ids = pendingOrder.current;
    pendingOrder.current = null;
    setReordering(false);
    if (!ids) return;
    // Don't fire a write, a haptic and a re-render for a sheet that was opened
    // and closed without moving anything.
    const unchanged =
      ids.length === blocks.length && ids.every((id, i) => blocks[i]?.id === id);
    if (!unchanged) reorderBlocks(ids);
  }, [blocks, reorderBlocks]);

  const setSuperset = useCallback(
    (blockId: string, supersetGroup: string | null) => {
      dirty.current = true;
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, supersetGroup } : b)),
      );
      void watchAction(updateWorkoutExerciseSettings(blockId, { supersetGroup }));
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
      void watchAction(updateWorkoutExerciseSettings(blockId, {
        intervalWorkSeconds: work,
        intervalRestSeconds: rest,
      }));
    },
    [],
  );

  /* ---------------------------------------------------------------------- */
  /* Orientation while scrolling.                                            */
  /* ---------------------------------------------------------------------- */

  const reduce = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const [flashSetId, flashSet] = useTransient<string | null>(null, 1600);

  // Where each exercise's column headers come to rest when they stick. Measured
  // rather than hard-coded: the header carries a safe-area inset and, in a
  // co-op session, a whole extra row.
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const read = () => setHeaderH(el.getBoundingClientRect().height);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hold the elapsed time a beat longer than any accidental press and the gym
  // gets a soundtrack. Deliberately unadvertised: no icon, no hint, and a 1.1s
  // hold — well past the hook's 480ms default and past iOS's own long-press
  // menu — so nobody trips it reaching for Finish. The header's centre block is
  // the one gesture-free target up there; the exercise titles already spend
  // their hold on reorder.
  const jam = usePumpJam();
  const jamPress = useLongPress(jam.start, { delayMs: 1100 });

  /** Working sets logged in *this* session, per muscle. Added to the 7-day
   *  figure from the server so the number moves while you train. */
  const liveMuscleSets = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of blocks) {
      for (const s of b.sets) {
        if (!s.completed || s.setType === "warmup") continue;
        counts[b.primaryMuscle] = (counts[b.primaryMuscle] ?? 0) + 1;
      }
    }
    return counts;
  }, [blocks]);

  /**
   * One derived truth for "the panel is showing", read by both the bar and the
   * jump pill. Not `restBarFor !== null` on its own: a rest that runs out
   * auto-clears the store two and a half seconds later, and the endsAt left
   * behind would otherwise keep the pill suppressed for the rest of the
   * session.
   */
  const restBarOpen = timer.state != null && restBarFor === timer.state.endsAt;

  const { activeBlockId, targetAway } = useScrollWatch({
    headerRef,
    // Roughly the rest bar: below that line a row is behind the chrome.
    bottomInset: 88,
    targetSetId: nextTarget?.set.id ?? null,
  });

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;

  /**
   * Scroll a row back into the middle of the screen and tint it for a beat.
   * Landing somewhere with no confirmation of *what* you landed on is the part
   * that makes a jump feel like a glitch.
   */
  const jumpToSet = useCallback(
    (setId: string) => {
      const el = document.querySelector<HTMLElement>(
        `[data-set-id="${CSS.escape(setId)}"]`,
      );
      if (!el) return;
      haptic.light();
      el.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
      flashSet(setId);
    },
    [reduce, flashSet],
  );

  /* ---------------------------------------------------------------------- */
  /* The session while the phone is in a pocket.                             */
  /* ---------------------------------------------------------------------- */

  /** What the next set is, phrased for a lock screen rather than a table row. */
  const nextUpLine = useMemo(() => {
    if (!nextTarget) return "Back to it.";
    return [
      nextTarget.block.name,
      setLabel(nextTarget.set, nextTarget.index),
      targetLabel(
        nextTarget.block,
        nextTarget.set,
        nextTarget.position,
        unit,
      ),
    ]
      .filter(Boolean)
      .join(" · ");
  }, [nextTarget, unit]);

  useWorkoutActivity({
    url: `/workout/${workout.id}`,
    title: name,
    // Sets and volume, the same two figures the header carries — plus where to
    // pick the session back up, which is the reason to look at all.
    progressBody: `${totals.sets} set${totals.sets === 1 ? "" : "s"} · ${formatWeight(
      totals.volume,
      unit,
    )} ${unit}${nextTarget ? ` · Next: ${nextTarget.block.name}` : ""}`,
    // A paused rest has a stale `endsAt`; null cancels the background alarm, and
    // resuming (a fresh `endsAt`) re-arms it.
    restEndsAt: timer.paused ? null : (timer.state?.endsAt ?? null),
    restBody: nextUpLine,
    setsRemaining: totals.unfinished,
  });

  const menuBlock = blocks.find((b) => b.id === menuFor) ?? null;
  const removeBlock = blocks.find((b) => b.id === confirmRemove) ?? null;
  const removeCount = removeBlock ? loggedSets(removeBlock).length : 0;
  const replaceBlock = blocks.find((b) => b.id === replaceFor) ?? null;
  const restBlock = blocks.find((b) => b.id === restFor?.blockId) ?? null;
  const restSet =
    (restFor?.setId && restBlock?.sets.find((s) => s.id === restFor.setId)) ||
    null;
  // The duration the editor's "Start rest" would run, after the set → exercise →
  // account fallback. Recomputed each render, so it tracks edits made in the
  // sheet (which persist onto `blocks`) without its own state.
  const restResolved = restSet
    ? (restSet.restSeconds ?? restBlock?.restSeconds ?? defaultRestSeconds)
    : null;
  // Starting a rest for a set you haven't finished isn't a thing you'd want, so
  // the sheet only offers Start once the set above is completed (and there is a
  // positive duration to run). Otherwise the sheet is a pure duration editor.
  const canStartRest =
    restSet?.completed === true && (restResolved ?? 0) > 0;

  // Start a rest by hand from the editor: run the clock bound to this set, open
  // the bar over it (controls right there), and tell a co-op session.
  const startRest = (setId: string, seconds: number) => {
    if (seconds <= 0) return;
    const endsAt = timer.start(seconds, setId);
    if (endsAt) setRestBarFor(endsAt);
    if (workout.coopSessionId)
      void setCoopResting(workout.coopSessionId, seconds);
  };
  const optionsSet =
    (typeMenuFor &&
      blocks
        .find((b) => b.id === typeMenuFor.blockId)
        ?.sets.find((s) => s.id === typeMenuFor.setId)) ||
    null;
  // Anything ticked, warm-ups included — the server finishes on that. It used
  // to count working sets only, so three ticked warm-ups left Finish greyed
  // out with nothing on screen saying why.
  const anyCompleted = totals.done > 0;

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
      <header
        ref={headerRef}
        className="bg-bg hairline-b sticky top-0 z-30 pt-safe inset-safe-x"
      >
        <div className="flex h-12 items-center gap-1 px-2">
          <IconButton
            label="Back"
            onClick={() => router.push("/feed")}
            className="text-text-2"
          >
            <ChevronLeft className="size-6" strokeWidth={2.4} />
          </IconButton>

          {/* Also the easter egg. `select-none` for the same reason the exercise
              titles have it: iOS raises its text-selection handles out of a
              hold otherwise. `h-full` so the target is the whole 48px row and
              not just two lines of text. */}
          <div
            {...jamPress}
            onClick={jam.playing ? jam.stop : undefined}
            className="flex h-full min-w-0 flex-1 flex-col justify-center text-center select-none"
          >
            <div className="truncate text-[15px] font-semibold">{name}</div>
            <div className="flex items-center justify-center gap-1.5">
              <Elapsed
                start={workout.startedAt}
                className="num text-volt text-[12px] leading-tight font-bold"
              />
              {jam.playing && (
                // The way out short of waiting it out, and the only thing on
                // screen that admits the egg exists once it's been found.
                <button
                  type="button"
                  aria-label="Stop music"
                  onClick={jam.stop}
                  // 44px of hit area on a 12px glyph; the negative margin keeps
                  // the two-line title block at its height.
                  className="-my-4 flex min-h-11 min-w-11 items-center justify-center"
                >
                  <span className="flex h-3 items-end gap-[2px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="bg-volt w-[2px] rounded-full"
                      style={
                        reduce
                          ? { height: "60%" }
                          : { animation: `jam-bar 620ms ${i * 140}ms ease-in-out infinite alternate` }
                      }
                    />
                  ))}
                  </span>
                </button>
              )}
            </div>
          </div>

          <Button
            variant="volt"
            size="sm"
            onClick={() => {
              haptic.medium();
              if (!anyCompleted) {
                showToast("Tick at least one set to finish.", "info");
                return;
              }
              setFinishing(true);
            }}
          >
            Finish
          </Button>
        </div>

        {/* One row, two readings. At the top of the workout it's the session
            summary — sets and volume. The moment an exercise passes under the header
            it becomes that exercise, because a phone screen shows about one
            block at a time and the name has already scrolled off. Cross-faded
            in a fixed-height box: a row that grows and shrinks would shift the
            table under a thumb that's aiming at a checkmark. */}
        <div className="relative h-[26px]">
          <motion.div
            animate={{ opacity: activeBlock ? 0 : 1 }}
            transition={{ duration: 0.15 }}
            aria-hidden={activeBlock != null}
            className={cn(
              "text-text-3 absolute inset-0 flex items-center justify-center gap-4 px-4 text-[12px]",
              activeBlock && "pointer-events-none",
            )}
          >
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
          </motion.div>

          <motion.div
            animate={{ opacity: activeBlock ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden={activeBlock == null}
            className={cn(
              "absolute inset-0 flex items-center justify-center gap-2 px-4",
              !activeBlock && "pointer-events-none",
            )}
          >
            {activeBlock && (
              <>
                {activeBlock.supersetGroup && (
                  <span className="text-volt border-volt/50 grid size-4 shrink-0 place-items-center rounded border text-[9px] font-bold">
                    {activeBlock.supersetGroup}
                  </span>
                )}
                <span className="truncate text-[13px] font-semibold">
                  {activeBlock.name}
                </span>
                <span className="bg-hairline h-3 w-px shrink-0" />
                <span className="num text-text-3 shrink-0 text-[12px]">
                  <span className="text-text-1 font-semibold">
                    {activeBlock.sets.filter((s) => s.completed).length}
                  </span>
                  /{activeBlock.sets.length} sets
                </span>
              </>
            )}
          </motion.div>
        </div>

        {/* The room, if there is one. Pinned here rather than left on /coop:
            this is the screen a participant actually spends the session on. */}
        {coop && <CoopStrip initial={coop} currentUserId={currentUserId} />}

        {/* How much of the session is behind you, on the header's own hairline.
            Volt because it is progress, not decoration — and it's the one thing
            on this screen that answers "how much longer" without arithmetic. */}
        {totals.planned > 0 && (
          <div
            className="bg-volt absolute inset-x-0 bottom-0 h-[2px] origin-left"
            style={{
              transform: `scaleX(${totals.done / totals.planned})`,
              transition: "transform 300ms var(--ease-out-quart)",
            }}
          />
        )}
      </header>

      {/* Below the header rather than inside it: the header is measured for the
          sticky column offsets, and a row that can vanish mid-session would
          re-measure the whole table under a thumb. */}
      <RestAlertPrompt />

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
              flashSetId={flashSetId}
              stickyTop={headerH}
              weekSets={
                (muscleWeekSets[block.primaryMuscle] ?? 0) +
                (liveMuscleSets[block.primaryMuscle] ?? 0)
              }
              defaultRestSeconds={defaultRestSeconds}
              restingSetId={timer.state?.setId ?? null}
              restingTotal={timer.state?.totalSeconds ?? null}
              canReorder={blocks.length > 1}
              onRequestReorder={() => setReordering(true)}
              onOpenMenu={() => setMenuFor(block.id)}
              onOpenPlate={(kg) => setPlateFor(kg)}
              onRunInterval={() => setIntervalFor(block)}
              onEditRest={(setId) => setRestFor({ blockId: block.id, setId })}
              onOpenRestTimer={() =>
                setRestBarFor(timer.state?.endsAt ?? null)
              }
              onPatchSet={(setId, patch, opts) =>
                patchSet(block.id, setId, patch, opts)
              }
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
        state={restBarOpen ? timer.state : null}
        nextUp={
          nextTarget && {
            name: nextTarget.block.name,
            supersetGroup: nextTarget.block.supersetGroup,
            setLabel: setLabel(nextTarget.set, nextTarget.index),
            target: targetLabel(
              nextTarget.block,
              nextTarget.set,
              nextTarget.position,
              unit,
            ),
            onJump: () => jumpToSet(nextTarget.set.id),
          }
        }
        paused={timer.paused}
        onStop={() => {
          setRestBarFor(null);
          timer.stop();
        }}
        onAdjust={(delta) => {
          // Adjusting mints a new `endsAt`; re-bind the panel to it or the
          // `restBarFor === endsAt` check would close the panel out from under
          // the tap.
          const endsAt = timer.adjust(delta);
          if (endsAt) setRestBarFor(endsAt);
        }}
        onSetDuration={(seconds) => {
          const endsAt = timer.setDuration(seconds);
          if (endsAt) setRestBarFor(endsAt);
        }}
        onPause={timer.pause}
        onResume={() => {
          const endsAt = timer.resume();
          if (endsAt) setRestBarFor(endsAt);
        }}
        onDismiss={() => setRestBarFor(null)}
      />

      {/* The way back to work. Once the set you owe has left the screen — you
          scrolled off to check a later lift, or to add one — this is the only
          thing on screen that knows where it went. It also shows for a few
          seconds after a superset set, on screen or not: that hand-off has no
          rest bar to name the partner. It stands down while the rest bar is
          *open* (which carries the same target, on its own row) and while the
          keyboard is up, where a docked pill would be buried — but not merely
          because a rest is running, since the bar no longer shows itself. */}
      <AnimatePresence>
        {nextTarget &&
          (targetAway || supersetCue) &&
          !restBarOpen &&
          keyboardInset === 0 && (
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={reduce ? REDUCED : SPRING.snappy}
              className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 mb-safe"
            >
              <button
                onClick={() => jumpToSet(nextTarget.set.id)}
                className="press tap bg-surface-2 border-hairline text-text-1 pointer-events-auto flex max-w-full items-center gap-2 rounded-full border py-2.5 pr-4 pl-3.5"
              >
                {supersetCue && !targetAway ? (
                  <Link2 className="text-volt size-4 shrink-0" strokeWidth={2.6} />
                ) : targetAway === "down" ? (
                  <ArrowDown
                    className="text-text-3 size-4 shrink-0"
                    strokeWidth={2.6}
                  />
                ) : (
                  <ArrowUp
                    className="text-text-3 size-4 shrink-0"
                    strokeWidth={2.6}
                  />
                )}
                {supersetCue && (
                  <span className="text-text-3 shrink-0 text-[12px]">
                    Straight into
                  </span>
                )}
                <span className="min-w-0 truncate text-[13px] font-semibold">
                  {nextTarget.block.name}
                </span>
                <span className="num text-text-3 shrink-0 text-[12px]">
                  {setLabel(nextTarget.set, nextTarget.index)}
                </span>
              </button>
            </motion.div>
          )}
      </AnimatePresence>

      {/* --- Sheets --- */}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={addExercises}
        alreadyIn={alreadyIn}
      />

      <ExercisePicker
        open={replaceBlock != null}
        onClose={() => setReplaceFor(null)}
        mode="replace"
        replacing={
          replaceBlock && {
            id: replaceBlock.exerciseId,
            name: replaceBlock.name,
          }
        }
        onConfirm={(ids, items) => {
          if (!replaceBlock || !ids[0]) return;
          const logged = loggedSets(replaceBlock).length;
          const picked = items.find((e) => e.id === ids[0]);
          // Ask only when there is something to lose *and* the two movements
          // are measured the same way. Anything else — an untouched block, a
          // swap across tracking types, an exercise created inline that this
          // sheet has no row for — clears, which is what the app has always
          // done and what the server would enforce anyway.
          if (logged > 0 && picked?.trackingType === replaceBlock.trackingType) {
            setReplaceFor(null);
            setReplaceAsk({
              blockId: replaceBlock.id,
              exerciseId: ids[0],
              name: picked.name,
              count: logged,
            });
            return;
          }
          swapExercise(replaceBlock.id, ids[0], false);
        }}
      />

      <Sheet
        open={menuBlock != null}
        onClose={() => setMenuFor(null)}
        title={menuBlock?.name}
        // Every control in here writes as it is tapped, so nothing closed the
        // sheet but a gesture nobody had been shown.
        dismissLabel="Done"
        // Removing is the one thing you open this sheet in a hurry for, and it
        // used to sit under rest, order, superset, interval and a note — off
        // the bottom of a phone. It is a shortcut, not a second control: this
        // is the only way to remove an exercise from here now.
        titleAction={
          menuBlock ? (
            <IconButton
              label={`Remove ${menuBlock.name}`}
              variant="danger"
              size="sm"
              onClick={() => {
                const block = menuBlock;
                setMenuFor(null);
                // Nothing logged, nothing to lose — a modal there is friction
                // on the one screen that can't afford any.
                if (loggedSets(block).length === 0) {
                  dropExercise(block.id);
                  return;
                }
                setConfirmRemove(block.id);
              }}
            >
              <Trash2 className="size-[18px]" />
            </IconButton>
          ) : undefined
        }
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
            onReplace={() => {
              setMenuFor(null);
              setReplaceFor(menuBlock.id);
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={typeMenuFor != null}
        onClose={() => setTypeMenuFor(null)}
        title="Set options"
        // Picking a set type or deleting closes this; rating the effort does
        // not — an RPE is a value you may want to change your mind about.
        dismissLabel="Done"
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
            onDelete={() => {
              if (!typeMenuFor) return;
              dropSet(typeMenuFor.blockId, typeMenuFor.setId);
              setTypeMenuFor(null);
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={restBlock != null}
        onClose={() => setRestFor(null)}
        title={
          restSet
            ? `Rest after set ${setNumber(restBlock, restSet)}`
            : `Rest — ${restBlock?.name ?? ""}`
        }
        // The sheet no longer commits-and-closes on a tap: it holds a stepper,
        // chips and (for a finished set) a Start, so the footer is the way out.
        footer={
          restBlock ? (
            canStartRest && restSet ? (
              <Button
                block
                variant="volt"
                onClick={() => {
                  startRest(restSet.id, restResolved ?? 0);
                  setRestFor(null);
                }}
              >
                Start rest
              </Button>
            ) : (
              <Button
                block
                variant="solid"
                onClick={() => setRestFor(null)}
              >
                Done
              </Button>
            )
          ) : undefined
        }
      >
        {restBlock && (
          <RestOptions
            block={restBlock}
            set={restSet}
            defaultRestSeconds={defaultRestSeconds}
            onSetForSet={(seconds) => {
              if (!restSet) return;
              patchSet(restBlock.id, restSet.id, { restSeconds: seconds });
            }}
            onSetForExercise={(seconds) => {
              setRest(restBlock.id, seconds);
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={plateFor != null}
        onClose={() => setPlateFor(null)}
        title="Plate calculator"
        dismissLabel="Done"
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

      {/* Removing an exercise you have already worked is the one destructive
          thing on this screen with no undo, so it asks — but only then. */}
      <Sheet
        open={removeBlock != null}
        onClose={() => setConfirmRemove(null)}
        title={removeBlock ? `Remove ${removeBlock.name}?` : undefined}
      >
        {removeBlock && (
          <div className="px-4 pb-5">
            <p className="text-text-2 text-[14px] leading-relaxed">
              {removeCount}{" "}
              {removeCount === 1
                ? "logged set goes"
                : "logged sets go"}{" "}
              with it. This can&apos;t be undone.
            </p>
            <div className="mt-5 space-y-2">
              <Button
                block
                variant="danger"
                onClick={() => {
                  dropExercise(removeBlock.id);
                  setConfirmRemove(null);
                }}
              >
                <Trash2 className="size-4" />
                Remove exercise
              </Button>
              <Button
                block
                variant="ghost"
                onClick={() => setConfirmRemove(null)}
              >
                Keep it
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* The replacement is chosen but nothing is written yet: dismissing this
          sheet cancels it outright. */}
      <Sheet
        open={replaceAsk != null}
        onClose={() => setReplaceAsk(null)}
        title="Keep what you logged?"
      >
        {replaceAsk && (
          <div className="px-4 pb-5">
            <p className="text-text-2 text-[14px] leading-relaxed">
              {replaceAsk.count === 1
                ? "1 set here has a weight, reps or an effort rating."
                : `${replaceAsk.count} sets here have weights, reps or effort ratings.`}{" "}
              <span className="text-text-1 font-medium">{replaceAsk.name}</span>{" "}
              is tracked the same way, so they can carry across as they are —
              every set, including any you added yourself.
            </p>
            <div className="mt-5 space-y-2">
              <Button
                block
                variant="volt"
                onClick={() =>
                  swapExercise(
                    replaceAsk.blockId,
                    replaceAsk.exerciseId,
                    true,
                  )
                }
              >
                Keep my sets
              </Button>
              <Button
                block
                variant="solid"
                onClick={() =>
                  swapExercise(
                    replaceAsk.blockId,
                    replaceAsk.exerciseId,
                    false,
                  )
                }
              >
                Start fresh
              </Button>
            </div>
          </div>
        )}
      </Sheet>

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
              loading={discarding}
              onClick={async () => {
                if (discarding) return;
                setDiscarding(true);
                const res = await watchAction(discardWorkout(workout.id));
                if (!res.ok) {
                  // Still live, so nothing is torn down and nobody is sent
                  // to the feed as though it had worked.
                  setDiscarding(false);
                  return;
                }
                // The notification and the badge are claims about a live
                // session; only once the server agrees it is over do they go.
                endWorkoutActivity();
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
        // A rest still counting down when the session ended: the store is
        // module-level and persisted, so nothing else would ever clear it.
        onFinished={() => timer.stop()}
      />

      <Sheet
        open={reordering}
        onClose={closeReorder}
        title="Reorder exercises"
        // The rows own the vertical drag. Motion's drag lock goes to whichever
        // session starts first, and the panel's listener is native and on the
        // element while a row's runs through React — so the panel always won
        // and the row simply never moved.
        dragToDismiss={false}
        footer={
          <Button block variant="volt" onClick={closeReorder}>
            Done
          </Button>
        }
      >
        <ReorderList
          blocks={blocks}
          onChange={(ids) => {
            pendingOrder.current = ids;
          }}
        />
      </Sheet>
    </div>
  );
}

/**
 * The reorder view: just the names, short enough that the whole workout is on
 * screen at once. Dragging a full exercise block past three others on a phone
 * is miserable — the block is tall, the list scrolls under you, and the rows
 * you're aiming for are inputs.
 */
function ReorderList({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (ids: string[]) => void;
}) {
  // The drag lives here and nowhere else, so a hundred intermediate positions
  // re-render this list of names and not the workout behind it. Seeded on mount,
  // which is every time the sheet opens — `Sheet` unmounts its children when
  // closed — so it always starts from the committed order.
  const [order, setOrder] = useState(() => blocks.map((b) => b.id));
  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  return (
    <Reorder.Group
      axis="y"
      values={order}
      onReorder={(next: string[]) => {
        setOrder(next);
        onChange(next);
      }}
      // The grip is a <button>, so the press itself can't select — but a drag
      // that travels across the names below it paints a selection the same way
      // dragging across any text does.
      className="divide-hairline divide-y pb-2 select-none"
    >
      {order.map((id) => {
        const block = byId.get(id);
        return block ? <ReorderRow key={id} block={block} /> : null;
      })}
    </Reorder.Group>
  );
}

function ReorderRow({ block }: { block: Block }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      className="bg-bg flex items-center gap-3 px-4"
    >
      <button
        // The handle takes the drag, not the row: a row-wide listener would
        // swallow the flick that scrolls a list longer than the sheet.
        onPointerDown={(e) => {
          haptic.light();
          controls.start(e);
        }}
        aria-label={`Drag to reorder ${block.name}`}
        className="tap text-text-3 -ml-2 grid shrink-0 cursor-grab touch-none place-items-center px-2 active:cursor-grabbing"
      >
        <GripVertical className="size-[18px]" />
      </button>
      {block.supersetGroup && (
        <span className="text-volt border-volt/50 grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold">
          {block.supersetGroup}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate py-3 text-[15px] font-medium">
        {block.name}
      </span>
      <span className="num text-text-3 shrink-0 text-[12px]">
        {block.sets.length} set{block.sets.length === 1 ? "" : "s"}
      </span>
    </Reorder.Item>
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseBlock({
  block,
  unit,
  prFlash,
  flashSetId,
  stickyTop,
  weekSets,
  defaultRestSeconds,
  restingSetId,
  restingTotal,
  canReorder,
  onRequestReorder,
  onOpenMenu,
  onOpenPlate,
  onRunInterval,
  onEditRest,
  onOpenRestTimer,
  onPatchSet,
  onToggle,
  onDeleteSet,
  onAddSet,
  onOpenTypeMenu,
}: {
  block: Block;
  unit: "kg" | "lb";
  prFlash: string | null;
  /** A row just jumped to, tinted for a beat so the landing is obvious. */
  flashSetId: string | null;
  /** Height of the sticky workout header — where these columns come to rest. */
  stickyTop: number;
  /** Sets on this muscle over the last 7 days, this session included. */
  weekSets: number;
  /** The account default — the last stop in the rest fallback chain. */
  defaultRestSeconds: number;
  /** The set whose gap is currently counting down, if it's in this block. */
  restingSetId: string | null;
  /** That timer's full duration, for the strip's draining track. */
  restingTotal: number | null;
  /** A single exercise has no order to change — no gesture, no hint. */
  canReorder: boolean;
  onRequestReorder: () => void;
  onOpenMenu: () => void;
  onOpenPlate: (kg: number) => void;
  onRunInterval: () => void;
  /** Null targets the exercise as a whole rather than one set. */
  onEditRest: (setId: string | null) => void;
  /** Reveals the rest bar for the rest that is currently running. */
  onOpenRestTimer: () => void;
  onPatchSet: (
    setId: string,
    patch: Partial<SetDraft>,
    opts?: { fill?: boolean; local?: boolean },
  ) => void;
  onToggle: (set: SetDraft) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onOpenTypeMenu: (setId: string) => void;
}) {
  const reduce = useReducedMotion();
  // Last session's sets lined up like for like — warm-up to warm-up, working
  // set to working set — instead of by row index, which one extra warm-up
  // threw off for the whole exercise.
  const aligned = useMemo(
    () => alignPrevious(block.previous, block.sets),
    [block.previous, block.sets],
  );
  const longPress = useLongPress(onRequestReorder, { enabled: canReorder });
  const columns = setColumns(block.trackingType);
  // Deliberately `weight` and not `assist`: an assisted station is a selectorised
  // stack, so there are no plates to work out — and the number in that column is
  // the help coming off, which the calculator has no way to express.
  const showWeight = columns.includes("weight");

  /**
   * `overflow: hidden` and `position: sticky` can't both be on this section: an
   * ancestor that clips becomes the sticky element's scroll container, and the
   * column headers below would then stick to a box the size of their own
   * exercise — i.e. never move. The clip is only needed while the height is
   * animating, which is a block being added or removed, so it is applied for
   * exactly those moments: 260 ms after mount (one tick longer than the 200 ms
   * transition) and again for as long as this block is on its way out.
   */
  const present = useIsPresent();
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setEntering(false), 260);
    return () => window.clearTimeout(id);
  }, []);

  const isInterval =
    block.intervalWorkSeconds != null && block.intervalWorkSeconds > 0;

  // Warm-ups don't consume a set number, matching how lifters count.
  let workingIndex = 0;

  const heaviest = Math.max(
    0,
    ...block.sets.map((s) => (s.setType !== "warmup" ? (s.weightKg ?? 0) : 0)),
  );

  /** What this exercise rests for, before any per-set override. */
  const blockRest = block.restSeconds ?? defaultRestSeconds;

  return (
    // `data-block-id` is what scripts/check-authz.mjs fires the exercise-level
    // probes at, for the same reason `data-set-id` exists below.
    <motion.section
      // layout="position" and not plain layout: reordering should slide the
      // block, but a set being added inside it must not also resize-animate
      // the whole exercise — that reads as the page breathing.
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={LIST_TRANSITION}
      className={cn("mb-2", (entering || !present) && "overflow-hidden")}
      data-block-id={block.id}
    >
      <div
        {...longPress}
        // `data-block-title` is the row the header watches: once this has
        // scrolled under the header, the header names the exercise instead.
        data-block-title={block.id}
        // select-none so iOS doesn't raise its text-selection handles out of a
        // hold on the exercise name. The other thing a hold here used to raise
        // — Safari's link preview card for the `<Link>` below — is killed by
        // the inline style `useLongPress` spreads in. `data-holding` is the
        // hook saying a hold is being recognised: the row tints the same
        // neutral surface the jump flash uses — not volt, which on this screen
        // means a set completed or a rest running — and lets go when the sheet
        // opens or the finger moves.
        className="flex touch-pan-y items-center gap-2 px-4 pt-4 pb-2 transition-colors duration-150 select-none data-[holding]:bg-surface-2"
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
        {showWeight && heaviest > 0 && hasLoadablePlates(block.equipment) && (
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

      {/* Rest on the left, and on the right how much this muscle has had in the
          last seven days — the one number that changes what you'd do next and
          that you would otherwise have to leave the workout to look up. It
          counts this session's sets as they land, so it is never stale. */}
      <div className="text-text-3 flex items-center gap-3 px-4 pb-2 text-[12px]">
        {/* Always shown, including when it's inherited — it used to render only
            for an explicitly-set value, so an exercise on the default looked
            like an exercise with no rest at all. This is also the way to the
            exercise-wide setting: the number you can see is the number you tap
            to change. */}
        <button
          onClick={() => {
            haptic.light();
            onEditRest(null);
          }}
          aria-label={`Rest for every set of ${block.name}`}
          className="press -my-1 flex items-center gap-1.5 py-1"
        >
          <Clock
            className={cn(
              "size-3.5",
              block.restSeconds != null ? "text-volt" : "text-text-3",
            )}
            strokeWidth={2.2}
          />
          <span
            className={cn(
              "num",
              block.restSeconds != null ? "text-volt" : "text-text-3",
            )}
          >
            {blockRest === 0 ? "No rest" : `Rest ${formatDuration(blockRest)}`}
          </span>
        </button>
        {weekSets > 0 && (
          <span className="num ml-auto truncate">
            <span className="capitalize">{block.primaryMuscle}</span>{" "}
            <span className="text-text-2 font-semibold">
              {formatSetCount(weekSets)}
            </span>{" "}
            {weekSets === 1 ? "set" : "sets"} this week
          </span>
        )}
      </div>

      {/* Column headers — this is a data table, not a card list. Sticky, so a
          long exercise doesn't leave you reading a row of unlabelled numbers;
          they come to rest under the workout header and ride up with the block
          when the next exercise arrives. */}
      <div
        className="text-text-3 bg-bg sticky z-20 grid items-center gap-1.5 px-3 pt-1 pb-1 text-[10px] font-bold tracking-[0.08em] uppercase"
        style={{
          gridTemplateColumns: setGridTemplate(columns),
          top: stickyTop,
        }}
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
            // The gap after this set, shown in the flow of the table so uneven
            // rest is visible rather than buried in a sheet. Every working set
            // gets one, the last included — that rest runs too, it's just
            // followed by the next exercise instead of another row, and it would
            // otherwise be the one gap in the session with no way to change it.
            // Never after a warm-up: those start no timer, and naming a rest
            // that never runs would be a lie.
            const restAfter =
              set.setType !== "warmup"
                ? (set.restSeconds ?? block.restSeconds ?? defaultRestSeconds)
                : null;
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
                className="overflow-hidden"
              >
                {/* `data-set-id` is what scripts/check-authz.mjs fires B's
                    probes at — the set ids are otherwise only in the flight
                    payload — and what `useScrollWatch` and `jumpToSet` measure.
                    It wraps the row alone, not the row plus its rest strip: both
                    of those ask "where is the set I owe", and a box 40px taller
                    than the row would answer with the gap after it. */}
                <div data-set-id={set.id} className="relative">
                  <SetRow
                    set={set}
                    index={workingIndex}
                    unit={unit}
                    trackingType={block.trackingType}
                    previous={aligned[i] ?? null}
                    flash={flashSetId === set.id}
                    onPatch={(patch, opts) => onPatchSet(set.id, patch, opts)}
                    onToggleComplete={() => onToggle(set)}
                    onDelete={() => onDeleteSet(set.id)}
                    onOpenTypeMenu={() => onOpenTypeMenu(set.id)}
                  />
                  <AnimatePresence>
                    {prFlash === set.id && <PrBurst />}
                  </AnimatePresence>
                </div>
                {restAfter != null && (
                  <RestStrip
                    seconds={restAfter}
                    override={set.restSeconds != null}
                    completed={set.completed}
                    runningTotal={
                      restingSetId === set.id ? restingTotal : null
                    }
                    onEdit={() => onEditRest(set.id)}
                    onOpenTimer={() => onOpenRestTimer()}
                  />
                )}
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

/** Gold burst on a new record. Non-blocking — never interrupts the next set. */
function PrBurst() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: 8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING.pop}
      className="pointer-events-none absolute top-1/2 right-14 z-10 -translate-y-1/2"
    >
      <span className="bg-pr flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-[0.06em] text-black uppercase">
        PR
      </span>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */

/** Display number of a set among its exercise's working sets. */
function setNumber(block: Block | null, set: SetDraft) {
  if (!block) return 1;
  let n = 0;
  for (const s of block.sets) {
    if (s.setType !== "warmup") n++;
    if (s.id === set.id) break;
  }
  return Math.max(1, n);
}

/**
 * Rest, at whichever level the lifter came in at.
 *
 * One sheet with a scope rather than two sheets, because "90 seconds" and "for
 * which sets" are one decision. The scope defaults to the narrower option when
 * a set was tapped — a strip in the table is a statement about that gap — and
 * the wider one is a deliberate switch away from it.
 */
function RestOptions({
  block,
  set,
  defaultRestSeconds,
  onSetForSet,
  onSetForExercise,
}: {
  block: Block;
  /** Null when the exercise's own rest is being edited. */
  set: SetDraft | null;
  defaultRestSeconds: number;
  onSetForSet: (seconds: number | null) => void;
  onSetForExercise: (seconds: number | null) => void;
}) {
  const [scope, setScope] = useState<"set" | "exercise">(
    set ? "set" : "exercise",
  );
  const blockRest = block.restSeconds ?? defaultRestSeconds;

  // The scope being edited decides which value the stepper and chips write, and
  // what a blank (inherited) value falls back to for the concrete number the
  // stepper needs.
  const active =
    scope === "set" && set
      ? {
          value: set.restSeconds,
          inherited: blockRest,
          onChange: onSetForSet,
        }
      : {
          value: block.restSeconds,
          inherited: defaultRestSeconds,
          onChange: onSetForExercise,
        };
  const effective = active.value ?? active.inherited;

  return (
    <div className="px-4 pb-5">
      {set && (
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "set", label: "This set" },
            { value: "exercise", label: "Every set" },
          ]}
          className="mb-4"
        />
      )}

      {/* Type a number or nudge ±15s. Writing a concrete value here turns an
          inherited gap into an override, which is what "change it" means. */}
      <RestStepper seconds={effective} onChange={active.onChange} />

      {scope === "set" && set ? (
        <RestPicker
          value={set.restSeconds}
          inherited={blockRest}
          inheritLabel="the exercise"
          onChange={onSetForSet}
          idPrefix="set-rest"
          hint="This one gap only. Every other set keeps the exercise's rest."
        />
      ) : (
        <RestPicker
          value={block.restSeconds}
          inherited={defaultRestSeconds}
          inheritLabel="your default"
          onChange={onSetForExercise}
          idPrefix="exercise-rest"
          hint={
            <>
              Every set of {block.name} — and it clears any rest you had set on a
              single set.
            </>
          }
        />
      )}
    </div>
  );
}

/** Rest is 0–1800s everywhere it's written; keep typed and stepped values there. */
function clampRest(seconds: number) {
  return Math.max(0, Math.min(1800, Math.round(seconds)));
}

/**
 * Numeric + stepper editor for a rest duration, the half `RestPicker`'s chips
 * don't cover: an arbitrary value (95s), and dialing a preset up or down without
 * hunting for the right chip. It always shows a concrete number — an inherited
 * gap displays the value it resolves to and becomes an override on first change.
 */
function RestStepper({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const [text, setText] = useState(String(seconds));
  // Re-seed when the value changes from outside (a chip, a scope switch, a ±
  // tap) so the field never disagrees with the rest of the sheet. Done during
  // render, not in an effect: typing only updates local `text`, so `seconds` is
  // unchanged until a commit, and this fires exactly on the external changes.
  const [prevSeconds, setPrevSeconds] = useState(seconds);
  if (seconds !== prevSeconds) {
    setPrevSeconds(seconds);
    setText(String(seconds));
  }

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setText(String(seconds));
      return;
    }
    onChange(clampRest(n));
  };

  return (
    <div className="mb-4 flex items-center gap-2">
      <IconButton
        label="15 seconds less"
        variant="outline"
        onClick={() => onChange(clampRest(seconds - 15))}
      >
        <Minus className="size-4" strokeWidth={2.4} />
      </IconButton>
      <div className="relative flex-1">
        <input
          value={text}
          inputMode="numeric"
          aria-label="Rest seconds"
          onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit(e.currentTarget.value);
              e.currentTarget.blur();
            }
          }}
          className="num rounded-field bg-surface-2 text-text-1 focus-visible:ring-volt/60 h-11 w-full pr-9 text-center text-[16px] font-semibold outline-none focus-visible:ring-2"
        />
        <span className="text-text-3 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px]">
          sec
        </span>
      </div>
      <IconButton
        label="15 seconds more"
        variant="outline"
        onClick={() => onChange(clampRest(seconds + 15))}
      >
        <Plus className="size-4" strokeWidth={2.4} />
      </IconButton>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const SET_TYPES: [SetType, string, string][] = [
  ["normal", "Normal", "Counts toward volume and records"],
  ["warmup", "Warm-up", "Excluded from volume and records"],
  ["drop", "Drop set", "Performed straight after the previous set"],
  ["failure", "To failure", "Taken to muscular failure"],
];

function SetOptions({
  set,
  onSetType,
  onSetRpe,
  onDelete,
}: {
  set: SetDraft;
  onSetType: (type: SetType) => void;
  onSetRpe: (rpe: number | null) => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 pb-5">
      {/* Effort first. Set type is decided once — usually inherited from the
          routine — whereas the effort changes on every set, so it is the reason
          this sheet gets opened mid-session. It used to sit below the four type
          rows, far enough down that lifters reported the app had no RPE. */}
      <div className="hairline-b pb-5">
        <SheetLabel>
          <Gauge className="size-3.5" />
          Effort (RPE)
        </SheetLabel>
        <RpePicker
          value={set.rpe}
          onChange={onSetRpe}
          idPrefix="set-options"
          hint={
            set.targetRpe != null ? (
              <>
                The routine prescribed{" "}
                <span className="num text-text-2">
                  {prescribedToken(set.targetRpe)}
                </span>
                . Pick what it actually felt like — 10 is a set you couldn&apos;t
                have added a rep to.
              </>
            ) : undefined
          }
        />
      </div>

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

      {/* The swipe is the fast path, but it is a gesture: this is the one that
          works with the keyboard up, with gloves on, or after a mis-swipe. */}
      <div className="pt-5">
        <Button block variant="danger" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete set
        </Button>
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
  onReplace,
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
  onReplace: () => void;
}) {
  const [notes, setNotes] = useState(block.notes ?? "");
  // Commit on unmount too. The textarea only wrote on blur, and dismissing
  // the sheet by backdrop, Escape or the handle unmounts it without one —
  // the cue that was just typed simply went. Same shape as `NumberCell`.
  const notesRef = useRef(notes);
  const committedNotes = useRef(block.notes ?? "");
  const onSetNotesRef = useRef(onSetNotes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    onSetNotesRef.current = onSetNotes;
  }, [onSetNotes]);
  useEffect(
    () => () => {
      const trimmed = notesRef.current.trim();
      if (trimmed !== committedNotes.current.trim()) {
        onSetNotesRef.current(trimmed || null);
      }
    },
    [],
  );
  const intervalOn = block.intervalWorkSeconds != null;

  return (
    <div className="space-y-6 px-4 pb-5">
      <div>
        <SheetLabel>Rest timer</SheetLabel>
        {/* The shared picker, so this and the per-set sheet can't disagree about
            what the durations are or about what "no rest" means. The old row of
            chips here labelled `null` as "Off", which the workout screen read as
            "fall back to the default" — so turning rest off gave you the
            default rest. */}
        <RestPicker
          value={block.restSeconds}
          inherited={defaultRestSeconds}
          inheritLabel="your default"
          onChange={onSetRest}
          idPrefix="exercise-options-rest"
          hint="Every set of this exercise, unless a single set overrides it."
        />
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
        {canReorder && (
          <>
            <Button
              block
              variant="ghost"
              className="mt-2"
              onClick={onReorderAll}
            >
              <GripVertical className="size-4" strokeWidth={2.4} />
              Reorder all exercises
            </Button>
            {/* A long press is invisible otherwise. */}
            <p className="text-text-3 mt-1.5 text-center text-[12px]">
              Or hold an exercise name.
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

      {/* Only where the row has a seconds column to receive a round. On a
          squat the runner wrote `seconds` into a column the row can't show,
          and ticked sets with no weight and no reps — invisible, and worth
          nothing. */}
      {setColumns(block.trackingType).includes("seconds") && (
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
      )}

      <div>
        <SheetLabel>
          <StickyNote className="size-3.5" />
          Note
        </SheetLabel>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            committedNotes.current = notes;
            onSetNotes(notes.trim() || null);
          }}
          placeholder="Cues, machine settings, seat height…"
        />
      </div>

      <div className="space-y-2">
        <Button block variant="solid" onClick={onReplace}>
          <Repeat2 className="size-4" strokeWidth={2.4} />
          Replace exercise
        </Button>
        <p className="text-text-3 text-[12px] leading-snug">
          Keeps the sets and the rest timer. If you have logged anything here,
          you&apos;ll be asked whether it carries across.
        </p>
      </div>
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

type NextTarget = {
  block: Block;
  set: SetDraft;
  /** Display number among this exercise's working sets. */
  index: number;
  /** Index into `block.sets`; the previous set is aligned by `alignPrevious`. */
  position: number;
};

/** Which exercise the most recent completed set belongs to, if any. */
function lastWorkedBlock(workout: FullWorkout): string | null {
  let bestId: string | null = null;
  let bestAt = -Infinity;
  for (const e of workout.exercises) {
    for (const s of e.sets) {
      const at = s.completedAt ? s.completedAt.getTime() : null;
      if (at != null && at > bestAt) {
        bestAt = at;
        bestId = e.id;
      }
    }
  }
  return bestId;
}

/** The first unfinished set in one exercise, or null if it's done. */
function firstUnfinished(block: Block): NextTarget | null {
  let working = 0;
  for (let position = 0; position < block.sets.length; position++) {
    const set = block.sets[position];
    if (set.setType !== "warmup") working++;
    if (!set.completed) return { block, set, index: working, position };
  }
  return null;
}

/**
 * What to do next. Document order, except that a superset rotates: after a set
 * on the exercise `lastBlockId` names, the search starts at the *next* member
 * of its group and wraps, so A1 → A2 → A1 rather than A1 → A1 → A1. Falls
 * through to document order once the group is finished.
 */
function findNextTarget(blocks: Block[], lastBlockId: string | null) {
  const last = blocks.find((b) => b.id === lastBlockId);
  if (last?.supersetGroup) {
    const group = blocks.filter((b) => b.supersetGroup === last.supersetGroup);
    const from = group.indexOf(last);
    for (let i = 1; i <= group.length; i++) {
      const found = firstUnfinished(group[(from + i) % group.length]);
      if (found) return found;
    }
  }
  for (const block of blocks) {
    const found = firstUnfinished(block);
    if (found) return found;
  }
  return null;
}

/** Set counts carry a half for a secondary muscle, so they aren't integers. */
function formatSetCount(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "Set 3", or "Warm-up" — warm-ups don't carry a number anywhere else either. */
function setLabel(set: SetDraft, index: number) {
  return set.setType === "warmup" ? "Warm-up" : `Set ${index}`;
}

/**
 * The numbers to hit on a set that hasn't happened yet: what's already typed
 * into the row, falling back to what was done on this set last session — the
 * same two sources the row itself shows. Null when neither knows anything,
 * which is the first time a lift is ever performed.
 *
 * A prescribed effort is appended when the routine gave one. This is the most
 * useful place in the app for it: the rest bar, the jump pill and the
 * lock-screen line all read from here, and they are what someone looks at
 * between sets, which is exactly when "how hard should this one be" is the
 * question. Never a bare `@8` on its own though — an effort with no load or reps
 * beside it is not a set anyone can walk up to and do.
 */
function targetLabel(
  block: Block,
  set: SetDraft,
  position: number,
  unit: "kg" | "lb",
): string | null {
  const prev = alignPrevious(block.previous, block.sets)[position] ?? null;
  const weightKg = set.weightKg ?? prev?.weightKg ?? null;
  const reps = set.reps ?? prev?.reps ?? null;
  const seconds = set.seconds ?? prev?.seconds ?? null;
  const distanceM = set.distanceM ?? null;
  const columns = setColumns(block.trackingType);

  // The one combination lifters read as a single quantity, so it keeps the
  // "×" rather than being listed like unrelated fields.
  const effort = set.targetRpe != null ? ` ${prescribedToken(set.targetRpe)}` : "";

  // An assisted machine reads the same way — "−40 kg × 8" — because it is still
  // one quantity, and the minus is the only thing that keeps the counterweight
  // from being read as load on the line that tells you what to do next.
  const sign = columns.includes("assist") ? "−" : "";

  if (
    (columns.includes("weight") || columns.includes("assist")) &&
    columns.includes("reps") &&
    weightKg != null &&
    reps != null
  ) {
    return `${sign}${formatWeight(weightKg, unit)} ${unit} × ${reps}${effort}`;
  }

  const parts: string[] = [];
  for (const column of columns) {
    if ((column === "weight" || column === "assist") && weightKg != null) {
      parts.push(`${sign}${formatWeight(weightKg, unit)} ${unit}`);
    } else if (column === "reps" && reps != null) {
      parts.push(`${reps} reps`);
    } else if (column === "seconds" && seconds != null) {
      parts.push(formatDuration(seconds));
    } else if (column === "distance" && distanceM != null) {
      parts.push(`${distanceM} m`);
    }
  }
  return parts.length ? `${parts.join(" · ")}${effort}` : null;
}

/** The value fields a typed cell can carry down the rows below it. */
const FILLABLE = ["weightKg", "reps", "seconds", "distanceM"] as const;

/**
 * The sets a freshly typed value should be copied into: the unbroken run of
 * sets below it that have nothing in that column yet.
 *
 * Contiguous rather than "every empty set below" on purpose — the run is what
 * the user can see stopping. It halts at the first set that already carries a
 * number (that one was entered deliberately), at a completed set (it happened
 * as logged), and at a warm-up (a working weight is not a warm-up weight).
 */
function fillTargets(
  blocks: Block[],
  blockId: string,
  setId: string,
  patch: Partial<SetDraft>,
): string[] {
  const fields = FILLABLE.filter((f) => patch[f] != null);
  // A numeric cell commits exactly one field. Anything else — the "previous"
  // copy button, a set-type change — isn't a fill, and filling on a
  // multi-field patch could write one field over a value that isn't empty.
  if (fields.length !== 1) return [];
  const field = fields[0];

  const block = blocks.find((b) => b.id === blockId);
  const from = block?.sets.findIndex((s) => s.id === setId) ?? -1;
  if (!block || from < 0) return [];

  const ids: string[] = [];
  for (const s of block.sets.slice(from + 1)) {
    if (s.completed || s.setType === "warmup" || s[field] != null) break;
    ids.push(s.id);
  }
  return ids;
}

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
      targetRpe: s.targetRpe,
      restSeconds: s.restSeconds,
      completed: s.completedAt != null,
    })),
  };
}

export type { Block };
