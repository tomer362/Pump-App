import { afterAll, describe, expect, it } from "vitest";
import {
  getRecentExercises,
  searchExercisePage,
  searchExercises,
  type ExerciseListItem,
} from "@/lib/queries/exercise";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

/**
 * Batched loading of the exercise library, against the real database.
 *
 * The property that matters is the one a mock can't show: that walking the
 * keyset cursor visits every row exactly once. A cursor on `name` alone would
 * either skip or loop on the twin whenever two exercises share a name — which
 * they do, because a user may name a custom exercise after a built-in — and
 * the symptom is one missing row several batches into a scroll, which is
 * exactly the kind of thing nobody notices by hand.
 */

const users: string[] = [];
const exercises: string[] = [];

afterAll(() => cleanup(users, exercises));

const DAY = 86_400_000;

async function pageThrough(userId: string, limit: number) {
  const all: ExerciseListItem[] = [];
  let after = null as Awaited<ReturnType<typeof searchExercisePage>>["cursor"];
  // Bounded so a cursor that fails to advance fails the test rather than
  // hanging the suite.
  for (let i = 0; i < 500; i++) {
    const page = await searchExercisePage(userId, { after, limit });
    all.push(...page.items);
    if (!page.cursor) return all;
    after = page.cursor;
  }
  throw new Error("cursor never exhausted");
}

describe("keyset paging over the library", () => {
  it("visits every exercise exactly once, in the same order as a full read", async () => {
    const userId = await makeUser();
    users.push(userId);
    // Two rows sharing a name — the case the id tiebreak in the cursor exists
    // for. Both are visible to this user.
    const name = `Zz Paging Twin ${Date.now()}`;
    exercises.push(await makeExercise(name), await makeExercise(name));

    const batched = await pageThrough(userId, 7);
    const full = await searchExercises(userId, { limit: 5000 });

    expect(batched.map((e) => e.id)).toEqual(full.map((e) => e.id));
    expect(new Set(batched.map((e) => e.id)).size).toBe(batched.length);
    expect(batched.filter((e) => e.name === name)).toHaveLength(2);
  });

  it("reports no cursor once the last batch is short", async () => {
    const userId = await makeUser();
    users.push(userId);

    const first = await searchExercisePage(userId, { limit: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.cursor).not.toBeNull();

    // A filter narrow enough to fit in one batch has nothing behind it.
    const narrow = await searchExercisePage(userId, {
      query: "no exercise is named this",
    });
    expect(narrow.items).toHaveLength(0);
    expect(narrow.cursor).toBeNull();
  });
});

describe("recent exercises", () => {
  it("returns only what this user logged, most recent first", async () => {
    const userId = await makeUser();
    users.push(userId);
    const older = await makeExercise();
    const newer = await makeExercise();
    exercises.push(older, newer);

    await makeFinishedWorkout(
      userId,
      older,
      [{ weightKg: 60, reps: 5 }],
      new Date(Date.now() - 3 * DAY),
    );
    await makeFinishedWorkout(userId, newer, [{ weightKg: 60, reps: 5 }]);

    const recent = await getRecentExercises(userId);

    expect(recent.map((e) => e.id)).toEqual([newer, older]);
    // The alphabetical batches leave this null; the recent group is the one
    // read that fills it in, and the picker's grouping depends on that.
    expect(recent[0].lastPerformedAt).toBeInstanceOf(Date);

    // Another user's history is not this user's recents.
    const stranger = await makeUser();
    users.push(stranger);
    expect(await getRecentExercises(stranger)).toHaveLength(0);
  });

  it("respects the same filters as the batches", async () => {
    const userId = await makeUser();
    users.push(userId);
    const ex = await makeExercise();
    exercises.push(ex);
    await makeFinishedWorkout(userId, ex, [{ weightKg: 60, reps: 5 }]);

    // makeExercise builds a chest/barbell lift.
    expect(await getRecentExercises(userId, { muscle: "back" })).toHaveLength(0);
    expect(
      (await getRecentExercises(userId, { muscle: "chest" })).map((e) => e.id),
    ).toContain(ex);
  });
});
