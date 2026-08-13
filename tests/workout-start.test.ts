import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";

/**
 * Starting a routine used to copy `routine_set.target_rpe` straight into
 * `workout_set.rpe`, "pre-filled like every other target". Weight and reps
 * survive that because they land in text inputs, which visibly are targets you
 * type over; RPE has no input, only the result-shaped `@8` subscript under the
 * set number. So a freshly started routine claimed the lifter had rated every
 * set of a session they hadn't started, and once finished there was no record of
 * prescribed versus actual at all.
 *
 * Nothing covered `startWorkoutFromRoutine` before, which is how that shipped.
 * These assert the two facts stay in two columns through the three writes that
 * touch them: start, rate, and append.
 *
 * Auth and cache revalidation are mocked — the subject is the inserts, and
 * neither a session cookie nor a Next request scope exists under vitest.
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
const { routine, routineExercise, routineSet, workoutSet, workoutExercise } =
  await import("@/lib/db/schema");
const { startWorkoutFromRoutine, addSet, updateSet, discardWorkout } =
  await import("@/lib/actions/workout");
const { cleanup, makeExercise, makeUser } = await import("./helpers");

/** Three sets ramping 7 / 8.5 / null, so uniform and mixed are both covered. */
const PRESCRIBED = [7, 8.5, null];

describe("startWorkoutFromRoutine and the prescribed effort", () => {
  let userId = "";
  let exerciseId = "";
  let routineId = "";

  beforeAll(async () => {
    userId = await makeUser();
    actingUserId = userId;
    exerciseId = await makeExercise();

    const [r] = await db
      .insert(routine)
      .values({ userId, name: "Test program", position: 0 })
      .returning({ id: routine.id });
    routineId = r.id;

    const [re] = await db
      .insert(routineExercise)
      .values({ routineId, exerciseId, position: 0 })
      .returning({ id: routineExercise.id });

    await db.insert(routineSet).values(
      PRESCRIBED.map((rpe, i) => ({
        routineExerciseId: re.id,
        position: i,
        targetWeightKg: 100,
        targetReps: 5,
        targetRpe: rpe,
      })),
    );
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  /** `ActionResult.data` is optional on the ok branch, so narrow it once. */
  async function start() {
    const res = await startWorkoutFromRoutine(routineId, 1);
    if (!res.ok || !res.data) throw new Error(res.ok ? "no data" : res.error);
    return res.data.workoutId;
  }

  async function setsOf(workoutId: string) {
    return db
      .select({
        id: workoutSet.id,
        position: workoutSet.position,
        rpe: workoutSet.rpe,
        targetRpe: workoutSet.targetRpe,
        weightKg: workoutSet.weightKg,
      })
      .from(workoutSet)
      .innerJoin(
        workoutExercise,
        eq(workoutExercise.id, workoutSet.workoutExerciseId),
      )
      .where(eq(workoutExercise.workoutId, workoutId))
      .orderBy(asc(workoutSet.position));
  }

  it("writes the prescription to target_rpe and leaves rpe unrated", async () => {
    const workoutId = await start();

    try {
      const sets = await setsOf(workoutId);
      expect(sets).toHaveLength(PRESCRIBED.length);

      // The bug, asserted directly: nothing has been performed, so nothing can
      // have felt like anything.
      for (const s of sets) expect(s.rpe).toBeNull();
      expect(sets.map((s) => s.targetRpe)).toEqual(PRESCRIBED);

      // The other targets still pre-fill — they always did, and a text input
      // reads as a target rather than as a result.
      for (const s of sets) expect(s.weightKg).toBe(100);
    } finally {
      await discardWorkout(workoutId);
    }
  });

  it("keeps the prescription when the set is rated, and after re-rating", async () => {
    const workoutId = await start();

    try {
      const [first] = await setsOf(workoutId);
      expect(first.targetRpe).toBe(7);

      // The lifter found it harder than prescribed. Both facts survive: that is
      // the whole point of the split — a session can now show 7 asked for and 9
      // delivered.
      const rated = await updateSet(first.id, { rpe: 9 });
      expect(rated.ok).toBe(true);

      const [after] = await setsOf(workoutId);
      expect(after.rpe).toBe(9);
      expect(after.targetRpe).toBe(7);

      // Clearing the rating must not clear the prescription with it.
      await updateSet(first.id, { rpe: null });
      const [cleared] = await setsOf(workoutId);
      expect(cleared.rpe).toBeNull();
      expect(cleared.targetRpe).toBe(7);
    } finally {
      await discardWorkout(workoutId);
    }
  });

  it("refuses an effort off the half-point scale", async () => {
    const workoutId = await start();

    try {
      const [first] = await setsOf(workoutId);
      // Every caller is a chip in `RpePicker`, so anything else is a bug rather
      // than an intent to honour. This used to accept any number from 1 to 10.
      expect((await updateSet(first.id, { rpe: 6.25 })).ok).toBe(false);
      expect((await updateSet(first.id, { rpe: 3 })).ok).toBe(false);
      expect((await updateSet(first.id, { rpe: 6.5 })).ok).toBe(true);
    } finally {
      await discardWorkout(workoutId);
    }
  });

  it("carries the prescription into an appended set but never a rating", async () => {
    const workoutId = await start();

    try {
      const before = await setsOf(workoutId);
      const [we] = await db
        .select({ id: workoutExercise.id })
        .from(workoutExercise)
        .where(eq(workoutExercise.workoutId, workoutId));

      // Rate the set the new one will be appended after, so "inherits the
      // rating" would be visible rather than hidden behind a null.
      await updateSet(before[before.length - 1].id, { rpe: 9 });

      const added = await addSet(we.id);
      expect(added.ok).toBe(true);

      const after = await setsOf(workoutId);
      expect(after).toHaveLength(before.length + 1);
      const appended = after[after.length - 1];

      // A set nobody has done cannot already have felt like anything — the old
      // `rpe: last?.rpe` manufactured a rating.
      expect(appended.rpe).toBeNull();
      // The prescription does carry forward: an appended set continues the
      // pattern being prescribed, same argument as the rest override beside it.
      // The last routine set prescribed nothing, so there is nothing to carry.
      expect(appended.targetRpe).toBe(PRESCRIBED[PRESCRIBED.length - 1]);
    } finally {
      await discardWorkout(workoutId);
    }
  });
});
