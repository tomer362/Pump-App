import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";

/**
 * Editing the shape of a finished workout from `/history/[id]` — its date,
 * and which exercises it holds. Every case asserts what was derived from the
 * rows (totals, records, `pr_count`), since that is what the exercise's
 * history and charts read.
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
const { workout, workoutExercise, workoutSet, personalRecord } = await import(
  "@/lib/db/schema"
);
const {
  addLoggedExercise,
  editWorkoutDetails,
  moveLoggedExercise,
  removeLoggedExercise,
  replaceLoggedExercise,
} = await import("@/lib/actions/history-edit");
const { recalculatePersonalRecords } = await import("@/lib/records");
const { cleanup, makeExercise, makeFinishedWorkout, makeUser, recordsFor } =
  await import("./helpers");

const set = {
  seconds: null,
  distanceM: null,
  rpe: null,
  setType: "normal" as const,
};

describe("editing a finished workout's details and exercises", () => {
  let userId = "";
  let otherId = "";
  let liftA = "";
  let liftB = "";
  let timed = "";

  beforeAll(async () => {
    userId = await makeUser();
    otherId = await makeUser();
    actingUserId = userId;
    liftA = await makeExercise();
    liftB = await makeExercise();
    timed = await makeExercise(undefined, { trackingType: "time" });
  });

  afterAll(async () => {
    await cleanup([userId, otherId], [liftA, liftB, timed]);
  });

  async function logged(
    exerciseId: string,
    sets: { weightKg: number; reps: number }[],
    endedAt?: Date,
  ) {
    const made = await makeFinishedWorkout(userId, exerciseId, sets, endedAt);
    await db.transaction((tx) =>
      recalculatePersonalRecords(tx, userId, [exerciseId]),
    );
    return made;
  }

  async function row(workoutId: string) {
    const [w] = await db.select().from(workout).where(eq(workout.id, workoutId));
    return w;
  }

  async function blocks(workoutId: string) {
    return db
      .select()
      .from(workoutExercise)
      .where(eq(workoutExercise.workoutId, workoutId))
      .orderBy(asc(workoutExercise.position));
  }

  it("adds a forgotten exercise with its first set, and counts it", async () => {
    const { workoutId } = await logged(liftA, [{ weightKg: 100, reps: 5 }]);
    const res = await addLoggedExercise(workoutId, liftB, {
      ...set,
      weightKg: 60,
      reps: 10,
    });
    expect(res.ok).toBe(true);

    const bs = await blocks(workoutId);
    expect(bs.map((b) => b.exerciseId)).toEqual([liftA, liftB]);
    const w = await row(workoutId);
    expect(w.totalSets).toBe(2);
    expect(w.totalVolumeKg).toBe(100 * 5 + 60 * 10);
    expect((await recordsFor(userId, liftB)).get("weight")?.value).toBe(60);
  });

  it("refuses to add an empty first set", async () => {
    const { workoutId } = await logged(liftA, [{ weightKg: 100, reps: 5 }]);
    const res = await addLoggedExercise(workoutId, liftB, {
      ...set,
      weightKg: 60,
      reps: 0,
    });
    expect(res.ok).toBe(false);
    expect(await blocks(workoutId)).toHaveLength(1);
  });

  it("replaces the exercise, moving its sets' records across", async () => {
    const { workoutId, workoutExerciseId } = await logged(liftA, [
      { weightKg: 140, reps: 3 },
    ]);
    expect((await recordsFor(userId, liftA)).get("weight")?.workoutId).toBe(
      workoutId,
    );
    const res = await replaceLoggedExercise(workoutExerciseId, liftB);
    expect(res.ok).toBe(true);

    expect((await blocks(workoutId))[0].exerciseId).toBe(liftB);
    const b = await recordsFor(userId, liftB);
    expect(b.get("weight")?.value).toBe(140);
    expect(b.get("weight")?.workoutId).toBe(workoutId);
    // The old exercise no longer holds a record from this workout.
    expect((await recordsFor(userId, liftA)).get("weight")?.workoutId).not.toBe(
      workoutId,
    );
  });

  it("refuses a replacement measured differently", async () => {
    const { workoutId, workoutExerciseId } = await logged(liftA, [
      { weightKg: 50, reps: 5 },
    ]);
    const res = await replaceLoggedExercise(workoutExerciseId, timed);
    expect(res.ok).toBe(false);
    expect((await blocks(workoutId))[0].exerciseId).toBe(liftA);
  });

  it("removes an exercise and re-derives, but refuses the only one", async () => {
    const { workoutId, workoutExerciseId } = await logged(liftA, [
      { weightKg: 100, reps: 5 },
    ]);
    expect((await removeLoggedExercise(workoutExerciseId)).ok).toBe(false);

    await addLoggedExercise(workoutId, liftB, { ...set, weightKg: 300, reps: 1 });
    expect((await recordsFor(userId, liftB)).get("weight")?.value).toBe(300);
    const added = (await blocks(workoutId))[1];

    expect((await removeLoggedExercise(added.id)).ok).toBe(true);
    expect(await blocks(workoutId)).toHaveLength(1);
    const w = await row(workoutId);
    expect(w.totalSets).toBe(1);
    expect(w.totalVolumeKg).toBe(500);
    expect((await recordsFor(userId, liftB)).get("weight")?.value).not.toBe(300);
  });

  it("moves an exercise up and down, and stops at the ends", async () => {
    const { workoutId, workoutExerciseId: first } = await logged(liftA, [
      { weightKg: 100, reps: 5 },
    ]);
    await addLoggedExercise(workoutId, liftB, { ...set, weightKg: 50, reps: 5 });
    const second = (await blocks(workoutId))[1].id;

    expect((await moveLoggedExercise(first, -1)).ok).toBe(true);
    expect((await blocks(workoutId)).map((b) => b.id)).toEqual([first, second]);

    await moveLoggedExercise(second, -1);
    expect((await blocks(workoutId)).map((b) => b.id)).toEqual([second, first]);
    expect((await blocks(workoutId)).map((b) => b.position)).toEqual([0, 1]);
  });

  it("re-dates a workout, moving its sets and its records with it", async () => {
    // Two equal bests: the record goes to the earlier session.
    const recent = await logged(
      liftA,
      [{ weightKg: 222, reps: 2 }],
      new Date(Date.now() - 2 * 86_400_000),
    );
    const later = await logged(liftA, [{ weightKg: 222, reps: 2 }]);
    const holder = () =>
      db
        .select({ workoutId: personalRecord.workoutId })
        .from(personalRecord)
        .where(
          and(
            eq(personalRecord.userId, userId),
            eq(personalRecord.exerciseId, liftA),
            eq(personalRecord.kind, "weight"),
          ),
        );
    expect((await holder())[0].workoutId).toBe(recent.workoutId);

    const start = new Date(Date.now() - 10 * 86_400_000);
    const res = await editWorkoutDetails(later.workoutId, {
      name: "Moved",
      note: "  ",
      startedAt: start.toISOString(),
      durationMinutes: 45,
    });
    expect(res.ok).toBe(true);

    const w = await row(later.workoutId);
    expect(w.name).toBe("Moved");
    expect(w.note).toBeNull();
    expect(w.durationSeconds).toBe(45 * 60);
    expect(Math.abs(w.startedAt.getTime() - start.getTime())).toBeLessThan(1000);
    expect(w.endedAt!.getTime() - w.startedAt.getTime()).toBe(45 * 60_000);

    // Sets now sit inside the new window.
    const sets = await db
      .select({ completedAt: workoutSet.completedAt })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, later.workoutExerciseId));
    for (const s of sets) {
      expect(s.completedAt!.getTime()).toBeGreaterThanOrEqual(
        w.startedAt.getTime(),
      );
      expect(s.completedAt!.getTime()).toBeLessThanOrEqual(w.endedAt!.getTime());
    }
    // And the moved session is now the earlier one, so it holds the record.
    expect((await holder())[0].workoutId).toBe(later.workoutId);
  });

  it("refuses a workout that would end in the future", async () => {
    const { workoutId } = await logged(liftA, [{ weightKg: 10, reps: 5 }]);
    const res = await editWorkoutDetails(workoutId, {
      name: "x",
      note: null,
      startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      durationMinutes: 60,
    });
    expect(res.ok).toBe(false);
  });

  it("refuses all of it on someone else's workout", async () => {
    const { workoutId, workoutExerciseId } = await logged(liftA, [
      { weightKg: 80, reps: 5 },
    ]);
    actingUserId = otherId;
    try {
      expect(
        (
          await editWorkoutDetails(workoutId, {
            name: "Mine now",
            note: null,
            startedAt: new Date(Date.now() - 86_400_000).toISOString(),
            durationMinutes: 30,
          })
        ).ok,
      ).toBe(false);
      expect(
        (await addLoggedExercise(workoutId, liftB, { ...set, weightKg: 1, reps: 1 }))
          .ok,
      ).toBe(false);
      expect((await replaceLoggedExercise(workoutExerciseId, liftB)).ok).toBe(false);
      expect((await removeLoggedExercise(workoutExerciseId)).ok).toBe(false);
      expect((await moveLoggedExercise(workoutExerciseId, 1)).ok).toBe(false);
    } finally {
      actingUserId = userId;
    }
    expect((await row(workoutId)).name).toBe("Test session");
  });
});
