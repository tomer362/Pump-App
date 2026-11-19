import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  personalRecord,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import type { ExportRecordRow, ExportSetRow } from "@/lib/history-export";

/**
 * Far above any real history (a lifter logging 25 sets a day for five years is
 * ~45 000) and low enough that serialising it stays well inside a function's
 * ~30 s budget. Read one past it so "too many" is detectable without a COUNT.
 */
export const EXPORT_SET_CAP = 60_000;

/**
 * Every set a user has logged in a **finished** workout, oldest first, in the
 * order the workout screen shows them. One joined read, because on a
 * scale-to-zero database each round trip after a cold start is the expensive
 * part. A live session is excluded for the same reason it is excluded from
 * every stats query: nothing counts until the workout is finished.
 *
 * Scoped by `workout.user_id` alone — that is the whole authorisation, so a
 * caller passing someone else's exercise id gets only their own sets of it,
 * which is to say none.
 */
export async function getHistoryExportRows(
  userId: string,
  exerciseId?: string,
): Promise<{ rows: ExportSetRow[]; truncated: boolean }> {
  const rows = await db
    .select({
      workoutKey: workout.id,
      workoutExerciseKey: workoutExercise.id,
      workoutName: workout.name,
      workoutKind: workout.kind,
      workoutNote: workout.note,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      durationSeconds: workout.durationSeconds,
      loadMultiplier: workout.loadMultiplier,
      totalVolumeKg: workout.totalVolumeKg,
      totalSets: workout.totalSets,
      totalReps: workout.totalReps,
      prCount: workout.prCount,
      exerciseName: exercise.name,
      exerciseSlug: exercise.slug,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType,
      exerciseNotes: workoutExercise.notes,
      setType: workoutSet.setType,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      seconds: workoutSet.seconds,
      distanceM: workoutSet.distanceM,
      rpe: workoutSet.rpe,
      targetRpe: workoutSet.targetRpe,
      completedAt: workoutSet.completedAt,
      estimated1rm: workoutSet.estimated1rm,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(
      and(
        eq(workout.userId, userId),
        isNotNull(workout.endedAt),
        exerciseId ? eq(workoutExercise.exerciseId, exerciseId) : undefined,
      ),
    )
    .orderBy(
      asc(workout.startedAt),
      asc(workout.id),
      asc(workoutExercise.position),
      asc(workoutExercise.id),
      asc(workoutSet.position),
      asc(workoutSet.id),
    )
    .limit(EXPORT_SET_CAP + 1);

  const truncated = rows.length > EXPORT_SET_CAP;
  return { rows: truncated ? rows.slice(0, EXPORT_SET_CAP) : rows, truncated };
}

/** The user's current personal records, optionally for one exercise. */
export async function getHistoryExportRecords(
  userId: string,
  exerciseId?: string,
): Promise<ExportRecordRow[]> {
  return db
    .select({
      exerciseName: exercise.name,
      exerciseSlug: exercise.slug,
      kind: personalRecord.kind,
      value: personalRecord.value,
      weightKg: personalRecord.weightKg,
      reps: personalRecord.reps,
      achievedAt: personalRecord.achievedAt,
    })
    .from(personalRecord)
    .innerJoin(exercise, eq(exercise.id, personalRecord.exerciseId))
    .where(
      and(
        eq(personalRecord.userId, userId),
        exerciseId ? eq(personalRecord.exerciseId, exerciseId) : undefined,
      ),
    )
    .orderBy(asc(exercise.name), asc(personalRecord.kind));
}
