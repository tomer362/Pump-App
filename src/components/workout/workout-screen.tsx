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

type ExerciseDraft = FullWorkout["exercises"][number] & { sets: never };

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
  previous: { weightKg: number | null; reps: number | null; seconds: number | null }[];
  sets: SetDraft[];
};

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
  const [reordering, setReordering] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
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
  const [prFlash, setPrFlash] = useState<string | null>(null);

  const bestByExercise = useRef(current1rm);

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
  const [supersetCue, setSupersetCue] = useState(false);

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
      if (ids.length > 1) void updateSets(ids, values);
      else void updateSet(setId, values);
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
      setSupersetCue(false);

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
          setSupersetCue(true);
          window.setTimeout(() => setSupersetCue(false), 7000);
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

  /**
   * Swap the movement on one block. The server clears the values logged
   * against the old exercise, so the local block is rebuilt from what it
   * returns rather than patched — anything kept here would be a number the
   * database no longer has.
   */
  const swapExercise = useCallback(
    async (blockId: string, exerciseId: string) => {
      dirty.current = true;
      setReplaceFor(null);
      const res = await replaceWorkoutExercise(blockId, exerciseId);
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
                sets: r.setIds.map((id, i) => ({
                  id,
                  position: i,
                  setType: b.sets[i]?.setType ?? ("normal" as SetType),
                  weightKg: null,
                  reps: null,
                  seconds: null,
                  distanceM: null,
                  rpe: null,
                  // The prescription went with the movement being replaced, same
                  // as on the server.
                  targetRpe: null,
                  restSeconds: null,
                  completed: false,
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
      void updateWorkoutMeta(workout.id, patch);
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
      dirty.current = true;
      const from = blocks.findIndex((b) => b.id === blockId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= blocks.length) return;

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
      void reorderWorkoutExercises(workout.id, ids);
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

  /* ---------------------------------------------------------------------- */
  /* Orientation while scrolling.                                            */
  /* ---------------------------------------------------------------------- */

  const reduce = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const [flashSetId, setFlashSetId] = useState<string | null>(null);

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
      setFlashSetId(setId);
      window.setTimeout(
        () => setFlashSetId((v) => (v === setId ? null : v)),
        1600,
      );
    },
    [reduce],
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
    restEndsAt: timer.state?.endsAt ?? null,
    restBody: nextUpLine,
    setsRemaining: totals.unfinished,
  });

  const menuBlock = blocks.find((b) => b.id === menuFor) ?? null;
  const replaceBlock = blocks.find((b) => b.id === replaceFor) ?? null;
  const restBlock = blocks.find((b) => b.id === restFor?.blockId) ?? null;
  const restSet =
    (restFor?.setId && restBlock?.sets.find((s) => s.id === restFor.setId)) ||
    null;
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
                  className="flex h-3 items-end gap-[2px]"
                >
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
                </button>
              )}
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
        state={timer.state}
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
        onStop={timer.stop}
        onAdjust={timer.adjust}
        onSetDuration={timer.setDuration}
      />

      {/* The way back to work. Once the set you owe has left the screen — you
          scrolled off to check a later lift, or to add one — this is the only
          thing on screen that knows where it went. It also shows for a few
          seconds after a superset set, on screen or not: that hand-off has no
          rest bar to name the partner. It stands down while the rest bar is up
          (which carries the same target, on its own row) and while the keyboard
          is up, where a docked pill would be buried. */}
      <AnimatePresence>
        {nextTarget &&
          (targetAway || supersetCue) &&
          !timer.state &&
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
        onConfirm={(ids) => {
          if (replaceBlock && ids[0]) swapExercise(replaceBlock.id, ids[0]);
        }}
      />

      <Sheet
        open={menuBlock != null}
        onClose={() => setMenuFor(null)}
        title={menuBlock?.name}
        // Every control in here writes as it is tapped, so nothing closed the
        // sheet but a gesture nobody had been shown.
        dismissLabel="Done"
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
            onRemove={() => dropExercise(menuBlock.id)}
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
      >
        {restBlock && (
          <RestOptions
            block={restBlock}
            set={restSet}
            defaultRestSeconds={defaultRestSeconds}
            onSetForSet={(seconds) => {
              if (!restSet) return;
              patchSet(restBlock.id, restSet.id, { restSeconds: seconds });
              setRestFor(null);
            }}
            onSetForExercise={(seconds) => {
              setRest(restBlock.id, seconds);
              setRestFor(null);
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
                // Before the round-trip: the notification and the badge are
                // claims about a live session, and this one is over either way.
                endWorkoutActivity();
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
        // the inline style `useLongPress` spreads in.
        className="flex touch-pan-y items-center gap-2 px-4 pt-4 pb-2 select-none"
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
                    previous={block.previous[i] ?? null}
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
                    runningTotal={
                      restingSetId === set.id ? restingTotal : null
                    }
                    onEdit={() => onEditRest(set.id)}
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
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(block.notes ?? "");
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

      <div className="space-y-2">
        <Button block variant="solid" onClick={onReplace}>
          <Repeat2 className="size-4" strokeWidth={2.4} />
          Replace exercise
        </Button>
        <p className="text-text-3 text-[12px] leading-snug">
          Keeps the sets and the rest timer. Anything already logged here is
          cleared — it was performed on a different movement.
        </p>

        <Button block variant="danger" onClick={onRemove}>
          <Trash2 className="size-4" />
          Remove exercise
        </Button>
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
  /** Index into `block.sets`, which is also the index into `block.previous`. */
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
  const prev = block.previous[position] ?? null;
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

export type { Block, ExerciseDraft };
