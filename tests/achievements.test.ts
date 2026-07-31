import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { achievement } from "@/lib/db/schema";
import { grantAchievements } from "@/lib/actions/achievements";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

/**
 * `finishWorkout` commits its transaction and only then calls
 * `grantAchievements`, uncaught. `ON CONFLICT DO NOTHING` on the
 * `userAchievement` insert suppresses a duplicate-row conflict, not a
 * foreign-key violation — verified directly against the database — so on a
 * database missing an achievement row (a fresh, unseeded deploy is the real
 * case; here it's simulated by removing exactly one seeded row and restoring
 * it after), the very first workout a user finishes threw *after* saving,
 * which read to the user as the save having failed.
 *
 * This deletes and restores a single real seed row rather than touching the
 * whole table, so it can't leave the shared dev database without an
 * achievement other tests or a running `pnpm dev` depend on.
 */
describe("grantAchievements never throws back into its caller", () => {
  let userId: string;
  let exerciseId: string;
  let savedRow: typeof achievement.$inferSelect | null = null;

  beforeAll(async () => {
    userId = await makeUser();
    exerciseId = await makeExercise();
  });

  afterEach(async () => {
    if (savedRow) {
      await db.insert(achievement).values(savedRow).onConflictDoNothing();
      savedRow = null;
    }
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  it("swallows a foreign-key violation instead of throwing", async () => {
    const [row] = await db
      .select()
      .from(achievement)
      .where(eq(achievement.key, "first_workout"))
      .limit(1);
    expect(row, "seed data must include first_workout for this test to mean anything").toBeTruthy();
    savedRow = row;

    // Finishing a workout on a database missing this row is exactly what an
    // unseeded deploy looks like.
    await db.delete(achievement).where(eq(achievement.key, "first_workout"));
    await makeFinishedWorkout(userId, exerciseId, [{ weightKg: 60, reps: 5 }]);

    const result = await grantAchievements(userId, {
      finishedWorkoutAt: new Date(),
    });
    // Degrades to no badges rather than throwing — the workout itself, saved
    // moments earlier by the caller, is unaffected either way.
    expect(result).toEqual([]);
  });
});
