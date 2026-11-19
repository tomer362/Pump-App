"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  coopParticipant,
  exercise,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { isUuid } from "@/lib/uuid";
import { recalculatePersonalRecords, type Tx } from "@/lib/records";
import { rollUpWorkout } from "@/lib/workout-rollup";
import { recordsSomething } from "@/lib/workout-totals";
import { estimate1RM } from "@/lib/utils";
import { rpeValue } from "@/lib/rpe";
import { isAssistedTracking } from "@/lib/tracking";
import type { ActionResult } from "./user";

/**
 * Correcting a finished workout from `/history/[id]`.
 *
 * `updateSet` refuses everything but RPE once `ended_at` is set, and that rule
 * stays: it is the mid-workout hot path, and a write still in flight when
 * Finish was tapped must not land on a finished session. What it guarded
 * against was never the edit itself but the counters going stale behind it —
 * `total_volume_kg`, `total_sets`, `total_reps`, `pr_count` and the personal
 * records are all derived from the rows. So these are a separate, deliberate
 * path that re-derives every one of them in the same transaction as the write:
 * `rollUpWorkout` for the workout's own totals, `recalculatePersonalRecords`
 * for the exercise (which also owns `pr_count`), and the co-op participant's
 * counters, which a finished room still shows.
 *
 * Each call locks the workout row first, so two edits from two tabs serialise
 * and the second roll-up sees the first one's set. Achievements are not
 * revoked: they were announced when earned, and an unlock is not a counter.
 */

const loggedSetSchema = z
  .object({
    weightKg: z.number().min(0).max(1000).nullable(),
    reps: z.number().int().min(0).max(1000).nullable(),
    seconds: z.number().int().min(0).max(86_400).nullable(),
    distanceM: z.number().min(0).max(1_000_000).nullable(),
    rpe: rpeValue.nullable(),
    setType: z.enum(["normal", "warmup", "drop", "failure"]),
    /** Performed, or planned and skipped. Only performed sets count. */
    done: z.boolean(),
  })
  .strict();

export type LoggedSetInput = z.input<typeof loggedSetSchema>;

const NOTHING_RECORDED =
  "A set has to record something — or mark it skipped";

/** Same rule as `updateSet`: no load, or assistance, means no estimate. */
function estimateFor(
  trackingType: string,
  weightKg: number | null,
  reps: number | null,
): number | null {
  return weightKg != null &&
    reps != null &&
    weightKg > 0 &&
    reps > 0 &&
    !isAssistedTracking(trackingType)
    ? estimate1RM(weightKg, reps)
    : null;
}

/** Totals, records and the co-op row, re-derived after a write. */
async function rederive(
  tx: Tx,
  userId: string,
  w: { id: string; coopSessionId: string | null },
  exerciseIds: string | string[],
) {
  const totals = await rollUpWorkout(tx, w.id);
  await recalculatePersonalRecords(
    tx,
    userId,
    [...new Set(typeof exerciseIds === "string" ? [exerciseIds] : exerciseIds)],
  );
  if (w.coopSessionId) {
    await tx
      .update(coopParticipant)
      .set({
        setsCompleted: totals.totalSets,
        volumeKg: totals.totalVolumeKg,
      })
      .where(eq(coopParticipant.workoutId, w.id));
  }
}

/** Serialise edits to one workout — see the module comment. */
async function lockWorkout(tx: Tx, workoutId: string) {
  await tx.execute(
    sql`SELECT id FROM workout WHERE id = ${workoutId}::uuid FOR UPDATE`,
  );
}

/** A set of a *finished* workout the caller owns, with what editing needs. */
async function ownedFinishedSet(userId: string, setId: string) {
  const [row] = await db
    .select({
      set: workoutSet,
      workoutId: workout.id,
      endedAt: workout.endedAt,
      coopSessionId: workout.coopSessionId,
      exerciseId: workoutExercise.exerciseId,
      trackingType: exercise.trackingType,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(and(eq(workoutSet.id, setId), eq(workout.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Rewrite one logged set of a finished workout: its values, its type, its
 * rating, and whether it was performed at all.
 */
export async function editLoggedSet(
  setId: string,
  input: LoggedSetInput,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(setId)) return { ok: false, error: "Set not found" };

  const parsed = loggedSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid set values" };
  const v = parsed.data;
  if (v.done && !recordsSomething(v)) {
    return { ok: false, error: NOTHING_RECORDED };
  }

  const row = await ownedFinishedSet(me.id, setId);
  if (!row) return { ok: false, error: "Set not found" };
  // A live session is the workout screen's to edit, through `updateSet`.
  if (!row.endedAt) return { ok: false, error: "That workout is still running" };
  const endedAt = row.endedAt;

  await db.transaction(async (tx) => {
    await lockWorkout(tx, row.workoutId);
    await tx
      .update(workoutSet)
      .set({
        weightKg: v.weightKg,
        reps: v.reps,
        seconds: v.seconds,
        distanceM: v.distanceM,
        // An effort rating on a set you didn't do is a contradiction.
        rpe: v.done ? v.rpe : null,
        setType: v.setType,
        // A set marked performed after the fact keeps its tick time if it had
        // one, and otherwise takes the finish — inside the session's window,
        // which is where the PR badge on this page looks for records.
        completedAt: v.done ? (row.set.completedAt ?? endedAt) : null,
        estimated1rm: estimateFor(row.trackingType, v.weightKg, v.reps),
      })
      .where(eq(workoutSet.id, setId));
    await rederive(
      tx,
      me.id,
      { id: row.workoutId, coopSessionId: row.coopSessionId },
      row.exerciseId,
    );
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** A set you did and forgot to log, appended to an exercise of a finished workout. */
export async function addLoggedSet(
  workoutExerciseId: string,
  input: Omit<LoggedSetInput, "done">,
): Promise<ActionResult<{ setId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(workoutExerciseId)) return { ok: false, error: "Not found" };

  const parsed = loggedSetSchema.omit({ done: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid set values" };
  const v = parsed.data;
  if (!recordsSomething(v)) return { ok: false, error: NOTHING_RECORDED };

  const [row] = await db
    .select({
      workoutId: workout.id,
      endedAt: workout.endedAt,
      coopSessionId: workout.coopSessionId,
      exerciseId: workoutExercise.exerciseId,
      trackingType: exercise.trackingType,
    })
    .from(workoutExercise)
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(
      and(
        eq(workoutExercise.id, workoutExerciseId),
        eq(workout.userId, me.id),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "Not found" };
  if (!row.endedAt) return { ok: false, error: "That workout is still running" };
  const endedAt = row.endedAt;

  const setId = await db.transaction(async (tx) => {
    await lockWorkout(tx, row.workoutId);
    const [s] = await tx
      .insert(workoutSet)
      .values({
        workoutExerciseId,
        position: sql`(
          SELECT COALESCE(MAX(position), -1) + 1 FROM workout_set
          WHERE workout_exercise_id = ${workoutExerciseId}::uuid
        )`,
        setType: v.setType,
        weightKg: v.weightKg,
        reps: v.reps,
        seconds: v.seconds,
        distanceM: v.distanceM,
        rpe: v.rpe,
        completedAt: endedAt,
        estimated1rm: estimateFor(row.trackingType, v.weightKg, v.reps),
      })
      .returning({ id: workoutSet.id });
    await rederive(
      tx,
      me.id,
      { id: row.workoutId, coopSessionId: row.coopSessionId },
      row.exerciseId,
    );
    return s.id;
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { setId } };
}

/**
 * Remove one set from a finished workout. The last set of the workout is
 * refused: a finished session with nothing in it is what `finishWorkout`
 * refuses to create, and deleting the workout is the honest way to say it.
 */
export async function deleteLoggedSet(setId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(setId)) return { ok: false, error: "Set not found" };

  const row = await ownedFinishedSet(me.id, setId);
  if (!row) return { ok: false, error: "Set not found" };
  if (!row.endedAt) return { ok: false, error: "That workout is still running" };

  const outcome = await db.transaction(async (tx) => {
    await lockWorkout(tx, row.workoutId);
    const [count] = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(workoutSet)
      .innerJoin(
        workoutExercise,
        eq(workoutExercise.id, workoutSet.workoutExerciseId),
      )
      .where(eq(workoutExercise.workoutId, row.workoutId));
    if ((count?.n ?? 0) <= 1) return "last" as const;

    const weId = row.set.workoutExerciseId;
    await tx.delete(workoutSet).where(eq(workoutSet.id, setId));
    // An exercise left with no sets would render as a heading over nothing.
    const [left] = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, weId));
    if ((left?.n ?? 0) === 0) {
      await tx.delete(workoutExercise).where(eq(workoutExercise.id, weId));
    } else {
      // Same windowed renumber as `removeSet`, so positions stay 0..n-1.
      await tx.execute(sql`
        UPDATE workout_set ws
        SET position = ranked.rn
        FROM (
          SELECT id, (ROW_NUMBER() OVER (ORDER BY position) - 1) AS rn
          FROM workout_set
          WHERE workout_exercise_id = ${weId}::uuid
        ) ranked
        WHERE ws.id = ranked.id AND ws.position <> ranked.rn
      `);
    }
    await rederive(
      tx,
      me.id,
      { id: row.workoutId, coopSessionId: row.coopSessionId },
      row.exerciseId,
    );
    return "deleted" as const;
  });

  if (outcome === "last") {
    return {
      ok: false,
      error: "That's the workout's only set — delete the workout instead",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* The workout itself, and its exercises                                       */
/* -------------------------------------------------------------------------- */

/** A finished workout the caller owns. */
async function ownedFinishedWorkout(userId: string, workoutId: string) {
  const [w] = await db
    .select({
      id: workout.id,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      coopSessionId: workout.coopSessionId,
    })
    .from(workout)
    .where(and(eq(workout.id, workoutId), eq(workout.userId, userId)))
    .limit(1);
  return w ?? null;
}

/** A block of a finished workout the caller owns, with its exercise. */
async function ownedFinishedBlock(userId: string, workoutExerciseId: string) {
  const [row] = await db
    .select({
      we: workoutExercise,
      endedAt: workout.endedAt,
      coopSessionId: workout.coopSessionId,
      trackingType: exercise.trackingType,
    })
    .from(workoutExercise)
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(
      and(
        eq(workoutExercise.id, workoutExerciseId),
        eq(workout.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * An exercise the caller may log against — exactly the picker's scope:
 * built-ins plus their own live customs. An archived or someone else's id
 * resolves to nothing.
 */
async function pickableExercise(userId: string, exerciseId: string) {
  const [ex] = await db
    .select({ id: exercise.id, trackingType: exercise.trackingType })
    .from(exercise)
    .where(
      and(
        eq(exercise.id, exerciseId),
        isNull(exercise.archivedAt),
        or(isNull(exercise.ownerId), eq(exercise.ownerId, userId)),
      ),
    )
    .limit(1);
  return ex ?? null;
}

/** Every exercise a workout holds — what a change of date can re-rank. */
async function exerciseIdsOf(tx: Tx, workoutId: string) {
  const rows = await tx
    .select({ id: workoutExercise.exerciseId })
    .from(workoutExercise)
    .where(eq(workoutExercise.workoutId, workoutId));
  return rows.map((r) => r.id);
}

const MAX_DURATION_MIN = 24 * 60;

const detailsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    note: z.string().trim().max(1000).nullable(),
    /** An instant, as `Date#toISOString()` writes it. */
    startedAt: z.string().datetime(),
    durationMinutes: z.number().int().min(1).max(MAX_DURATION_MIN),
  })
  .strict();

export type WorkoutDetailsInput = z.input<typeof detailsSchema>;

/**
 * Rename, re-note, re-date or re-time a finished workout.
 *
 * A date is not cosmetic. A record's `achieved_at` is its workout's
 * `ended_at`, ties between equal bests go to the earliest session, and the
 * page's PR badge looks for records inside the session's window — so moving a
 * workout re-ranks every exercise in it, and the sets' tick times move with it
 * by the same offset (clamped into the new window when the session shrinks).
 * Without that shift, a session moved to last month would still hold sets
 * "completed" today, and "N sets this week" would count them here.
 */
export async function editWorkoutDetails(
  workoutId: string,
  input: WorkoutDetailsInput,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(workoutId)) return { ok: false, error: "Workout not found" };

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid values" };
  const v = parsed.data;

  const w = await ownedFinishedWorkout(me.id, workoutId);
  if (!w) return { ok: false, error: "Workout not found" };
  if (!w.endedAt) return { ok: false, error: "That workout is still running" };

  const startedAt = new Date(v.startedAt);
  const endedAt = new Date(startedAt.getTime() + v.durationMinutes * 60_000);
  // A minute of slack for a clock that runs a little ahead of the server's.
  if (endedAt.getTime() > Date.now() + 60_000) {
    return { ok: false, error: "A finished workout can't end in the future" };
  }

  const delta = startedAt.getTime() - w.startedAt.getTime();
  const moved = delta !== 0 || endedAt.getTime() !== w.endedAt.getTime();

  await db.transaction(async (tx) => {
    await lockWorkout(tx, workoutId);
    await tx
      .update(workout)
      .set({
        name: v.name,
        note: v.note || null,
        startedAt,
        endedAt,
        durationSeconds: v.durationMinutes * 60,
      })
      .where(eq(workout.id, workoutId));
    if (!moved) return;

    // ISO strings cast to `timestamp`, which drops the zone: the stored value
    // is the UTC clock, the same thing drizzle writes. A bare Date parameter
    // would go through the driver's local-time serialiser instead.
    await tx.execute(sql`
      UPDATE workout_set ws
      SET completed_at = LEAST(
        GREATEST(
          ws.completed_at + (${delta}::bigint * INTERVAL '1 millisecond'),
          ${startedAt.toISOString()}::timestamp
        ),
        ${endedAt.toISOString()}::timestamp
      )
      FROM workout_exercise we
      WHERE we.id = ws.workout_exercise_id
        AND we.workout_id = ${workoutId}::uuid
        AND ws.completed_at IS NOT NULL
    `);
    await recalculatePersonalRecords(
      tx,
      me.id,
      [...new Set(await exerciseIdsOf(tx, workoutId))],
    );
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * An exercise you did and forgot to log, added to a finished workout with its
 * first set. Never empty: an exercise with no sets would render as a heading
 * over nothing, which is why deleting a block's last set removes the block.
 */
export async function addLoggedExercise(
  workoutId: string,
  exerciseId: string,
  input: Omit<LoggedSetInput, "done">,
): Promise<ActionResult<{ workoutExerciseId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(workoutId)) return { ok: false, error: "Workout not found" };
  if (!isUuid(exerciseId)) return { ok: false, error: "Exercise not found" };

  const parsed = loggedSetSchema.omit({ done: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid set values" };
  const v = parsed.data;
  if (!recordsSomething(v)) return { ok: false, error: NOTHING_RECORDED };

  const w = await ownedFinishedWorkout(me.id, workoutId);
  if (!w) return { ok: false, error: "Workout not found" };
  if (!w.endedAt) return { ok: false, error: "That workout is still running" };
  const endedAt = w.endedAt;

  const ex = await pickableExercise(me.id, exerciseId);
  if (!ex) return { ok: false, error: "Exercise not found" };

  const weId = await db.transaction(async (tx) => {
    await lockWorkout(tx, workoutId);
    const [we] = await tx
      .insert(workoutExercise)
      .values({
        workoutId,
        exerciseId: ex.id,
        position: sql`(
          SELECT COALESCE(MAX(position), -1) + 1 FROM workout_exercise
          WHERE workout_id = ${workoutId}::uuid
        )`,
      })
      .returning({ id: workoutExercise.id });
    await tx.insert(workoutSet).values({
      workoutExerciseId: we.id,
      position: 0,
      setType: v.setType,
      weightKg: v.weightKg,
      reps: v.reps,
      seconds: v.seconds,
      distanceM: v.distanceM,
      rpe: v.rpe,
      completedAt: endedAt,
      estimated1rm: estimateFor(ex.trackingType, v.weightKg, v.reps),
    });
    await rederive(tx, me.id, w, ex.id);
    return we.id;
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { workoutExerciseId: weId } };
}

/**
 * Logged the sets against the wrong exercise: move them onto the right one.
 *
 * Only between exercises measured the same way. The values are kept — that is
 * the whole point, the sets happened — and across a change of tracking type
 * they would either sit in columns the new exercise doesn't have or, for
 * `assist_reps`, silently flip meaning. Both exercises' records are rebuilt:
 * the old one loses these sets, the new one gains them.
 */
export async function replaceLoggedExercise(
  workoutExerciseId: string,
  exerciseId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(workoutExerciseId)) return { ok: false, error: "Not found" };
  if (!isUuid(exerciseId)) return { ok: false, error: "Exercise not found" };

  const row = await ownedFinishedBlock(me.id, workoutExerciseId);
  if (!row) return { ok: false, error: "Not found" };
  if (!row.endedAt) return { ok: false, error: "That workout is still running" };

  const ex = await pickableExercise(me.id, exerciseId);
  if (!ex) return { ok: false, error: "Exercise not found" };
  if (ex.id === row.we.exerciseId) return { ok: true };
  if (ex.trackingType !== row.trackingType) {
    return {
      ok: false,
      error: "Pick an exercise measured the same way — these sets would lose their values",
    };
  }

  await db.transaction(async (tx) => {
    await lockWorkout(tx, row.we.workoutId);
    await tx
      .update(workoutExercise)
      .set({
        exerciseId: ex.id,
        // Cues and interval settings belong to the old movement.
        notes: null,
        intervalWorkSeconds: null,
        intervalRestSeconds: null,
      })
      .where(eq(workoutExercise.id, workoutExerciseId));
    // `estimated1rm` stands: weight, reps and tracking type are unchanged.
    await rederive(
      tx,
      me.id,
      { id: row.we.workoutId, coopSessionId: row.coopSessionId },
      [row.we.exerciseId, ex.id],
    );
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Remove an exercise and every set under it from a finished workout. The
 * workout's only exercise is refused, for the same reason as its only set.
 */
export async function removeLoggedExercise(
  workoutExerciseId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(workoutExerciseId)) return { ok: false, error: "Not found" };

  const row = await ownedFinishedBlock(me.id, workoutExerciseId);
  if (!row) return { ok: false, error: "Not found" };
  if (!row.endedAt) return { ok: false, error: "That workout is still running" };
  const workoutId = row.we.workoutId;

  const outcome = await db.transaction(async (tx) => {
    await lockWorkout(tx, workoutId);
    const [count] = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(workoutExercise)
      .where(eq(workoutExercise.workoutId, workoutId));
    if ((count?.n ?? 0) <= 1) return "last" as const;

    // Sets cascade with the block.
    await tx
      .delete(workoutExercise)
      .where(eq(workoutExercise.id, workoutExerciseId));
    await renumberBlocks(tx, workoutId);
    await rederive(
      tx,
      me.id,
      { id: workoutId, coopSessionId: row.coopSessionId },
      row.we.exerciseId,
    );
    return "deleted" as const;
  });

  if (outcome === "last") {
    return {
      ok: false,
      error: "That's the workout's only exercise — delete the workout instead",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Swap a block with its neighbour. Order scores nothing, so no re-derive. */
export async function moveLoggedExercise(
  workoutExerciseId: string,
  direction: -1 | 1,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isUuid(workoutExerciseId)) return { ok: false, error: "Not found" };
  if (direction !== -1 && direction !== 1) {
    return { ok: false, error: "Invalid move" };
  }

  const row = await ownedFinishedBlock(me.id, workoutExerciseId);
  if (!row) return { ok: false, error: "Not found" };
  if (!row.endedAt) return { ok: false, error: "That workout is still running" };
  const workoutId = row.we.workoutId;

  await db.transaction(async (tx) => {
    await lockWorkout(tx, workoutId);
    // Normalise first, so a gap left by an older delete can't make the
    // neighbour "position ± 1" miss.
    await renumberBlocks(tx, workoutId);
    const [self] = await tx
      .select({ position: workoutExercise.position })
      .from(workoutExercise)
      .where(eq(workoutExercise.id, workoutExerciseId));
    const target = self.position + direction;
    const [neighbour] = await tx
      .select({ id: workoutExercise.id })
      .from(workoutExercise)
      .where(
        and(
          eq(workoutExercise.workoutId, workoutId),
          eq(workoutExercise.position, target),
        ),
      );
    // Already first, or already last.
    if (!neighbour) return;
    await tx
      .update(workoutExercise)
      .set({ position: target })
      .where(eq(workoutExercise.id, workoutExerciseId));
    await tx
      .update(workoutExercise)
      .set({ position: self.position })
      .where(eq(workoutExercise.id, neighbour.id));
  });

  revalidatePath(`/history/${workoutId}`);
  return { ok: true };
}

/** Positions back to 0..n-1, the same windowed renumber sets use. */
async function renumberBlocks(tx: Tx, workoutId: string) {
  await tx.execute(sql`
    UPDATE workout_exercise we
    SET position = ranked.rn
    FROM (
      SELECT id, (ROW_NUMBER() OVER (ORDER BY position, id) - 1) AS rn
      FROM workout_exercise
      WHERE workout_id = ${workoutId}::uuid
    ) ranked
    WHERE we.id = ranked.id AND we.position <> ranked.rn
  `);
}
