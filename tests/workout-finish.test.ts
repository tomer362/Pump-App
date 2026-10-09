import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";

/**
 * Finishing writes counters — `total_volume_kg`, `total_sets`, `total_reps`,
 * `pr_count` and the personal records — from the rows the workout has at that
 * moment. Two things used to break that agreement:
 *
 * - `updateSet`/`updateSets` wrote weight, reps and ticks into a workout that
 *   was already finished, so a write still in flight when Finish was tapped
 *   (or one from a second tab) left the counters describing rows that no
 *   longer existed. Only the effort rating may change after finish.
 * - `finishWorkout` checked `ended_at` and read the sets outside its
 *   transaction, so two finishes racing (a retry after a timeout, two
 *   devices) both went through. It now claims the row first, and a repeated
 *   finish answers with the stored summary instead of an error.
 *
 * Auth and cache revalidation are mocked — the subject is the writes.
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
const { workout, workoutSet, personalRecord, post } = await import("@/lib/db/schema");
const {
  startEmptyWorkout,
  addExercisesToWorkout,
  addSet,
  updateSet,
  updateSets,
  finishWorkout,
} = await import("@/lib/actions/workout");
const { cleanup, makeExercise, makeUser } = await import("./helpers");

describe("a finished workout's rows stay the ones it was counted from", () => {
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

  /** A live workout with three ticked 100 kg × 5 sets. */
  async function startLogged() {
    const started = await startEmptyWorkout();
    if (!started.ok || !started.data) throw new Error("could not start");
    const workoutId = started.data.workoutId;
    const added = await addExercisesToWorkout(workoutId, [exerciseId]);
    if (!added.ok || !added.data) throw new Error("could not add");
    const blockId = added.data.added[0].id;
    for (let i = 0; i < 2; i++) {
      const res = await addSet(blockId);
      if (!res.ok) throw new Error(res.error);
    }
    const ids = (
      await db
        .select({ id: workoutSet.id })
        .from(workoutSet)
        .where(eq(workoutSet.workoutExerciseId, blockId))
        .orderBy(asc(workoutSet.position))
    ).map((r) => r.id);
    for (const id of ids) {
      const res = await updateSet(id, { weightKg: 100, reps: 5, completed: true });
      if (!res.ok) throw new Error(res.error);
    }
    return { workoutId, ids };
  }

  it("finishes once when two finishes race, and both report success", async () => {
    const { workoutId } = await startLogged();

    const [a, b] = await Promise.all([
      finishWorkout(workoutId, { shareToFeed: true }),
      finishWorkout(workoutId, { shareToFeed: true }),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.data!.totalSets).toBe(3);
    expect(b.data!.totalSets).toBe(3);
    expect(a.data!.totalVolumeKg).toBe(1500);
    expect(b.data!.totalVolumeKg).toBe(1500);
    // Only the call that really finished it announces the record.
    expect(a.data!.prs.length + b.data!.prs.length).toBe(1);

    const posts = await db.select().from(post).where(eq(post.workoutId, workoutId));
    expect(posts).toHaveLength(1);
    const records = await db
      .select()
      .from(personalRecord)
      .where(
        and(eq(personalRecord.userId, userId), eq(personalRecord.workoutId, workoutId)),
      );
    // One row per kind, not two.
    expect(new Set(records.map((r) => r.kind)).size).toBe(records.length);
  });

  it("answers a repeated finish with the stored summary", async () => {
    const { workoutId } = await startLogged();
    const first = await finishWorkout(workoutId);
    expect(first.ok).toBe(true);
    const again = await finishWorkout(workoutId);
    expect(again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.data!.totalSets).toBe(first.data!.totalSets);
    expect(again.data!.totalVolumeKg).toBe(first.data!.totalVolumeKg);
    expect(again.data!.prs).toEqual([]);
    expect(again.data!.unlockedAchievements).toEqual([]);
  });

  it("refuses scored set writes after finish, and still takes a rating", async () => {
    const { workoutId, ids } = await startLogged();
    const done = await finishWorkout(workoutId);
    expect(done.ok).toBe(true);

    const reps = await updateSet(ids[0], { reps: 50 });
    expect(reps.ok).toBe(false);
    const untick = await updateSet(ids[1], { completed: false });
    expect(untick.ok).toBe(false);
    const fill = await updateSets(ids, { weightKg: 300 });
    expect(fill.ok).toBe(false);

    const rated = await updateSet(ids[2], { rpe: 8 });
    expect(rated.ok).toBe(true);

    const rows = await db
      .select()
      .from(workoutSet)
      .where(eq(workoutSet.id, ids[0]));
    expect(rows[0].reps).toBe(5);
    expect(rows[0].weightKg).toBe(100);
    const [w] = await db.select().from(workout).where(eq(workout.id, workoutId));
    expect(w.totalVolumeKg).toBe(1500);
    expect(w.totalSets).toBe(3);
    const allSets = await db
      .select()
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, rows[0].workoutExerciseId));
    expect(allSets.every((s) => s.completedAt != null)).toBe(true);
    expect(allSets.reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0)).toBe(1500);
  });

  it("leaves the session live when there is nothing to count", async () => {
    const started = await startEmptyWorkout();
    if (!started.ok || !started.data) throw new Error("could not start");
    const res = await finishWorkout(started.data.workoutId);
    expect(res.ok).toBe(false);
    const [w] = await db
      .select()
      .from(workout)
      .where(eq(workout.id, started.data.workoutId));
    // The claim was rolled back with the transaction.
    expect(w.endedAt).toBeNull();
  });
});
