import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";

/**
 * Replacing an exercise mid-workout used to wipe every value logged against
 * the block, always. That is right when the two movements are unrelated — a
 * pull-up's reps must not become a lat pulldown's in history, in the muscle
 * split or in the records computed at finish — and wrong for the common case,
 * which is swapping a barbell row for a chest-supported one two sets in. So
 * the screen asks, and `keepValues` is the answer.
 *
 * What is asserted here is the half the screen can't be trusted with: the
 * server keeps the values only when the two exercises are tracked the same
 * way, whatever the client sent, and the set *rows* survive either way — the
 * lifter asked for "this instead", not for the block to be rebuilt, so a
 * session carrying more sets than the routine prescribed keeps all of them.
 *
 * Auth and cache revalidation are mocked — the subject is the writes, and
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
const { workoutSet, workoutExercise } = await import("@/lib/db/schema");
const {
  startEmptyWorkout,
  addExercisesToWorkout,
  addSet,
  updateSet,
  replaceWorkoutExercise,
  discardWorkout,
} = await import("@/lib/actions/workout");
const { cleanup, makeExercise, makeUser } = await import("./helpers");

describe("replaceWorkoutExercise and the values already logged", () => {
  let userId = "";
  /** The movement being swapped out. */
  let rowId = "";
  /** Alike: same tracking type, so the numbers mean the same thing. */
  let similarId = "";
  /** Unalike: no weight column at all. */
  let timedId = "";

  beforeAll(async () => {
    userId = await makeUser();
    actingUserId = userId;
    rowId = await makeExercise();
    similarId = await makeExercise();
    timedId = await makeExercise(undefined, { trackingType: "time" });
  });

  afterAll(async () => {
    await cleanup([userId], [rowId, similarId, timedId]);
  });

  /**
   * A live workout on `rowId` with three logged sets — one more than the two
   * a block starts with, which is the "custom workouts with more sets" case.
   * Returns the block id and its set ids in order.
   */
  async function startLoggedBlock() {
    const started = await startEmptyWorkout();
    if (!started.ok || !started.data) throw new Error("could not start");
    const workoutId = started.data.workoutId;

    const added = await addExercisesToWorkout(workoutId, [rowId]);
    if (!added.ok || !added.data) throw new Error("could not add");
    const blockId = added.data.added[0].id;

    // The block arrives with one set; two more make three.
    for (let i = 0; i < 2; i++) {
      const res = await addSet(blockId);
      if (!res.ok) throw new Error(res.error);
    }

    const ids = await setIdsOf(blockId);
    expect(ids).toHaveLength(3);

    for (const [i, id] of ids.entries()) {
      const res = await updateSet(id, {
        weightKg: 60 + i * 5,
        reps: 8,
        rpe: 8,
        completed: true,
      });
      if (!res.ok) throw new Error(res.error);
    }

    return { workoutId, blockId, ids };
  }

  async function setIdsOf(blockId: string) {
    const rows = await db
      .select({ id: workoutSet.id })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, blockId))
      .orderBy(asc(workoutSet.position));
    return rows.map((r) => r.id);
  }

  async function setsOf(blockId: string) {
    return db
      .select({
        id: workoutSet.id,
        position: workoutSet.position,
        weightKg: workoutSet.weightKg,
        reps: workoutSet.reps,
        rpe: workoutSet.rpe,
        estimated1rm: workoutSet.estimated1rm,
        completedAt: workoutSet.completedAt,
      })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, blockId))
      .orderBy(asc(workoutSet.position));
  }

  it("keeps every logged value when the tracking type matches", async () => {
    const { workoutId, blockId, ids } = await startLoggedBlock();

    try {
      const res = await replaceWorkoutExercise(blockId, similarId, true);
      if (!res.ok || !res.data) throw new Error(res.ok ? "no data" : res.error);

      expect(res.data.keptValues).toBe(true);
      expect(res.data.exerciseId).toBe(similarId);

      // Same rows, all three of them, in the same order.
      expect(res.data.sets.map((s) => s.id)).toEqual(ids);

      const sets = await setsOf(blockId);
      expect(sets.map((s) => s.weightKg)).toEqual([60, 65, 70]);
      expect(sets.map((s) => s.reps)).toEqual([8, 8, 8]);
      expect(sets.map((s) => s.rpe)).toEqual([8, 8, 8]);
      for (const s of sets) {
        expect(s.completedAt).not.toBeNull();
        // Weight, reps and the tracking type are all unchanged, so the cached
        // estimate is still the right answer — recomputing would land on it.
        expect(s.estimated1rm).toBeGreaterThan(0);
      }

      // And the returned block agrees with the database, since the screen
      // rebuilds from it rather than from what it hoped happened.
      expect(res.data.sets.map((s) => s.weightKg)).toEqual([60, 65, 70]);
      expect(res.data.sets.every((s) => s.completed)).toBe(true);

      const [block] = await db
        .select({ exerciseId: workoutExercise.exerciseId })
        .from(workoutExercise)
        .where(eq(workoutExercise.id, blockId));
      expect(block.exerciseId).toBe(similarId);
    } finally {
      await discardWorkout(workoutId);
    }
  });

  it("refuses to keep them across a change of tracking type", async () => {
    const { workoutId, blockId, ids } = await startLoggedBlock();

    try {
      // The client asked to keep. It doesn't get to: a weight×reps set carried
      // onto a timed movement leaves numbers in columns it doesn't have.
      const res = await replaceWorkoutExercise(blockId, timedId, true);
      if (!res.ok || !res.data) throw new Error(res.ok ? "no data" : res.error);

      expect(res.data.keptValues).toBe(false);

      const sets = await setsOf(blockId);
      // The rows are still the rows — only their contents went.
      expect(sets.map((s) => s.id)).toEqual(ids);
      for (const s of sets) {
        expect(s.weightKg).toBeNull();
        expect(s.reps).toBeNull();
        expect(s.rpe).toBeNull();
        expect(s.estimated1rm).toBeNull();
        expect(s.completedAt).toBeNull();
      }
    } finally {
      await discardWorkout(workoutId);
    }
  });

  it("clears by default, which is what every existing caller gets", async () => {
    const { workoutId, blockId } = await startLoggedBlock();

    try {
      const res = await replaceWorkoutExercise(blockId, similarId);
      if (!res.ok || !res.data) throw new Error(res.ok ? "no data" : res.error);

      expect(res.data.keptValues).toBe(false);
      const sets = await setsOf(blockId);
      for (const s of sets) {
        expect(s.weightKg).toBeNull();
        expect(s.completedAt).toBeNull();
      }
    } finally {
      await discardWorkout(workoutId);
    }
  });
});
