"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  exercise,
  personalRecord,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getLastLoggedSet, type LastLoggedSet } from "@/lib/queries/exercise";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
import { recalculatePersonalRecords } from "@/lib/records";
import { recordsSomething, sumSetTotals } from "@/lib/workout-totals";
import { estimate1RM } from "@/lib/utils";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

/**
 * Log one set against one exercise, without starting a workout.
 *
 * The rest of the app can only write a set into a *running* workout, and
 * nothing counts until that workout is finished — every stats and records query
 * filters `workout.ended_at IS NOT NULL AND workout_set.completed_at IS NOT
 * NULL`. So "I did one heavy single today" used to cost six screens: start,
 * freestyle, add exercise, type, tick, finish.
 *
 * This writes into a workout that is inserted *already ended*, which is what
 * makes the set count the instant it is saved — in volume, in the muscle chart,
 * in the exercise's own history and, via `recalculatePersonalRecords`, in
 * records. It is safe against `workout_one_active_idx` because that unique
 * index is scoped `WHERE ended_at IS NULL`; a quick-log session is never active
 * and so never blocks (or is blocked by) a real one.
 */

/** How long consecutive quick logs keep landing in the same session. */
const QUICK_LOG_WINDOW_HOURS = 12;

// Not exported: every export of a "use server" module is a public POST
// endpoint, so the file exports actions and types only.
const QUICK_LOG_NAME = "Quick log";

const quickLogSchema = z.object({
  exerciseId: z.string().uuid(),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  seconds: z.number().int().min(0).max(86_400).nullable().optional(),
  distanceM: z.number().min(0).max(1_000_000).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
});

export type QuickLogInput = z.input<typeof quickLogSchema>;

export type QuickLogResult = {
  workoutId: string;
  setId: string;
  completedAt: string;
  weightKg: number | null;
  reps: number | null;
  estimated1rm: number | null;
  /** A new estimated-1RM best. Drives the gold badge, never colour alone. */
  isPr: boolean;
  /** Sets in this quick-log session so far, including the one just written. */
  setsLoggedInSession: number;
};

export async function quickLogSet(
  input: QuickLogInput,
): Promise<ActionResult<QuickLogResult>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = quickLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid set values" };
  const values = parsed.data;

  // Same rule the workout screen applies when promoting a planned set: an
  // empty row is not a performance.
  if (
    !recordsSomething({
      reps: values.reps ?? null,
      seconds: values.seconds ?? null,
      distanceM: values.distanceM ?? null,
    })
  ) {
    return { ok: false, error: "Enter what you actually did" };
  }

  const limited = await rateLimit(me.id, "quick_log", {
    limit: 120,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  // Authorisation lives in the action, not only in the page that renders the
  // control: every export of a "use server" module is a public POST endpoint.
  // Mirrors the notFound() rules on /exercises/[id].
  const [ex] = await db
    .select({
      id: exercise.id,
      ownerId: exercise.ownerId,
      archivedAt: exercise.archivedAt,
    })
    .from(exercise)
    .where(eq(exercise.id, values.exerciseId))
    .limit(1);
  if (!ex) return { ok: false, error: "Exercise not found" };
  if (ex.ownerId && ex.ownerId !== me.id) {
    return { ok: false, error: "Exercise not found" };
  }
  if (ex.archivedAt) return { ok: false, error: "That exercise is archived" };

  const weightKg = values.weightKg ?? null;
  const reps = values.reps ?? null;
  const estimated1rm =
    weightKg != null && reps != null && weightKg > 0 && reps > 0
      ? estimate1RM(weightKg, reps)
      : null;

  // Read the standing record before the write, so "is this a PR" is answered
  // against what the user had walking into the set.
  const [previousBest] = await db
    .select({ value: personalRecord.value })
    .from(personalRecord)
    .where(
      and(
        eq(personalRecord.userId, me.id),
        eq(personalRecord.exerciseId, ex.id),
        eq(personalRecord.kind, "1rm"),
      ),
    )
    .limit(1);

  const isPr =
    estimated1rm != null &&
    (!previousBest || estimated1rm > previousBest.value + 0.01);

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    // One session per rolling window rather than one workout per set: history
    // stays readable and the training calendar sees a single day. A rolling
    // window, not a calendar day, because `started_at` is timezone-naive server
    // time and the user's midnight is unknown.
    const [existing] = await tx
      .select({ id: workout.id })
      .from(workout)
      .where(
        and(
          eq(workout.userId, me.id),
          eq(workout.kind, "quick_log"),
          isNotNull(workout.endedAt),
          sql`${workout.startedAt} > NOW() - (${QUICK_LOG_WINDOW_HOURS} || ' hours')::interval`,
        ),
      )
      .orderBy(desc(workout.startedAt))
      .limit(1);

    let workoutId: string;
    if (existing) {
      workoutId = existing.id;
    } else {
      const [created] = await tx
        .insert(workout)
        .values({
          userId: me.id,
          name: QUICK_LOG_NAME,
          kind: "quick_log",
          gymId: me.homeGymId,
          startedAt: now,
          // Inserted already ended. `durationSeconds` stays 0 — nobody spent
          // time in a session that never ran, and lifetime "Time" would lie.
          endedAt: now,
          durationSeconds: 0,
        })
        .returning({ id: workout.id });
      workoutId = created.id;
    }

    // Reuse the exercise's slot if it is already in this session, so five sets
    // of the same lift read as one block rather than five.
    const [existingWe] = await tx
      .select({ id: workoutExercise.id })
      .from(workoutExercise)
      .where(
        and(
          eq(workoutExercise.workoutId, workoutId),
          eq(workoutExercise.exerciseId, ex.id),
        ),
      )
      .limit(1);

    let workoutExerciseId: string;
    if (existingWe) {
      workoutExerciseId = existingWe.id;
    } else {
      const [{ next }] = await tx
        .select({
          next: sql<number>`COALESCE(MAX(${workoutExercise.position}) + 1, 0)`,
        })
        .from(workoutExercise)
        .where(eq(workoutExercise.workoutId, workoutId));
      const [createdWe] = await tx
        .insert(workoutExercise)
        .values({
          workoutId,
          exerciseId: ex.id,
          position: Number(next),
        })
        .returning({ id: workoutExercise.id });
      workoutExerciseId = createdWe.id;
    }

    const [{ nextSet }] = await tx
      .select({
        nextSet: sql<number>`COALESCE(MAX(${workoutSet.position}) + 1, 0)`,
      })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, workoutExerciseId));

    const [created] = await tx
      .insert(workoutSet)
      .values({
        workoutExerciseId,
        position: Number(nextSet),
        setType: "normal",
        weightKg,
        reps,
        seconds: values.seconds ?? null,
        distanceM: values.distanceM ?? null,
        rpe: values.rpe ?? null,
        completedAt: now,
        estimated1rm,
      })
      .returning({ id: workoutSet.id });

    await rollUpWorkout(tx, workoutId);

    // A full re-derive rather than finishWorkout's compare-and-upsert: this is
    // an append to an already-finished workout, and the same call is what makes
    // undoing a quick log restore the previous record. It also owns
    // `workout.pr_count`, so nothing here writes that column by hand.
    await recalculatePersonalRecords(tx, me.id, [ex.id]);

    const [{ count }] = await tx
      .select({ count: sql<number>`COUNT(*)` })
      .from(workoutSet)
      .innerJoin(
        workoutExercise,
        eq(workoutExercise.id, workoutSet.workoutExerciseId),
      )
      .where(eq(workoutExercise.workoutId, workoutId));

    return { workoutId, setId: created.id, setsLoggedInSession: Number(count) };
  });

  // Everything downstream of a logged set is server-rendered: the exercise's
  // charts, the stats totals, the history list.
  revalidatePath("/", "layout");

  return {
    ok: true,
    data: {
      ...result,
      completedAt: now.toISOString(),
      weightKg,
      reps,
      estimated1rm,
      isPr,
    },
  };
}

/**
 * What to prefill a quick-log sheet with, for a control that isn't on the
 * exercise's own page and so has no server-rendered prefill to hand.
 *
 * Scoped to the caller in both directions: the last set is read for `me`, and
 * an exercise belonging to someone else is refused rather than confirmed to
 * exist.
 */
export async function getQuickLogPrefill(
  exerciseId: string,
): Promise<ActionResult<QuickLogPrefill>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!z.string().uuid().safeParse(exerciseId).success) {
    return { ok: false, error: "Exercise not found" };
  }

  const [ex] = await db
    .select({
      id: exercise.id,
      ownerId: exercise.ownerId,
      archivedAt: exercise.archivedAt,
      trackingType: exercise.trackingType,
      name: exercise.name,
    })
    .from(exercise)
    .where(eq(exercise.id, exerciseId))
    .limit(1);
  if (!ex || (ex.ownerId && ex.ownerId !== me.id) || ex.archivedAt) {
    return { ok: false, error: "Exercise not found" };
  }

  const last = await getLastLoggedSet(me.id, ex.id);
  const active = await getActiveWorkoutSummary(me.id);

  return {
    ok: true,
    data: {
      name: ex.name,
      trackingType: ex.trackingType,
      last,
      activeWorkoutId: active?.id ?? null,
    },
  };
}

export type QuickLogPrefill = {
  name: string;
  trackingType: string;
  last: LastLoggedSet | null;
  activeWorkoutId: string | null;
};

/**
 * Undo the set a quick log just wrote.
 *
 * Not `removeSet`: that one presumes a live workout and leaves the finished
 * workout's denormalised counters and records untouched, which here would leave
 * a phantom PR and inflated volume behind.
 */
export async function undoQuickLogSet(setId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const [row] = await db
    .select({
      setId: workoutSet.id,
      workoutId: workout.id,
      exerciseId: workoutExercise.exerciseId,
      kind: workout.kind,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(and(eq(workoutSet.id, setId), eq(workout.userId, me.id)))
    .limit(1);
  if (!row) return { ok: false, error: "Set not found" };
  // Deliberately scoped to quick logs. Undoing a set inside a real session is
  // the workout screen's job, and it has state this doesn't know about.
  if (row.kind !== "quick_log") {
    return { ok: false, error: "That set isn't a quick log" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(workoutSet).where(eq(workoutSet.id, row.setId));
    await rollUpWorkout(tx, row.workoutId);
    await recalculatePersonalRecords(tx, me.id, [row.exerciseId]);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Rewrite a workout's denormalised counters from the sets it currently has. */
async function rollUpWorkout(tx: Tx, workoutId: string) {
  const sets = await tx
    .select({
      setType: workoutSet.setType,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      completedAt: workoutSet.completedAt,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .where(eq(workoutExercise.workoutId, workoutId));

  await tx
    .update(workout)
    .set(sumSetTotals(sets))
    .where(eq(workout.id, workoutId));
}
