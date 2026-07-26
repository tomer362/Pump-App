import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  personalRecord,
  workout,
  workoutExercise,
  workoutSet,
  type Equipment,
  type Muscle,
} from "@/lib/db/schema";

export type ExerciseListItem = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  isCustom: boolean;
  /** Last time this user logged it — powers the "Recent" ordering. */
  lastPerformedAt: Date | null;
};

/**
 * The exercise picker. Built-ins plus this user's own, ordered by what they
 * actually use — recency beats alphabetical when you're mid-workout.
 */
export async function searchExercises(
  userId: string,
  {
    query,
    muscle,
    equipment,
    limit = 200,
  }: {
    query?: string;
    muscle?: Muscle | "all";
    equipment?: Equipment | "all";
    limit?: number;
  } = {},
): Promise<ExerciseListItem[]> {
  const rows = await db
    .select({
      id: exercise.id,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType,
      ownerId: exercise.ownerId,
      // The outer column must be written qualified: this select has no joins,
      // so drizzle renders `${exercise.id}` as a bare "id", which the subquery
      // would resolve against its own FROM rather than the outer row.
      lastPerformedAt: sql<string | Date | null>`(
        SELECT MAX(w.started_at) FROM ${workout} w
        JOIN ${workoutExercise} we ON we.workout_id = w.id
        WHERE we.exercise_id = ${sql.raw('"exercise"."id"')} AND w.user_id = ${userId}
      )`,
    })
    .from(exercise)
    .where(
      and(
        or(isNull(exercise.ownerId), eq(exercise.ownerId, userId)),
        query && query.trim()
          ? ilike(exercise.name, `%${query.trim()}%`)
          : undefined,
        muscle && muscle !== "all"
          ? eq(exercise.primaryMuscle, muscle)
          : undefined,
        equipment && equipment !== "all"
          ? eq(exercise.equipment, equipment)
          : undefined,
      ),
    )
    .orderBy(asc(exercise.name))
    .limit(limit);

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      primaryMuscle: r.primaryMuscle,
      equipment: r.equipment,
      trackingType: r.trackingType,
      isCustom: r.ownerId != null,
      // Drizzle has no column definition to decode a raw `sql` fragment
      // against, so this arrives as whatever the driver produced — normalise
      // rather than assume it is already a Date.
      lastPerformedAt: r.lastPerformedAt ? new Date(r.lastPerformedAt) : null,
    }))
    .sort((a, b) => {
      // Recently-used first, then never-used alphabetically.
      if (a.lastPerformedAt && b.lastPerformedAt) {
        return b.lastPerformedAt.getTime() - a.lastPerformedAt.getTime();
      }
      if (a.lastPerformedAt) return -1;
      if (b.lastPerformedAt) return 1;
      return a.name.localeCompare(b.name);
    });
}

export async function getExercise(id: string) {
  const [row] = await db
    .select()
    .from(exercise)
    .where(eq(exercise.id, id))
    .limit(1);
  return row ?? null;
}

export type ExerciseHistoryPoint = {
  workoutId: string;
  date: Date;
  bestWeightKg: number | null;
  bestEst1rm: number | null;
  totalVolumeKg: number;
  sets: { weightKg: number | null; reps: number | null; setType: string }[];
};

/** Per-session history for one exercise — the chart + log on exercise detail. */
export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  limit = 30,
): Promise<ExerciseHistoryPoint[]> {
  const rows = await db
    .select({
      workoutId: workout.id,
      date: workout.startedAt,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      setType: workoutSet.setType,
      est: workoutSet.estimated1rm,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(
      and(
        eq(workout.userId, userId),
        eq(workoutExercise.exerciseId, exerciseId),
        sql`${workout.endedAt} IS NOT NULL`,
        sql`${workoutSet.completedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(workout.startedAt), asc(workoutSet.position));

  const byWorkout = new Map<string, ExerciseHistoryPoint>();
  for (const r of rows) {
    let point = byWorkout.get(r.workoutId);
    if (!point) {
      point = {
        workoutId: r.workoutId,
        date: r.date,
        bestWeightKg: null,
        bestEst1rm: null,
        totalVolumeKg: 0,
        sets: [],
      };
      byWorkout.set(r.workoutId, point);
    }
    point.sets.push({ weightKg: r.weightKg, reps: r.reps, setType: r.setType });
    if (r.setType !== "warmup") {
      point.totalVolumeKg += (r.weightKg ?? 0) * (r.reps ?? 0);
      if (r.weightKg != null && (point.bestWeightKg ?? -1) < r.weightKg) {
        point.bestWeightKg = r.weightKg;
      }
      if (r.est != null && (point.bestEst1rm ?? -1) < r.est) {
        point.bestEst1rm = r.est;
      }
    }
  }

  return [...byWorkout.values()].slice(0, limit);
}

export async function getExerciseRecords(userId: string, exerciseId: string) {
  return db
    .select()
    .from(personalRecord)
    .where(
      and(
        eq(personalRecord.userId, userId),
        eq(personalRecord.exerciseId, exerciseId),
      ),
    );
}

/** Current 1RM records keyed by exercise — lets the workout screen flag PRs live. */
export async function getCurrent1rmRecords(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, number>> {
  if (!exerciseIds.length) return {};
  const rows = await db
    .select({
      exerciseId: personalRecord.exerciseId,
      value: personalRecord.value,
    })
    .from(personalRecord)
    .where(
      and(
        eq(personalRecord.userId, userId),
        eq(personalRecord.kind, "1rm"),
        inArray(personalRecord.exerciseId, exerciseIds),
      ),
    );
  return Object.fromEntries(rows.map((r) => [r.exerciseId, r.value]));
}
