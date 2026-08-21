"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
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
import { dayKeyBounds, dayKeyToNoonUtc, isDayKey, shiftDay } from "@/lib/day";
import { estimate1RM } from "@/lib/utils";
import { rpeValue } from "@/lib/rpe";
import { isAssistedTracking } from "@/lib/tracking";
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
 *
 * A set can also be dated. That splits the session-reuse rule in two, and the
 * split is the non-obvious part: **today** keeps the 12-hour rolling window, so
 * a late-night session doesn't fork across midnight, while a **backdated** log
 * is scoped to the calendar day — there is nothing rolling about a day three
 * weeks ago, and the window would match nothing anyway. Both branches are a
 * half-open range on the raw `started_at`, so `workout_user_kind_started_idx`
 * still does the work; `DATE(started_at) = $1` would force a filter and re-open
 * the very question of which zone `DATE` means.
 *
 * Which day counts as "today" is the *caller's*, from a client-supplied UTC
 * offset. Without it, a user at UTC+13 asking for their own today would be
 * refused for logging in the future. The offset gates that comparison and
 * nothing else — it is never stored, and never reaches a timestamp.
 */

/** How long consecutive quick logs keep landing in the same session. */
const QUICK_LOG_WINDOW_HOURS = 12;

/** Far enough back for anything real; short enough that a typo'd year fails. */
const MAX_BACKDATE_DAYS = 365;

// Not exported: every export of a "use server" module is a public POST
// endpoint, so the file exports actions and types only.
const QUICK_LOG_NAME = "Quick log";

const quickLogSchema = z.object({
  exerciseId: z.string().uuid(),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  seconds: z.number().int().min(0).max(86_400).nullable().optional(),
  distanceM: z.number().min(0).max(1_000_000).nullable().optional(),
  // The scale itself: the only caller is `RpePicker` in the quick-log sheet, so
  // an off-grid value is a bug rather than an intent to honour.
  rpe: rpeValue.nullable().optional(),
  /**
   * The calendar day the set happened on, in the caller's local time. A day
   * rather than an instant: the sheet only ever asks for a date.
   */
  date: z.string().refine(isDayKey).nullable().optional(),
  /** Only decides which day is "today" for this caller. Never stored. */
  tzOffsetMinutes: z.number().int().min(-840).max(840).nullable().optional(),
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

  // `getTimezoneOffset()` counts minutes *behind* UTC, so local = UTC - offset.
  // Clamped in the schema: the offset is client-supplied, and the worst it can
  // buy is ~14 hours of slack on the caller's own data.
  const offset = values.tzOffsetMinutes ?? 0;
  const today = new Date(Date.now() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
  const day = values.date ?? today;

  // ISO day keys compare correctly as strings, so the guard needs no date math.
  if (day > today) {
    return { ok: false, error: "You can't log a set in the future" };
  }
  if (day < shiftDay(today, -MAX_BACKDATE_DAYS)) {
    return { ok: false, error: "That's too far back to log" };
  }
  const backdated = day !== today;

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
      trackingType: exercise.trackingType,
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
  // On an assisted machine the weight column is the counterweight, so there is
  // no 1RM in it and no PR to fire — the badge would celebrate needing more
  // help. `recalculatePersonalRecords` below applies the same rule to the
  // stored records.
  const estimated1rm =
    weightKg != null &&
    reps != null &&
    weightKg > 0 &&
    reps > 0 &&
    !isAssistedTracking(ex.trackingType)
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

  // Picking today is byte-for-byte what shipped before this field existed.
  const at = backdated ? dayKeyToNoonUtc(day) : new Date();

  const result = await db.transaction(async (tx) => {
    // One session per window rather than one workout per set: history stays
    // readable and the training calendar sees a single day. For today that is a
    // rolling window rather than a calendar day, because `started_at` is
    // timezone-naive server time and the user's midnight is unknown. A
    // backdated log has no such ambiguity — it was given a day, so it is scoped
    // to that day. Both branches are sargable ranges on `started_at`.
    const bounds = dayKeyBounds(day);
    const sameSession = backdated
      ? and(
          gte(workout.startedAt, bounds.start),
          lt(workout.startedAt, bounds.end),
        )
      : sql`${workout.startedAt} > NOW() - (${QUICK_LOG_WINDOW_HOURS} || ' hours')::interval`;

    // Scoped to `kind`, so a day that already holds a real session still gets
    // its own "Quick log" row — appending to a finished workout would rewrite
    // counters that screen owns.
    const [existing] = await tx
      .select({ id: workout.id })
      .from(workout)
      .where(
        and(
          eq(workout.userId, me.id),
          eq(workout.kind, "quick_log"),
          isNotNull(workout.endedAt),
          sameSession,
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
          startedAt: at,
          // Inserted already ended, backdated or not. `durationSeconds` stays
          // 0 — nobody spent time in a session that never ran, and lifetime
          // "Time" would lie.
          endedAt: at,
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
        completedAt: at,
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
      completedAt: at.toISOString(),
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
      // Volume has to know which weight columns are assistance rather than load.
      trackingType: exercise.trackingType,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(eq(workoutExercise.workoutId, workoutId));

  await tx
    .update(workout)
    .set(sumSetTotals(sets))
    .where(eq(workout.id, workoutId));
}
