"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
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
  exerciseId: string,
) {
  const totals = await rollUpWorkout(tx, w.id);
  await recalculatePersonalRecords(tx, userId, [exerciseId]);
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
