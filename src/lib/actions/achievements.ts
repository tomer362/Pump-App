import "server-only";
import { and, eq, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { streaks } from "@/lib/streaks";
import {
  achievement,
  friendRequest,
  personalRecord,
  userAchievement,
  workout,
} from "@/lib/db/schema";

export type UnlockedAchievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
};

type Context = {
  finishedWorkoutAt?: Date;
  /** Caller's UTC offset in minutes (JS sign: UTC−5 is +300). Default 0. */
  tzOffsetMinutes?: number;
  workoutVolumeKg?: number;
  durationSeconds?: number;
  newPrCount?: number;
  isCoop?: boolean;
  addedFriend?: boolean;
};

/**
 * Evaluate every achievement rule and insert any newly earned ones.
 * Insert-only with ON CONFLICT DO NOTHING, so re-running is harmless and the
 * returned list is exactly what to animate.
 *
 * Every call site runs this after its own write has already committed —
 * `finishWorkout` after the workout is saved, `acceptFriendRequest` after the
 * friendship is saved — and none of them wrap the call. Achievements are a
 * garnish on those actions, not a precondition of them, so nothing in here may
 * throw back out: `ON CONFLICT DO NOTHING` only suppresses a duplicate-row
 * conflict, not a foreign-key violation (verified directly — inserting a
 * `userAchievement` row for a key absent from `achievement`, e.g. because a
 * fresh database hasn't been seeded, throws through the `onConflictDoNothing`
 * call rather than being swallowed by it). Without this guard, that failure
 * surfaced as an error screen on a workout that had, in fact, already saved.
 */
export async function grantAchievements(
  userId: string,
  ctx: Context = {},
): Promise<UnlockedAchievement[]> {
  try {
    return await grantAchievementsUnguarded(userId, ctx);
  } catch (err) {
    console.error("[pump] grantAchievements failed; continuing without it", err);
    return [];
  }
}

async function grantAchievementsUnguarded(
  userId: string,
  ctx: Context,
): Promise<UnlockedAchievement[]> {
  const earned = new Set<string>();

  const [counts] = await db
    .select({
      workouts: sql<number>`COUNT(*)::int`,
      totalVolume: sql<number>`COALESCE(SUM(${workout.totalVolumeKg}), 0)::real`,
    })
    .from(workout)
    .where(and(eq(workout.userId, userId), isNotNull(workout.endedAt)));

  const workouts = counts?.workouts ?? 0;
  const totalVolume = counts?.totalVolume ?? 0;

  if (workouts >= 1) earned.add("first_workout");
  if (workouts >= 10) earned.add("workouts_10");
  if (workouts >= 50) earned.add("workouts_50");
  if (workouts >= 100) earned.add("workouts_100");
  if (totalVolume >= 1_000_000) earned.add("volume_1m");

  if ((ctx.workoutVolumeKg ?? 0) >= 10_000) earned.add("volume_10k");
  if ((ctx.durationSeconds ?? 0) >= 2 * 3600) earned.add("marathon");
  if (ctx.isCoop) earned.add("social_coop");

  if (ctx.finishedWorkoutAt) {
    // The lifter's clock, not the function's: a Vercel function runs in UTC,
    // which awarded "night owl" to a 9 p.m. session in Tel Aviv and never
    // "early bird" to a 6 a.m. one in New York. `getTimezoneOffset()` is
    // minutes *behind* UTC, so local time is UTC minus the offset.
    const local = new Date(
      ctx.finishedWorkoutAt.getTime() - (ctx.tzOffsetMinutes ?? 0) * 60_000,
    );
    const h = local.getUTCHours();
    if (h < 7) earned.add("early_bird");
    if (h >= 22) earned.add("night_owl");
  }

  const [prCount] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(personalRecord)
    .where(eq(personalRecord.userId, userId));
  if ((prCount?.n ?? 0) >= 1) earned.add("pr_first");
  if ((prCount?.n ?? 0) >= 25) earned.add("pr_25");

  const [friends] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.status, "accepted"),
        sql`(${friendRequest.requesterId} = ${userId} OR ${friendRequest.addresseeId} = ${userId})`,
      ),
    );
  if ((friends?.n ?? 0) >= 1) earned.add("social_first_friend");

  // Streaks and weekly coverage need day-level data, so only compute them when
  // a workout just finished.
  if (ctx.finishedWorkoutAt) {
    const streak = await currentStreak(userId);
    if (streak >= 7) earned.add("streak_7");
    if (streak >= 30) earned.add("streak_30");

    if (await hitAllMuscleGroupsThisWeek(userId)) {
      earned.add("all_muscles_week");
    }
  }

  if (!earned.size) return [];

  const inserted = await db
    .insert(userAchievement)
    .values(
      [...earned].map((key) => ({ userId, achievementKey: key })),
    )
    .onConflictDoNothing()
    .returning({ key: userAchievement.achievementKey });

  if (!inserted.length) return [];

  return db
    .select({
      key: achievement.key,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
    })
    .from(achievement)
    .where(
      inArray(
        achievement.key,
        inserted.map((r) => r.key),
      ),
    );
}

/**
 * Consecutive days ending today or yesterday (so a rest day doesn't reset it
 * mid-day). Delegates to the shared, unit-tested `streaks()` instead of its
 * own copy of the same loop — this used to be an independent reimplementation
 * with identical logic to `queries/stats.ts`'s copy, which only `streaks()`'s
 * tests actually covered. Two copies of the same rule are two places for them
 * to quietly drift apart; there's no reason for this one to exist separately.
 */
async function currentStreak(userId: string): Promise<number> {
  const res = await db.execute<{ day: string }>(sql`
    SELECT DISTINCT DATE(started_at) AS day
    FROM ${workout}
    WHERE user_id = ${userId} AND ended_at IS NOT NULL
    ORDER BY day DESC
    LIMIT 400
  `);
  const days = res.rows.map((r) => new Date(r.day + "T00:00:00"));
  return streaks(days).current;
}

const MAJOR_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
] as const;

async function hitAllMuscleGroupsThisWeek(userId: string): Promise<boolean> {
  const res = await db.execute<{ primary_muscle: string }>(sql`
    SELECT DISTINCT e.primary_muscle
    FROM workout w
    JOIN workout_exercise we ON we.workout_id = w.id
    JOIN workout_set ws ON ws.workout_exercise_id = we.id
    JOIN exercise e ON e.id = we.exercise_id
    WHERE w.user_id = ${userId}
      AND w.ended_at IS NOT NULL
      -- The calendar week the trend chart draws, not a rolling 168 hours:
      -- "this week" on the badge has to mean the same thing as on /stats.
      AND w.started_at >= DATE_TRUNC('week', NOW())
      AND ws.completed_at IS NOT NULL
  `);
  const hit = new Set(res.rows.map((r) => r.primary_muscle));
  // "lats" counts as back — the library splits them, the achievement doesn't.
  if (hit.has("lats")) hit.add("back");
  return MAJOR_GROUPS.every((g) => hit.has(g));
}
