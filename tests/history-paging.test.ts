import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWorkoutHistory } from "@/lib/queries/workout";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

/**
 * The history and feed lists page on a keyset cursor. On the timestamp alone
 * a tie at the page boundary skipped the second row forever — and ties are
 * routine here, because every backdated quick log is stamped noon UTC. The
 * cursor now carries the id as well, so a boundary lands between two rows
 * however many share a timestamp.
 */
describe("history keyset paging", () => {
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    userId = await makeUser();
    exerciseId = await makeExercise();
    const sameMoment = new Date("2026-03-03T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await makeFinishedWorkout(userId, exerciseId, [{ weightKg: 50, reps: 5 }], sameMoment);
    }
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  it("neither repeats nor skips a row across a timestamp tie", async () => {
    const seen = new Set<string>();
    let cursor: { at: Date; id: string } | undefined;
    for (let page = 0; page < 10; page++) {
      const rows = await getWorkoutHistory(userId, { limit: 2, before: cursor });
      if (!rows.length) break;
      for (const r of rows) {
        expect(seen.has(r.id)).toBe(false);
        seen.add(r.id);
      }
      const last = rows[rows.length - 1];
      cursor = { at: last.startedAt, id: last.id };
    }
    expect(seen.size).toBe(5);
  });
});
