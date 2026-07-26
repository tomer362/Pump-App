import "server-only";
import { and, eq, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
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
 */
export async function grantAchievements(
  userId: string,
  ctx: Context = {},
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
    const h = ctx.finishedWorkoutAt.getHours();
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

/** Consecutive days ending today or yesterday (so a rest day doesn't reset it mid-day). */
async function currentStreak(userId: string): Promise<number> {
  const res = await db.execute<{ day: string }>(sql`
    SELECT DISTINCT DATE(started_at) AS day
    FROM ${workout}
    WHERE user_id = ${userId} AND ended_at IS NOT NULL
    ORDER BY day DESC
    LIMIT 400
  `);
  const days = res.rows.map((r) => new Date(r.day + "T00:00:00"));
  if (!days.length) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;

  const gapFromToday = Math.round((today.getTime() - days[0].getTime()) / dayMs);
  if (gapFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((days[i - 1].getTime() - days[i].getTime()) / dayMs);
    if (gap === 1) streak++;
    else if (gap > 1) break;
  }
  return streak;
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
      AND w.started_at >= NOW() - INTERVAL '7 days'
      AND ws.completed_at IS NOT NULL
  `);
  const hit = new Set(res.rows.map((r) => r.primary_muscle));
  // "lats" counts as back — the library splits them, the achievement doesn't.
  if (hit.has("lats")) hit.add("back");
  return MAJOR_GROUPS.every((g) => hit.has(g));
}
