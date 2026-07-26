import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  personalRecord,
  user,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import { estimate1RM } from "@/lib/utils";
import { eq, inArray } from "drizzle-orm";

/**
 * These tests run against the real database rather than a mock. The bugs they
 * cover — a record silently vanishing when its workout is deleted, two writers
 * both incrementing a counter, a limiter that lets a burst through — are all
 * properties of the SQL, so a mocked `db` would prove nothing.
 *
 * Everything is created under a throwaway user and torn down afterwards.
 */

let seq = 0;
const stamp = () => `${process.pid}-${Date.now()}-${seq++}`;

export async function makeUser() {
  const id = `test-${stamp()}`;
  await db.insert(user).values({
    id,
    name: "Test Lifter",
    email: `${id}@test.invalid`,
  });
  return id;
}

export async function makeExercise(name = `Test Lift ${stamp()}`) {
  const [row] = await db
    .insert(exercise)
    .values({
      name,
      primaryMuscle: "chest",
      equipment: "barbell",
      trackingType: "weight_reps",
    })
    .returning({ id: exercise.id });
  return row.id;
}

/**
 * A finished workout containing one exercise and the given sets, with
 * `estimated1rm` filled in the way the app fills it.
 */
export async function makeFinishedWorkout(
  userId: string,
  exerciseId: string,
  sets: { weightKg: number; reps: number; warmup?: boolean }[],
  endedAt = new Date(),
) {
  const [w] = await db
    .insert(workout)
    .values({
      userId,
      name: "Test session",
      startedAt: new Date(endedAt.getTime() - 3_600_000),
      endedAt,
      durationSeconds: 3600,
    })
    .returning({ id: workout.id });

  const [we] = await db
    .insert(workoutExercise)
    .values({ workoutId: w.id, exerciseId, position: 0 })
    .returning({ id: workoutExercise.id });

  await db.insert(workoutSet).values(
    sets.map((s, i) => ({
      workoutExerciseId: we.id,
      position: i,
      setType: (s.warmup ? "warmup" : "normal") as "warmup" | "normal",
      weightKg: s.weightKg,
      reps: s.reps,
      estimated1rm: estimate1RM(s.weightKg, s.reps),
      completedAt: endedAt,
    })),
  );

  return { workoutId: w.id, workoutExerciseId: we.id };
}

export async function recordsFor(userId: string, exerciseId: string) {
  const rows = await db
    .select()
    .from(personalRecord)
    .where(
      sql`${personalRecord.userId} = ${userId} AND ${personalRecord.exerciseId} = ${exerciseId}`,
    );
  return new Map(rows.map((r) => [r.kind, r]));
}

/** Cascades take care of everything hanging off the user rows. */
export async function cleanup(userIds: string[], exerciseIds: string[] = []) {
  if (userIds.length) {
    await db.delete(user).where(inArray(user.id, userIds));
  }
  for (const id of exerciseIds) {
    await db.delete(exercise).where(eq(exercise.id, id));
  }
}
