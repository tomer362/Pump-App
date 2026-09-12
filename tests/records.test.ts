import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workout } from "@/lib/db/schema";
import { recalculatePersonalRecords } from "@/lib/records";
import {
  cleanup,
  makeExercise,
  makeFinishedWorkout,
  makeUser,
  recordsFor,
} from "./helpers";

/**
 * The bug: `personal_record` holds one row per (user, exercise, kind), so a new
 * best overwrites the old one — there is no history to fall back to. The row
 * cascades away with the workout that set it, and before the fix nothing
 * recomputed, so deleting your best session left the record at *nothing* while
 * other workouts kept stale PR badges.
 */
describe("recalculatePersonalRecords", () => {
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    userId = await makeUser();
    exerciseId = await makeExercise();
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  it("falls back to the previous best when the record-setting workout goes", async () => {
    const older = await makeFinishedWorkout(
      userId,
      exerciseId,
      [{ weightKg: 100, reps: 5 }],
      new Date("2026-06-01T10:00:00Z"),
    );
    const best = await makeFinishedWorkout(
      userId,
      exerciseId,
      [{ weightKg: 120, reps: 5 }],
      new Date("2026-06-08T10:00:00Z"),
    );

    await db.transaction(async (tx) => {
      await recalculatePersonalRecords(tx, userId, [exerciseId]);
    });

    let records = await recordsFor(userId, exerciseId);
    expect(records.get("weight")?.value).toBeCloseTo(120, 5);
    expect(records.get("weight")?.workoutId).toBe(best.workoutId);

    // Delete the session that holds the record.
    await db.delete(workout).where(eq(workout.id, best.workoutId));
    await db.transaction(async (tx) => {
      await recalculatePersonalRecords(tx, userId, [exerciseId]);
    });

    records = await recordsFor(userId, exerciseId);
    // Not gone — reverted to what actually remains in the history.
    expect(records.get("weight")?.value).toBeCloseTo(100, 5);
    expect(records.get("weight")?.workoutId).toBe(older.workoutId);
    expect(records.get("1rm")?.value).toBeCloseTo(100 * (1 + 5 / 30), 4);
  });

  it("excludes warm-ups, which would otherwise set records", async () => {
    const heavyWarmup = await makeExercise();
    await makeFinishedWorkout(
      userId,
      heavyWarmup,
      [
        { weightKg: 200, reps: 1, warmup: true },
        { weightKg: 80, reps: 8 },
      ],
      new Date("2026-06-15T10:00:00Z"),
    );

    await db.transaction(async (tx) => {
      await recalculatePersonalRecords(tx, userId, [heavyWarmup]);
    });

    const records = await recordsFor(userId, heavyWarmup);
    expect(records.get("weight")?.value).toBeCloseTo(80, 5);
    await cleanup([], [heavyWarmup]);
  });

  it("leaves no record at all when every qualifying set is gone", async () => {
    const orphan = await makeExercise();
    const w = await makeFinishedWorkout(
      userId,
      orphan,
      [{ weightKg: 60, reps: 5 }],
      new Date("2026-06-20T10:00:00Z"),
    );
    await db.transaction(async (tx) => {
      await recalculatePersonalRecords(tx, userId, [orphan]);
    });
    expect((await recordsFor(userId, orphan)).size).toBeGreaterThan(0);

    await db.delete(workout).where(eq(workout.id, w.workoutId));
    await db.transaction(async (tx) => {
      await recalculatePersonalRecords(tx, userId, [orphan]);
    });
    expect((await recordsFor(userId, orphan)).size).toBe(0);
    await cleanup([], [orphan]);
  });

  it("resyncs prCount on workouts that kept a stale badge", async () => {
    const ex = await makeExercise();
    const w = await makeFinishedWorkout(
      userId,
      ex,
      [{ weightKg: 90, reps: 3 }],
      new Date("2026-06-25T10:00:00Z"),
    );
    // Pretend the workout claimed records it no longer holds.
    await db
      .update(workout)
      .set({ prCount: 7 })
      .where(eq(workout.id, w.workoutId));

    await db.transaction(async (tx) => {
      await recalculatePersonalRecords(tx, userId, [ex]);
    });

    const [row] = await db
      .select({ prCount: workout.prCount })
      .from(workout)
      .where(eq(workout.id, w.workoutId));
    // One 1RM record, so exactly one badge.
    expect(row.prCount).toBe(1);
    await cleanup([], [ex]);
  });
});

describe("recalculatePersonalRecords ties", () => {
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    userId = await makeUser();
    exerciseId = await makeExercise();
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  it("gives an equal best to the earlier session, every time", async () => {
    const older = await makeFinishedWorkout(
      userId,
      exerciseId,
      [{ weightKg: 80, reps: 5 }],
      new Date("2026-04-01T10:00:00Z"),
    );
    await makeFinishedWorkout(
      userId,
      exerciseId,
      [{ weightKg: 80, reps: 5 }],
      new Date("2026-04-08T10:00:00Z"),
    );

    // Without a tiebreak DISTINCT ON picked whichever row the scan met first,
    // so the PR badge could move between two rebuilds of the same data.
    for (let i = 0; i < 3; i++) {
      await db.transaction((tx) =>
        recalculatePersonalRecords(tx, userId, [exerciseId]),
      );
      const records = await recordsFor(userId, exerciseId);
      expect(records.get("1rm")?.workoutId).toBe(older.workoutId);
      expect(records.get("weight")?.workoutId).toBe(older.workoutId);
    }

    const [olderRow] = await db
      .select({ prCount: workout.prCount })
      .from(workout)
      .where(eq(workout.id, older.workoutId));
    expect(olderRow.prCount).toBe(1);
  });
});
