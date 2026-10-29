import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";

/**
 * Correcting a finished workout from `/history/[id]`. The point of a separate
 * path from `updateSet` is that every counter derived from the rows moves with
 * them — the workout's totals, `pr_count`, and the personal records — so each
 * case here asserts the derived figures, not just the row.
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
const { addLoggedSet, deleteLoggedSet, editLoggedSet } = await import(
  "@/lib/actions/history-edit"
);
const { recalculatePersonalRecords } = await import("@/lib/records");
const { cleanup, makeExercise, makeFinishedWorkout, makeUser } = await import(
  "./helpers"
);

const base = {
  seconds: null,
  distanceM: null,
  rpe: null,
  setType: "normal" as const,
};

describe("editing a finished workout re-derives what it was counted into", () => {
  let userId = "";
  let otherId = "";
  let exerciseId = "";

  beforeAll(async () => {
    userId = await makeUser();
    otherId = await makeUser();
    actingUserId = userId;
    exerciseId = await makeExercise();
  });

  afterAll(async () => {
    await cleanup([userId, otherId], [exerciseId]);
  });

  async function logged(sets: { weightKg: number; reps: number }[]) {
    const { workoutId } = await makeFinishedWorkout(userId, exerciseId, sets);
    await db.transaction((tx) =>
      recalculatePersonalRecords(tx, userId, [exerciseId]),
    );
    // The helper writes rows, not counters; write them the way finish does.
    await db
      .update(workout)
      .set({
        totalSets: sets.length,
        totalReps: sets.reduce((n, s) => n + s.reps, 0),
        totalVolumeKg: sets.reduce((n, s) => n + s.weightKg * s.reps, 0),
      })
      .where(eq(workout.id, workoutId));
    const ids = (
      await db
        .select({ id: workoutSet.id, weId: workoutSet.workoutExerciseId })
        .from(workoutSet)
        .innerJoin(
          workoutExercise,
          eq(workoutExercise.id, workoutSet.workoutExerciseId),
        )
        .where(eq(workoutExercise.workoutId, workoutId))
        .orderBy(asc(workoutSet.position))
    );
    return { workoutId, ids: ids.map((r) => r.id), weId: ids[0].weId };
  }

  async function totals(workoutId: string) {
    const [w] = await db.select().from(workout).where(eq(workout.id, workoutId));
    return w;
  }

  async function best1rm() {
    const [pr] = await db
      .select()
      .from(personalRecord)
      .where(
        and(
          eq(personalRecord.userId, userId),
          eq(personalRecord.exerciseId, exerciseId),
          eq(personalRecord.kind, "1rm"),
        ),
      );
    return pr;
  }

  it("corrects a typo'd weight and takes the record it falsely set with it", async () => {
    const { workoutId, ids } = await logged([
      { weightKg: 100, reps: 5 },
      { weightKg: 1000, reps: 5 },
    ]);
    expect((await best1rm()).workoutSetId).toBe(ids[1]);

    const res = await editLoggedSet(ids[1], {
      ...base,
      weightKg: 100,
      reps: 5,
      done: true,
    });
    expect(res.ok).toBe(true);

    const w = await totals(workoutId);
    expect(w.totalVolumeKg).toBe(1000);
    expect(w.totalSets).toBe(2);
    const [row] = await db.select().from(workoutSet).where(eq(workoutSet.id, ids[1]));
    expect(row.estimated1rm).toBeCloseTo(100 * (1 + 5 / 30), 3);
    // The 1000 kg record is gone; what is left is the real 100 × 5.
    expect((await best1rm()).value).toBeCloseTo(100 * (1 + 5 / 30), 3);
  });

  it("marks a set skipped, and it stops counting and loses its rating", async () => {
    const { workoutId, ids } = await logged([
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 10 },
    ]);
    const res = await editLoggedSet(ids[0], {
      ...base,
      weightKg: 60,
      reps: 10,
      rpe: 8,
      done: false,
    });
    expect(res.ok).toBe(true);
    const w = await totals(workoutId);
    expect(w.totalSets).toBe(1);
    expect(w.totalReps).toBe(10);
    const [row] = await db.select().from(workoutSet).where(eq(workoutSet.id, ids[0]));
    expect(row.completedAt).toBeNull();
    expect(row.rpe).toBeNull();
  });

  it("adds a forgotten set inside the session and counts it", async () => {
    const { workoutId, weId } = await logged([{ weightKg: 80, reps: 5 }]);
    const res = await addLoggedSet(weId, { ...base, weightKg: 200, reps: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) return;
    const w = await totals(workoutId);
    expect(w.totalSets).toBe(2);
    expect(w.totalVolumeKg).toBe(1000);
    const [row] = await db
      .select()
      .from(workoutSet)
      .where(eq(workoutSet.id, res.data.setId));
    expect(row.position).toBe(1);
    expect(row.completedAt?.getTime()).toBe(w.endedAt?.getTime());
    expect((await best1rm()).workoutSetId).toBe(res.data.setId);
    expect(w.prCount).toBe(1);
  });

  it("deletes a set, but refuses the workout's last one", async () => {
    const { workoutId, ids } = await logged([
      { weightKg: 50, reps: 5 },
      { weightKg: 50, reps: 5 },
    ]);
    expect((await deleteLoggedSet(ids[0])).ok).toBe(true);
    const w = await totals(workoutId);
    expect(w.totalSets).toBe(1);
    expect(w.totalVolumeKg).toBe(250);
    const [left] = await db.select().from(workoutSet).where(eq(workoutSet.id, ids[1]));
    expect(left.position).toBe(0);

    const last = await deleteLoggedSet(ids[1]);
    expect(last.ok).toBe(false);
  });

  it("refuses a performed set that records nothing", async () => {
    const { ids } = await logged([{ weightKg: 50, reps: 5 }]);
    const res = await editLoggedSet(ids[0], {
      ...base,
      weightKg: 50,
      reps: 0,
      done: true,
    });
    expect(res.ok).toBe(false);
  });

  it("refuses someone else's set", async () => {
    const { ids, weId } = await logged([{ weightKg: 50, reps: 5 }]);
    actingUserId = otherId;
    try {
      const edit = await editLoggedSet(ids[0], {
        ...base,
        weightKg: 1,
        reps: 1,
        done: true,
      });
      expect(edit.ok).toBe(false);
      expect((await addLoggedSet(weId, { ...base, weightKg: 1, reps: 1 })).ok).toBe(
        false,
      );
      expect((await deleteLoggedSet(ids[0])).ok).toBe(false);
    } finally {
      actingUserId = userId;
    }
    const [row] = await db.select().from(workoutSet).where(eq(workoutSet.id, ids[0]));
    expect(row.weightKg).toBe(50);
  });
});
