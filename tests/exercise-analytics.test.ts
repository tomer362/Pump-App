import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exercise } from "@/lib/db/schema";
import {
  getExerciseRepMaxes,
  getExerciseSessionSeries,
  getExerciseSummary,
  searchExercises,
} from "@/lib/queries/exercise";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

/**
 * The per-exercise analytics, against the real database.
 *
 * Two properties matter here and neither is provable against a mock: that
 * warm-up sets are excluded everywhere the app claims they are, and that
 * archiving an exercise hides it from the pickers without touching a single
 * row of history.
 */

const users: string[] = [];
const exercises: string[] = [];

afterAll(() => cleanup(users, exercises));

async function fixture() {
  const userId = await makeUser();
  const exerciseId = await makeExercise();
  users.push(userId);
  exercises.push(exerciseId);
  return { userId, exerciseId };
}

const DAY = 86_400_000;

describe("exercise session series", () => {
  it("returns one row per session, oldest first, ignoring warm-ups", async () => {
    const { userId, exerciseId } = await fixture();

    await makeFinishedWorkout(
      userId,
      exerciseId,
      [
        { weightKg: 20, reps: 10, warmup: true },
        { weightKg: 60, reps: 5 },
        { weightKg: 60, reps: 5 },
      ],
      new Date(Date.now() - 7 * DAY),
    );
    await makeFinishedWorkout(
      userId,
      exerciseId,
      [{ weightKg: 70, reps: 3 }],
      new Date(),
    );

    const series = await getExerciseSessionSeries(userId, exerciseId);

    expect(series).toHaveLength(2);
    expect(series[0].date.getTime()).toBeLessThan(series[1].date.getTime());

    // The 20kg warm-up contributes to neither the set count nor the volume.
    expect(series[0].sets).toBe(2);
    expect(series[0].reps).toBe(10);
    expect(series[0].volumeKg).toBeCloseTo(600, 4);
    expect(series[0].topWeightKg).toBe(60);

    expect(series[1].sets).toBe(1);
    expect(series[1].topWeightKg).toBe(70);
  });

  it("sums the whole history in the summary", async () => {
    const { userId, exerciseId } = await fixture();
    await makeFinishedWorkout(userId, exerciseId, [
      { weightKg: 100, reps: 10, warmup: true },
      { weightKg: 50, reps: 8 },
      { weightKg: 50, reps: 6 },
    ]);

    const summary = await getExerciseSummary(userId, exerciseId);

    expect(summary.sessions).toBe(1);
    expect(summary.sets).toBe(2);
    expect(summary.reps).toBe(14);
    expect(summary.volumeKg).toBeCloseTo(700, 4);
    expect(summary.firstPerformedAt).not.toBeNull();
  });
});

describe("rep maxes", () => {
  it("keeps the heaviest weight per rep count and skips warm-ups", async () => {
    const { userId, exerciseId } = await fixture();
    await makeFinishedWorkout(userId, exerciseId, [
      // A heavy warm-up would win the 5-rep row if warm-ups counted.
      { weightKg: 200, reps: 5, warmup: true },
      { weightKg: 80, reps: 5 },
      { weightKg: 90, reps: 5 },
      { weightKg: 100, reps: 3 },
    ]);

    const rows = await getExerciseRepMaxes(userId, exerciseId);
    const byReps = new Map(rows.map((r) => [r.reps, r]));

    expect(byReps.get(5)?.weightKg).toBe(90);
    expect(byReps.get(3)?.weightKg).toBe(100);
    // One row per rep count, not one per set.
    expect(rows.filter((r) => r.reps === 5)).toHaveLength(1);
    // Epley, cached at write time: 90 × (1 + 5/30) = 105.
    expect(byReps.get(5)?.estimated1rm).toBeCloseTo(105, 4);
  });

  it("ignores rep counts outside the table's range", async () => {
    const { userId, exerciseId } = await fixture();
    await makeFinishedWorkout(userId, exerciseId, [
      { weightKg: 40, reps: 30 },
      { weightKg: 60, reps: 4 },
    ]);

    const rows = await getExerciseRepMaxes(userId, exerciseId, 12);
    expect(rows.map((r) => r.reps)).toEqual([4]);
  });
});

describe("archiving a custom exercise", () => {
  it("hides it from search but leaves every logged set and record intact", async () => {
    const userId = await makeUser();
    users.push(userId);

    // A custom exercise: owned, so it is the only kind that can be archived.
    const [row] = await db
      .insert(exercise)
      .values({
        name: `Archivable ${Date.now()}`,
        primaryMuscle: "biceps",
        equipment: "dumbbell",
        ownerId: userId,
      })
      .returning({ id: exercise.id });
    const exerciseId = row.id;

    await makeFinishedWorkout(userId, exerciseId, [{ weightKg: 30, reps: 8 }]);

    const before = await searchExercises(userId, { query: "Archivable" });
    expect(before.map((e) => e.id)).toContain(exerciseId);

    await db
      .update(exercise)
      .set({ archivedAt: new Date() })
      .where(eq(exercise.id, exerciseId));

    const after = await searchExercises(userId, { query: "Archivable" });
    expect(after.map((e) => e.id)).not.toContain(exerciseId);

    const archived = await searchExercises(userId, {
      query: "Archivable",
      scope: "archived",
    });
    expect(archived.map((e) => e.id)).toContain(exerciseId);
    expect(archived[0].isArchived).toBe(true);

    // The whole point: the history is untouched.
    const summary = await getExerciseSummary(userId, exerciseId);
    expect(summary.sessions).toBe(1);
    expect(summary.volumeKg).toBeCloseTo(240, 4);
  });
});
