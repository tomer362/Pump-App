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

/**
 * What someone actually types into the picker.
 *
 * The library names every movement `<Movement> (<Equipment>)`, so the old
 * single `ILIKE '%<whole query>%'` could not match a query that mixed a
 * modifier with an equipment word — "incline dumbbell" and "bench press
 * barbell" each describe exactly one exercise and each returned nothing. That
 * is why these run against the seeded library rather than fixtures: the bug was
 * a property of the real names.
 */
describe("exercise search matching", () => {
  it("matches tokens in any order and any position", async () => {
    const userId = await makeUser();
    users.push(userId);

    const incline = await searchExercises(userId, { query: "incline dumbbell" });
    expect(incline.map((e) => e.name)).toContain("Incline Bench Press (Dumbbell)");

    // Across the parenthesis, which is what made the barbell bench press look
    // like it was missing from the library.
    for (const q of ["bench press barbell", "barbell bench press", "barbell bench"]) {
      const hits = await searchExercises(userId, { query: q });
      expect(hits.map((e) => e.name), q).toContain("Bench Press (Barbell)");
    }
  });

  it("requires every token, not any of them", async () => {
    const userId = await makeUser();
    users.push(userId);

    const both = await searchExercises(userId, { query: "incline dumbbell" });
    // An OR would drag in every incline and every dumbbell movement.
    expect(both.length).toBeGreaterThan(0);
    for (const e of both) {
      expect(e.name.toLowerCase(), e.name).toContain("incline");
    }
  });

  it("matches the equipment and muscle columns, not only the name", async () => {
    const userId = await makeUser();
    users.push(userId);

    // "Pec Deck" says neither word; it is a chest exercise on a machine.
    const hits = await searchExercises(userId, { query: "chest machine" });
    expect(hits.map((e) => e.name)).toContain("Pec Deck");
  });

  it("still finds the movement when a word is misspelled", async () => {
    const userId = await makeUser();
    users.push(userId);

    // A transposition, which scores worst of all typos under word_similarity
    // and is why the threshold is 0.35 rather than the 0.6 default.
    const typo = await searchExercises(userId, { query: "incilne bench" });
    expect(typo.map((e) => e.name)).toContain("Incline Bench Press (Barbell)");

    const dropped = await searchExercises(userId, { query: "dumbell curl" });
    expect(dropped.length).toBeGreaterThan(0);
  });

  it("only guesses when the literal search found nothing", async () => {
    const userId = await makeUser();
    users.push(userId);

    // "banana" resembles six real exercises closely enough to clear the
    // threshold, so a single widened pass would pour them in under every good
    // result. A spelled-correctly query must never reach the rescue.
    const exact = await searchExercisePage(userId, { query: "bench press" });
    expect(exact.items.length).toBeGreaterThan(0);
    expect(exact.fuzzy).toBe(false);

    const rescued = await searchExercisePage(userId, { query: "incilne" });
    expect(rescued.items.length).toBeGreaterThan(0);
    expect(rescued.fuzzy).toBe(true);
  });

  it("keeps paging in the pass that opened the search", async () => {
    const userId = await makeUser();
    users.push(userId);

    // A rescued search long enough to page. If page two re-decided the mode it
    // would run strictly, come back empty, and truncate the results.
    const first = await searchExercisePage(userId, { query: "dumbell", limit: 5 });
    expect(first.fuzzy).toBe(true);
    expect(first.cursor).not.toBeNull();

    const second = await searchExercisePage(userId, {
      query: "dumbell",
      limit: 5,
      after: first.cursor,
    });
    expect(second.items.length).toBeGreaterThan(0);
    expect(second.fuzzy).toBe(true);
    // And it advances rather than repeating the first batch.
    const firstIds = new Set(first.items.map((e) => e.id));
    expect(second.items.some((e) => firstIds.has(e.id))).toBe(false);
  });

  it("treats ILIKE wildcards as literal characters", async () => {
    const userId = await makeUser();
    users.push(userId);

    // Unescaped, "%" matched the entire library.
    const pct = await searchExercisePage(userId, { query: "%" });
    expect(pct.items).toHaveLength(0);
    const underscore = await searchExercisePage(userId, { query: "____" });
    expect(underscore.items).toHaveLength(0);
  });

  it("returns nothing for a query that resembles nothing", async () => {
    const userId = await makeUser();
    users.push(userId);
    const none = await searchExercises(userId, { query: "zxqwerty" });
    expect(none).toHaveLength(0);
  });
});
