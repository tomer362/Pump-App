import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLifetimeStats } from "@/lib/queries/stats";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

/**
 * `getLifetimeStats`'s streak logic had no test at any layer that crosses the
 * real database. The pure `streaks()` unit test (tests/pure.test.ts) builds
 * `Date`s directly and never touches Postgres, so it can't catch a mismatch
 * between what a driver actually returns for a `DATE` column and what this
 * query assumes.
 *
 * That mismatch looked real on inspection — `db.execute<{ day: string }>`
 * declares a string, but `pg-types`' own default parser turns a `DATE` column
 * into a `Date` object, and `row.day + "T00:00:00"` would silently stringify
 * that into `Invalid Date`. It is NOT real here, though: drizzle's
 * node-postgres and neon-serverless drivers both explicitly override the type
 * parser for DATE/TIMESTAMP/TIMESTAMPTZ back to raw strings
 * (`node_modules/drizzle-orm/{node-postgres,neon-serverless}/session.js`), on
 * purpose, so drizzle's own `mode: "string" | "date"` column options stay in
 * control. `db.execute` inherits that override, so `row.day` genuinely is a
 * string here — this test confirmed that directly by running with and
 * without an explicit `::text` cast and getting the same, correct answer
 * either way.
 *
 * The test earns its place anyway: this logic is exactly the kind of thing
 * that silently breaks if a driver or a drizzle version ever changes that
 * default, and nothing was watching for it.
 */
describe("getLifetimeStats — currentStreak across a real Postgres round-trip", () => {
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    userId = await makeUser();
    exerciseId = await makeExercise();
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  it("counts three consecutive training days as a streak of 3", async () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000);
    const dayBefore = new Date(today.getTime() - 2 * 86_400_000);

    await makeFinishedWorkout(userId, exerciseId, [{ weightKg: 60, reps: 5 }], dayBefore);
    await makeFinishedWorkout(userId, exerciseId, [{ weightKg: 60, reps: 5 }], yesterday);
    await makeFinishedWorkout(userId, exerciseId, [{ weightKg: 60, reps: 5 }], today);

    const stats = await getLifetimeStats(userId);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });
});
