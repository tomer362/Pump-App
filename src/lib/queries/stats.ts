import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { streaks } from "@/lib/streaks";

export type MuscleVolume = {
  muscle: string;
  sets: number;
  volumeKg: number;
  sessions: number;
};

/**
 * Per-muscle working-set count over a window (feature #17).
 *
 * Sets are the unit, not tonnage: weekly *set count* per muscle is the number
 * training literature actually programs against, and it's comparable between
 * a squat and a lateral raise in a way that volume-load is not. Secondary
 * muscles count as a half set, which is the usual convention.
 */
export async function getMuscleVolume(
  userId: string,
  days = 7,
): Promise<MuscleVolume[]> {
  const res = await db.execute<{
    muscle: string;
    sets: number;
    volume: number;
    sessions: number;
  }>(sql`
    WITH completed AS (
      SELECT
        w.id           AS workout_id,
        e.primary_muscle,
        e.secondary_muscles,
        COALESCE(ws.weight_kg, 0) * COALESCE(ws.reps, 0) AS volume
      FROM workout w
      JOIN workout_exercise we ON we.workout_id = w.id
      JOIN workout_set ws      ON ws.workout_exercise_id = we.id
      JOIN exercise e          ON e.id = we.exercise_id
      WHERE w.user_id = ${userId}
        AND w.ended_at IS NOT NULL
        AND ws.completed_at IS NOT NULL
        AND ws.set_type <> 'warmup'
        AND w.started_at >= NOW() - (${days} || ' days')::interval
    ),
    expanded AS (
      SELECT primary_muscle AS muscle, 1.0 AS weight, volume, workout_id
      FROM completed
      UNION ALL
      SELECT sec.value #>> '{}' AS muscle, 0.5 AS weight, 0 AS volume, workout_id
      FROM completed, LATERAL jsonb_array_elements(secondary_muscles) AS sec(value)
    )
    SELECT
      muscle,
      SUM(weight)::real          AS sets,
      SUM(volume)::real          AS volume,
      COUNT(DISTINCT workout_id)::int AS sessions
    FROM expanded
    GROUP BY muscle
    ORDER BY sets DESC
  `);

  return res.rows.map((r) => ({
    muscle: r.muscle,
    sets: Math.round(r.sets * 10) / 10,
    volumeKg: r.volume,
    sessions: r.sessions,
  }));
}

export type WeeklyPoint = {
  weekStart: Date;
  workouts: number;
  volumeKg: number;
  sets: number;
};

/** Volume and frequency by ISO week — the trend chart on Stats. */
export async function getWeeklyTrend(
  userId: string,
  weeks = 12,
): Promise<WeeklyPoint[]> {
  const res = await db.execute<{
    week_start: string;
    workouts: number;
    volume: number;
    sets: number;
  }>(sql`
    SELECT
      DATE_TRUNC('week', started_at)::date AS week_start,
      COUNT(*)::int                        AS workouts,
      COALESCE(SUM(total_volume_kg), 0)::real AS volume,
      COALESCE(SUM(total_sets), 0)::int    AS sets
    FROM workout
    WHERE user_id = ${userId}
      AND ended_at IS NOT NULL
      AND started_at >= DATE_TRUNC('week', NOW()) - (${weeks - 1} || ' weeks')::interval
    GROUP BY week_start
    ORDER BY week_start
  `);

  return res.rows.map((r) => ({
    weekStart: new Date(r.week_start),
    workouts: r.workouts,
    volumeKg: r.volume,
    sets: r.sets,
  }));
}

export type LifetimeStats = {
  workouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  totalSeconds: number;
  currentStreak: number;
  longestStreak: number;
  prCount: number;
};

export async function getLifetimeStats(userId: string): Promise<LifetimeStats> {
  const totals = await db.execute<{
    workouts: number;
    volume: number;
    sets: number;
    reps: number;
    seconds: number;
  }>(sql`
    SELECT
      COUNT(*)::int                            AS workouts,
      COALESCE(SUM(total_volume_kg), 0)::real  AS volume,
      COALESCE(SUM(total_sets), 0)::int        AS sets,
      COALESCE(SUM(total_reps), 0)::int        AS reps,
      COALESCE(SUM(duration_seconds), 0)::int  AS seconds
    FROM workout
    WHERE user_id = ${userId} AND ended_at IS NOT NULL
  `);

  const prs = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM personal_record WHERE user_id = ${userId}
  `);

  const days = await db.execute<{ day: string }>(sql`
    SELECT DISTINCT DATE(started_at) AS day
    FROM workout
    WHERE user_id = ${userId} AND ended_at IS NOT NULL
    ORDER BY day DESC
  `);

  const { current, longest } = streaks(
    days.rows.map((r) => new Date(r.day + "T00:00:00")),
  );

  const t = totals.rows[0];
  return {
    workouts: t?.workouts ?? 0,
    totalVolumeKg: t?.volume ?? 0,
    totalSets: t?.sets ?? 0,
    totalReps: t?.reps ?? 0,
    totalSeconds: t?.seconds ?? 0,
    prCount: prs.rows[0]?.n ?? 0,
    currentStreak: current,
    longestStreak: longest,
  };
}

export type TrainingDay = {
  /** `YYYY-MM-DD` in the database's timezone — the key the grid renders by. */
  day: string;
  workouts: number;
  volumeKg: number;
};

/**
 * Which days were trained over a window, for the consistency grid.
 *
 * Returns only days that have a workout; the component fills the gaps, which
 * keeps the payload proportional to sessions rather than to 365 rows of zero.
 */
export async function getTrainingCalendar(
  userId: string,
  days = 365,
): Promise<TrainingDay[]> {
  const res = await db.execute<{
    day: string;
    workouts: number;
    volume: number;
  }>(sql`
    SELECT
      TO_CHAR(DATE(started_at), 'YYYY-MM-DD')  AS day,
      COUNT(*)::int                            AS workouts,
      COALESCE(SUM(total_volume_kg), 0)::real  AS volume
    FROM workout
    WHERE user_id = ${userId}
      AND ended_at IS NOT NULL
      AND started_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(started_at)
    ORDER BY day
  `);

  return res.rows.map((r) => ({
    day: r.day,
    workouts: r.workouts,
    volumeKg: r.volume,
  }));
}

export type RecentRecord = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  kind: string;
  value: number;
  weightKg: number | null;
  reps: number | null;
  achievedAt: Date;
};

/**
 * Most recently set records across every exercise — the PR timeline.
 *
 * `personal_record` holds one row per (user, exercise, kind) and is upserted
 * as records improve, so this is "your current bests, newest first" rather
 * than a historical log. That's the useful reading: it answers "what have I
 * moved lately".
 */
export async function getRecentRecords(
  userId: string,
  limit = 8,
): Promise<RecentRecord[]> {
  const res = await db.execute<{
    id: string;
    exercise_id: string;
    exercise_name: string;
    kind: string;
    value: number;
    weight_kg: number | null;
    reps: number | null;
    achieved_at: string | Date;
  }>(sql`
    SELECT
      pr.id, pr.exercise_id, e.name AS exercise_name, pr.kind, pr.value,
      pr.weight_kg, pr.reps, pr.achieved_at
    FROM personal_record pr
    JOIN exercise e ON e.id = pr.exercise_id
    WHERE pr.user_id = ${userId}
    ORDER BY pr.achieved_at DESC
    LIMIT ${limit}
  `);

  return res.rows.map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    kind: r.kind,
    value: r.value,
    weightKg: r.weight_kg,
    reps: r.reps,
    achievedAt: new Date(r.achieved_at),
  }));
}

export type AchievementRow = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: number;
  unlockedAt: Date | null;
  /** Null while the unlock hasn't been looked at yet — drives the "new" dot. */
  seenAt: Date | null;
};

export async function getAchievements(
  userId: string,
): Promise<AchievementRow[]> {
  const res = await db.execute<{
    key: string;
    title: string;
    description: string;
    icon: string;
    tier: number;
    unlocked_at: Date | null;
    seen_at: Date | null;
  }>(sql`
    SELECT a.key, a.title, a.description, a.icon, a.tier, ua.unlocked_at, ua.seen_at
    FROM achievement a
    LEFT JOIN user_achievement ua
      ON ua.achievement_key = a.key AND ua.user_id = ${userId}
    ORDER BY (ua.unlocked_at IS NULL), a.tier, a.title
  `);

  return res.rows.map((r) => ({
    key: r.key,
    title: r.title,
    description: r.description,
    icon: r.icon,
    tier: r.tier,
    unlockedAt: r.unlocked_at,
    seenAt: r.seen_at,
  }));
}
