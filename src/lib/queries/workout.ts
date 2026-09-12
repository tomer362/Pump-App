import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  personalRecord,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";

export type ActiveWorkoutSummary = {
  id: string;
  name: string;
  startedAt: Date;
  completedSets: number;
};

/**
 * The in-progress workout, if any. A user has at most one — starting a new one
 * while another is open is blocked in the action layer.
 */
async function getActiveWorkoutSummaryUncached(
  userId: string,
): Promise<ActiveWorkoutSummary | null> {
  // Raw SQL rather than a drizzle correlated subquery: inside a single-table
  // select, `${workout.id}` renders unqualified as "id", which the subquery
  // then resolves against its own FROM instead of the outer row.
  const res = await db.execute<{
    id: string;
    name: string;
    started_at: Date;
    completed_sets: number;
  }>(sql`
    SELECT
      w.id,
      w.name,
      w.started_at,
      (
        SELECT COUNT(*)::int
        FROM workout_set ws
        JOIN workout_exercise we ON we.id = ws.workout_exercise_id
        WHERE we.workout_id = w.id AND ws.completed_at IS NOT NULL
      ) AS completed_sets
    FROM workout w
    WHERE w.user_id = ${userId} AND w.ended_at IS NULL
    ORDER BY w.started_at DESC
    LIMIT 1
  `);

  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    startedAt: new Date(row.started_at),
    completedSets: row.completed_sets,
  };
}

export type WorkoutSetRow = {
  id: string;
  position: number;
  setType: "normal" | "warmup" | "drop" | "failure";
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  /** What it felt like, rated by the lifter. */
  rpe: number | null;
  /** What the routine prescribed, snapshotted at start. Never a rating. */
  targetRpe: number | null;
  /** Rest after this set, overriding the exercise. Null inherits. */
  restSeconds: number | null;
  completedAt: Date | null;
  estimated1rm: number | null;
};

export type WorkoutExerciseRow = {
  id: string;
  exerciseId: string;
  position: number;
  notes: string | null;
  restSeconds: number | null;
  supersetGroup: string | null;
  intervalWorkSeconds: number | null;
  intervalRestSeconds: number | null;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  sets: WorkoutSetRow[];
  /** The same exercise's sets from the previous session — the "Previous" column. */
  previous: PreviousSet[];
};

export type PreviousSet = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  /** So this session's rows can be matched like for like — see `alignPrevious`. */
  setType: string;
};

export type FullWorkout = {
  id: string;
  userId: string;
  name: string;
  note: string | null;
  photoUrl: string | null;
  startedAt: Date;
  endedAt: Date | null;
  loadMultiplier: number;
  routineId: string | null;
  gymId: string | null;
  coopSessionId: string | null;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  durationSeconds: number;
  prCount: number;
  exercises: WorkoutExerciseRow[];
};

/**
 * A workout with its exercises and sets, plus the "Previous" values that make
 * logging one tap. Deliberately 3 queries rather than a nested join so the
 * result doesn't fan out rows × sets.
 */
export async function getFullWorkout(
  workoutId: string,
): Promise<FullWorkout | null> {
  const [w] = await db
    .select()
    .from(workout)
    .where(eq(workout.id, workoutId))
    .limit(1);
  if (!w) return null;

  const wes = await db
    .select({
      id: workoutExercise.id,
      exerciseId: workoutExercise.exerciseId,
      position: workoutExercise.position,
      notes: workoutExercise.notes,
      restSeconds: workoutExercise.restSeconds,
      supersetGroup: workoutExercise.supersetGroup,
      intervalWorkSeconds: workoutExercise.intervalWorkSeconds,
      intervalRestSeconds: workoutExercise.intervalRestSeconds,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType,
    })
    .from(workoutExercise)
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(eq(workoutExercise.workoutId, workoutId))
    .orderBy(workoutExercise.position);

  const weIds = wes.map((r) => r.id);
  const sets = weIds.length
    ? await db
        .select()
        .from(workoutSet)
        .where(inArray(workoutSet.workoutExerciseId, weIds))
        .orderBy(workoutSet.position)
    : [];

  const previous = await getPreviousSets(
    w.userId,
    workoutId,
    wes.map((r) => r.exerciseId),
  );

  const byWe = new Map<string, WorkoutSetRow[]>();
  for (const s of sets) {
    const list = byWe.get(s.workoutExerciseId) ?? [];
    list.push({
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
      completedAt: s.completedAt,
      estimated1rm: s.estimated1rm,
    });
    byWe.set(s.workoutExerciseId, list);
  }

  return {
    id: w.id,
    userId: w.userId,
    name: w.name,
    note: w.note,
    photoUrl: w.photoUrl,
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    loadMultiplier: w.loadMultiplier,
    routineId: w.routineId,
    gymId: w.gymId,
    coopSessionId: w.coopSessionId,
    totalVolumeKg: w.totalVolumeKg,
    totalSets: w.totalSets,
    totalReps: w.totalReps,
    durationSeconds: w.durationSeconds,
    prCount: w.prCount,
    exercises: wes.map((r) => ({
      ...r,
      sets: byWe.get(r.id) ?? [],
      previous: previous.get(r.exerciseId) ?? [],
    })),
  };
}

/**
 * For each exercise, the completed sets from the most recent *other* finished
 * workout that contained it. This is Strong's "Previous" column: it pre-fills
 * the inputs so a normal set is a single tap on the checkmark.
 */
export async function getPreviousSets(
  userId: string,
  excludeWorkoutId: string | null,
  exerciseIds: string[],
): Promise<Map<string, PreviousSet[]>> {
  const out = new Map<string, PreviousSet[]>();
  if (!exerciseIds.length) return out;

  // Rank each exercise's past sets by how recent their workout was, then keep
  // only the most recent workout per exercise.
  const rows = await db.execute<{
    exercise_id: string;
    weight_kg: number | null;
    reps: number | null;
    seconds: number | null;
    distance_m: number | null;
    set_type: string;
    position: number;
  }>(sql`
    WITH ranked AS (
      SELECT
        we.exercise_id,
        ws.weight_kg,
        ws.reps,
        ws.seconds,
        ws.distance_m,
        ws.set_type,
        ws.position,
        DENSE_RANK() OVER (
          PARTITION BY we.exercise_id ORDER BY w.started_at DESC
        ) AS rk
      FROM ${workoutSet} ws
      JOIN ${workoutExercise} we ON we.id = ws.workout_exercise_id
      JOIN ${workout} w ON w.id = we.workout_id
      WHERE w.user_id = ${userId}
        AND w.ended_at IS NOT NULL
        AND ws.completed_at IS NOT NULL
        AND we.exercise_id IN (${sql.join(
          exerciseIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
        ${excludeWorkoutId ? sql`AND w.id <> ${excludeWorkoutId}` : sql``}
    )
    SELECT exercise_id, weight_kg, reps, seconds, distance_m, set_type, position
    FROM ranked WHERE rk = 1
    ORDER BY exercise_id, position
  `);

  for (const r of rows.rows) {
    const list = out.get(r.exercise_id) ?? [];
    list.push({
      weightKg: r.weight_kg,
      reps: r.reps,
      seconds: r.seconds,
      distanceM: r.distance_m,
      setType: r.set_type,
    });
    out.set(r.exercise_id, list);
  }
  return out;
}

/** Finished workouts, newest first — the History tab and profile. */
/** Same shape as the feed's: the timestamp alone ties and skips rows. */
export type HistoryCursor = { at: Date; id: string };

export async function getWorkoutHistory(
  userId: string,
  { limit = 20, before }: { limit?: number; before?: HistoryCursor } = {},
) {
  return db
    .select({
      id: workout.id,
      name: workout.name,
      note: workout.note,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      durationSeconds: workout.durationSeconds,
      totalVolumeKg: workout.totalVolumeKg,
      totalSets: workout.totalSets,
      prCount: workout.prCount,
    })
    .from(workout)
    .where(
      and(
        eq(workout.userId, userId),
        isNotNull(workout.endedAt),
        before
          ? sql`(${workout.startedAt}, ${workout.id}) < (${before.at}, ${before.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(workout.startedAt), desc(workout.id))
    .limit(limit);
}

/** Records for the profile and exercise-detail screens. */
export async function getPersonalRecords(
  userId: string,
  exerciseId?: string,
  limit = 500,
) {
  return db
    .select({
      id: personalRecord.id,
      exerciseId: personalRecord.exerciseId,
      kind: personalRecord.kind,
      value: personalRecord.value,
      weightKg: personalRecord.weightKg,
      reps: personalRecord.reps,
      achievedAt: personalRecord.achievedAt,
      exerciseName: exercise.name,
    })
    .from(personalRecord)
    .innerJoin(exercise, eq(exercise.id, personalRecord.exerciseId))
    .where(
      and(
        eq(personalRecord.userId, userId),
        exerciseId ? eq(personalRecord.exerciseId, exerciseId) : undefined,
      ),
    )
    .orderBy(desc(personalRecord.achievedAt))
    .limit(limit);
}

/** Dates of finished workouts in a window — drives the streak + calendar. */

/**
 * Per-request deduped: the `(app)` layout's chrome asks this on every
 * navigation, and `/start`, `/routines` and `/routines/[id]` ask again for
 * their own render — two identical queries against a scale-to-zero database
 * for one page.
 */
export const getActiveWorkoutSummary = cache(getActiveWorkoutSummaryUncached);
