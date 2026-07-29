import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  exerciseAlternative,
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
  isArchived: boolean;
  /** Last time this user logged it — powers the "Recent" ordering. */
  lastPerformedAt: Date | null;
};

/**
 * Which slice of the library to return.
 * - `available` — built-ins plus this user's live custom entries (every picker)
 * - `mine`      — only this user's live custom entries
 * - `archived`  — only this user's archived custom entries
 */
export type ExerciseScope = "available" | "mine" | "archived";

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
    // The built-in library is a few hundred entries plus whatever the user has
    // added, and the result is re-sorted in JS after the SQL orders by name —
    // so a limit below the library size truncates silently and arbitrarily.
    limit = 500,
    // The manage view needs to reach archived entries; nothing that feeds a
    // picker ever should.
    scope = "available",
  }: {
    query?: string;
    muscle?: Muscle | "all";
    equipment?: Equipment | "all";
    limit?: number;
    scope?: ExerciseScope;
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
      archivedAt: exercise.archivedAt,
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
        scope === "mine" || scope === "archived"
          ? eq(exercise.ownerId, userId)
          : or(isNull(exercise.ownerId), eq(exercise.ownerId, userId)),
        scope === "archived"
          ? sql`${exercise.archivedAt} IS NOT NULL`
          : isNull(exercise.archivedAt),
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
      isArchived: r.archivedAt != null,
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

export type ExerciseAlternativeItem = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  /** How this one's effect on the body differs from the exercise you're on. */
  note: string;
};

/**
 * Curated "try this instead" list for one exercise.
 *
 * Only ever resolves to built-ins. The ownerId filter is defensive rather than
 * necessary today — nothing writes user-authored alternatives — but it means
 * this surface could never leak another user's custom exercise name if that
 * ever changed.
 */
export async function getExerciseAlternatives(
  exerciseId: string,
): Promise<ExerciseAlternativeItem[]> {
  return db
    .select({
      id: exercise.id,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      note: exerciseAlternative.note,
    })
    .from(exerciseAlternative)
    .innerJoin(exercise, eq(exercise.id, exerciseAlternative.alternativeId))
    .where(
      and(eq(exerciseAlternative.exerciseId, exerciseId), isNull(exercise.ownerId)),
    )
    .orderBy(asc(exerciseAlternative.position), asc(exercise.name));
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

export type ExerciseSessionPoint = {
  workoutId: string;
  date: Date;
  topWeightKg: number | null;
  bestEst1rm: number | null;
  volumeKg: number;
  reps: number;
  sets: number;
};

/**
 * One row per completed session of this exercise, oldest first — the series
 * behind every chart on the detail screen.
 *
 * Aggregated in SQL rather than by grouping set rows in JS: the charts only
 * ever need per-session figures, and a lifter with three years of history has
 * thousands of sets but only a few hundred sessions. `getExerciseHistory`
 * still returns set-level detail, because the History tab prints every set.
 *
 * Warm-ups are excluded throughout, matching `recalculatePersonalRecords`.
 */
export async function getExerciseSessionSeries(
  userId: string,
  exerciseId: string,
): Promise<ExerciseSessionPoint[]> {
  const res = await db.execute<{
    workout_id: string;
    date: string | Date;
    top_weight: number | null;
    best_e1rm: number | null;
    volume: number;
    reps: number;
    sets: number;
  }>(sql`
    SELECT
      w.id                                                    AS workout_id,
      w.started_at                                            AS date,
      MAX(ws.weight_kg)                                       AS top_weight,
      MAX(ws.estimated_1rm)                                   AS best_e1rm,
      COALESCE(SUM(COALESCE(ws.weight_kg, 0)
                 * COALESCE(ws.reps, 0)), 0)::real            AS volume,
      COALESCE(SUM(COALESCE(ws.reps, 0)), 0)::int             AS reps,
      COUNT(*)::int                                           AS sets
    FROM workout_set ws
    JOIN workout_exercise we ON we.id = ws.workout_exercise_id
    JOIN workout w           ON w.id = we.workout_id
    WHERE w.user_id = ${userId}
      AND we.exercise_id = ${exerciseId}::uuid
      AND w.ended_at IS NOT NULL
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
    GROUP BY w.id, w.started_at
    ORDER BY w.started_at ASC
  `);

  return res.rows.map((r) => ({
    workoutId: r.workout_id,
    date: new Date(r.date),
    topWeightKg: r.top_weight,
    bestEst1rm: r.best_e1rm,
    volumeKg: r.volume,
    reps: r.reps,
    sets: r.sets,
  }));
}

export type RepMax = {
  reps: number;
  weightKg: number;
  /** Epley estimate for this weight × reps, so rows are comparable. */
  estimated1rm: number;
  achievedAt: Date;
  workoutId: string;
};

/**
 * Heaviest weight ever lifted at each rep count, 1–12.
 *
 * The "best performance at each rep" table: two lifters with the same 1RM can
 * have very different rep strength, and it's the row you actually pick a
 * working weight from.
 */
export async function getExerciseRepMaxes(
  userId: string,
  exerciseId: string,
  maxReps = 12,
): Promise<RepMax[]> {
  const res = await db.execute<{
    reps: number;
    weight_kg: number;
    estimated_1rm: number | null;
    achieved_at: string | Date;
    workout_id: string;
  }>(sql`
    SELECT DISTINCT ON (ws.reps)
      ws.reps,
      ws.weight_kg,
      ws.estimated_1rm,
      w.started_at AS achieved_at,
      w.id         AS workout_id
    FROM workout_set ws
    JOIN workout_exercise we ON we.id = ws.workout_exercise_id
    JOIN workout w           ON w.id = we.workout_id
    WHERE w.user_id = ${userId}
      AND we.exercise_id = ${exerciseId}::uuid
      AND w.ended_at IS NOT NULL
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
      AND ws.reps BETWEEN 1 AND ${maxReps}
      AND COALESCE(ws.weight_kg, 0) > 0
    ORDER BY ws.reps ASC, ws.weight_kg DESC, w.started_at ASC
  `);

  return res.rows.map((r) => ({
    reps: r.reps,
    weightKg: r.weight_kg,
    estimated1rm: r.estimated_1rm ?? r.weight_kg * (1 + r.reps / 30),
    achievedAt: new Date(r.achieved_at),
    workoutId: r.workout_id,
  }));
}

export type ExerciseSummary = {
  sessions: number;
  sets: number;
  reps: number;
  volumeKg: number;
  firstPerformedAt: Date | null;
  lastPerformedAt: Date | null;
};

/** The header figures on the exercise detail screen. */
export async function getExerciseSummary(
  userId: string,
  exerciseId: string,
): Promise<ExerciseSummary> {
  const res = await db.execute<{
    sessions: number;
    sets: number;
    reps: number;
    volume: number;
    first_at: string | Date | null;
    last_at: string | Date | null;
  }>(sql`
    SELECT
      COUNT(DISTINCT w.id)::int                              AS sessions,
      COUNT(ws.id)::int                                      AS sets,
      COALESCE(SUM(COALESCE(ws.reps, 0)), 0)::int            AS reps,
      COALESCE(SUM(COALESCE(ws.weight_kg, 0)
                 * COALESCE(ws.reps, 0)), 0)::real           AS volume,
      MIN(w.started_at)                                      AS first_at,
      MAX(w.started_at)                                      AS last_at
    FROM workout_set ws
    JOIN workout_exercise we ON we.id = ws.workout_exercise_id
    JOIN workout w           ON w.id = we.workout_id
    WHERE w.user_id = ${userId}
      AND we.exercise_id = ${exerciseId}::uuid
      AND w.ended_at IS NOT NULL
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
  `);

  const row = res.rows[0];
  return {
    sessions: row?.sessions ?? 0,
    sets: row?.sets ?? 0,
    reps: row?.reps ?? 0,
    volumeKg: row?.volume ?? 0,
    firstPerformedAt: row?.first_at ? new Date(row.first_at) : null,
    lastPerformedAt: row?.last_at ? new Date(row.last_at) : null,
  };
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
