import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

/**
 * Quick-log is the only write path in the app that creates its own workout,
 * and it creates it *already ended* — which is what makes the set count
 * immediately, and what makes it safe against `workout_one_active_idx`.
 *
 * Every property here is a property of the SQL: that consecutive logs land in
 * one session rather than littering history, that the denormalised counters
 * agree with the rows they summarise, that a record is written and taken back
 * on undo, and — the one that would be a genuinely nasty regression — that a
 * quick log never blocks starting a real workout.
 *
 * Auth and cache revalidation are mocked; neither a session cookie nor a Next
 * request scope exists under vitest.
 */
let actingUserId = "";

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: async () => ({
    id: actingUserId,
    name: "Test Lifter",
    email: `${actingUserId}@test.invalid`,
    unit: "kg",
    defaultRestSeconds: 120,
    homeGymId: null,
    username: null,
    image: null,
    bio: null,
  }),
  requireUser: async () => {
    throw new Error("not used");
  },
}));

const { db } = await import("@/lib/db");
const { personalRecord, workout, workoutExercise, workoutSet } = await import(
  "@/lib/db/schema"
);
const { quickLogSet, undoQuickLogSet } = await import(
  "@/lib/actions/quick-log"
);
const { startEmptyWorkout, discardWorkout } = await import(
  "@/lib/actions/workout"
);
const { cleanup, makeExercise, makeUser } = await import("./helpers");
const { sumSetTotals } = await import("@/lib/workout-totals");

let userId = "";
let exerciseId = "";

beforeAll(async () => {
  userId = await makeUser();
  actingUserId = userId;
  exerciseId = await makeExercise();
});

afterAll(async () => {
  await cleanup([userId], [exerciseId]);
});

async function quickLogWorkouts() {
  return db
    .select()
    .from(workout)
    .where(and(eq(workout.userId, userId), eq(workout.kind, "quick_log")));
}

async function setsIn(workoutId: string) {
  return db
    .select({
      id: workoutSet.id,
      setType: workoutSet.setType,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      completedAt: workoutSet.completedAt,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .where(eq(workoutExercise.workoutId, workoutId));
}

describe("quickLogSet", () => {
  it("writes a finished workout whose set counts immediately", async () => {
    const res = await quickLogSet({ exerciseId, weightKg: 100, reps: 5 });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected a logged set");

    const [w] = await db
      .select()
      .from(workout)
      .where(eq(workout.id, res.data.workoutId));

    // Ended on insert — every stats query filters `ended_at IS NOT NULL`, so
    // an unfinished quick log would be invisible everywhere it matters.
    expect(w.endedAt).not.toBeNull();
    expect(w.kind).toBe("quick_log");
    // Nobody spent time in a session that never ran.
    expect(w.durationSeconds).toBe(0);
    expect(w.totalVolumeKg).toBeCloseTo(500, 5);
    expect(w.totalSets).toBe(1);
    expect(w.totalReps).toBe(5);
  });

  it("appends to the same session rather than making a workout per set", async () => {
    const before = (await quickLogWorkouts()).length;
    await quickLogSet({ exerciseId, weightKg: 100, reps: 5 });
    await quickLogSet({ exerciseId, weightKg: 102.5, reps: 3 });
    expect((await quickLogWorkouts()).length).toBe(before);
  });

  it("keeps the denormalised counters equal to a fresh sum of its sets", async () => {
    const res = await quickLogSet({ exerciseId, weightKg: 60, reps: 12 });
    if (!res.ok || !res.data) throw new Error("expected a logged set");

    const [w] = await db
      .select()
      .from(workout)
      .where(eq(workout.id, res.data.workoutId));
    const totals = sumSetTotals(await setsIn(res.data.workoutId));

    expect(w.totalVolumeKg).toBeCloseTo(totals.totalVolumeKg, 4);
    expect(w.totalSets).toBe(totals.totalSets);
    expect(w.totalReps).toBe(totals.totalReps);
  });

  it("writes a personal record, and undo takes it back", async () => {
    // Comfortably heavier than anything logged above.
    const res = await quickLogSet({ exerciseId, weightKg: 200, reps: 3 });
    if (!res.ok || !res.data) throw new Error("expected a logged set");
    expect(res.data.isPr).toBe(true);

    const [pr] = await db
      .select()
      .from(personalRecord)
      .where(
        and(
          eq(personalRecord.userId, userId),
          eq(personalRecord.exerciseId, exerciseId),
          eq(personalRecord.kind, "weight"),
        ),
      );
    expect(pr.value).toBeCloseTo(200, 5);

    const undone = await undoQuickLogSet(res.data.setId);
    expect(undone.ok).toBe(true);

    // `recalculatePersonalRecords` re-derives from the surviving sets, so the
    // previous best comes back rather than the record simply vanishing.
    const [after] = await db
      .select()
      .from(personalRecord)
      .where(
        and(
          eq(personalRecord.userId, userId),
          eq(personalRecord.exerciseId, exerciseId),
          eq(personalRecord.kind, "weight"),
        ),
      );
    expect(after.value).toBeLessThan(200);
  });

  it("refuses a set that records nothing", async () => {
    const res = await quickLogSet({ exerciseId, weightKg: 100, reps: 0 });
    expect(res.ok).toBe(false);
  });

  it("does not block starting a real workout", async () => {
    // `workout_one_active_idx` is unique on (user_id) WHERE ended_at IS NULL.
    // A quick-log row is never active, so it must not occupy that slot — if it
    // did, one quick log would permanently wedge the Start button.
    await quickLogSet({ exerciseId, weightKg: 80, reps: 8 });
    const started = await startEmptyWorkout();
    expect(started.ok).toBe(true);
    if (started.ok && started.data) await discardWorkout(started.data.workoutId);
  });
});
