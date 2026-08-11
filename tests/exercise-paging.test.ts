import { afterAll, describe, expect, it } from "vitest";
import {
  getRecentExercises,
  searchExercisePage,
  searchExercises,
  type ExerciseListItem,
} from "@/lib/queries/exercise";
import { EXERCISE_RANKED_LIMIT } from "@/lib/pagination";
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
    // An OR would drag in every incline and every dumbbell movement. Matching
    // is loose now — "decline" is a plausible misspelling of "incline", and it
    // is in this list, ranked below the real ones — so the claim can no longer
    // be "every row literally says incline". It is that a row satisfying only
    // one of the two words is not a result at all.
    expect(both.length).toBeGreaterThan(0);
    const names = both.map((e) => e.name);
    expect(names).toContain("Incline Bench Press (Dumbbell)");
    expect(names).not.toContain("Bench Press (Barbell)");
    expect(names).not.toContain("Incline Push Up");
  });

  it("matches the equipment and muscle columns, not only the name", async () => {
    const userId = await makeUser();
    users.push(userId);

    // "Pec Deck" says neither word; it is a chest exercise on a machine.
    const hits = await searchExercises(userId, { query: "chest machine" });
    expect(hits.map((e) => e.name)).toContain("Pec Deck");
  });

  // Misspellings, subsequences and the ranking between them are covered
  // exhaustively and without a database in `exercise-match.test.ts`. What the
  // three below prove is the part only a real query can: that the ranked path
  // reaches that matcher instead of handing the text to SQL on the way past.
  it("leads with the exact match rather than rescuing after an empty pass", async () => {
    const userId = await makeUser();
    users.push(userId);

    // Spelling tolerance used to be a second query, run only when the literal
    // one came back with nothing — so a query that was fine never saw a
    // near-miss, and a query that wasn't got them in popularity order. There
    // is one pass now, and the ranking is what keeps the near-misses honest:
    // present, and strictly below anything that actually contains the words.
    const exact = await searchExercisePage(userId, { query: "bench press" });
    expect(exact.items[0]?.name).toBe("Bench Press (Barbell)");

    const typo = await searchExercisePage(userId, { query: "incilne bench" });
    expect(typo.items[0]?.name).toBe("Incline Bench Press (Barbell)");
  });

  it("carries the matched characters back with the row", async () => {
    const userId = await makeUser();
    users.push(userId);

    // The offsets the highlight draws. They come from the same alignment that
    // produced the rank, so a row cannot be ordered by one reading of the
    // query and bolded by another.
    const [first] = (await searchExercisePage(userId, { query: "bench" })).items;
    expect(first.matchRanges?.length).toBeGreaterThan(0);
    for (const [start, end] of first.matchRanges ?? []) {
      expect(first.name.slice(start, end).toLowerCase()).toBe("bench");
    }

    // …and nothing pays for them while browsing.
    const browsing = await searchExercisePage(userId, { limit: 3 });
    expect(browsing.items.every((e) => e.matchRanges === undefined)).toBe(true);
  });

  it("answers a text search as one ranked block, not a keyset walk", async () => {
    const userId = await makeUser();
    users.push(userId);

    // Relevance is a computed float; a keyset cursor can only walk indexed
    // columns. So a search is single-shot, and a cursor left over from the
    // batches loaded before the user started typing addresses a page of the
    // popularity ordering that has nothing to do with the query.
    const ranked = await searchExercisePage(userId, { query: "press" });
    expect(ranked.items.length).toBeGreaterThan(1);
    expect(ranked.items.length).toBeLessThanOrEqual(EXERCISE_RANKED_LIMIT);
    expect(ranked.cursor).toBeNull();

    const stale = await searchExercisePage(userId, { limit: 5 });
    expect(stale.cursor).not.toBeNull();
    const withQuery = await searchExercisePage(userId, {
      query: "press",
      after: stale.cursor,
    });
    expect(withQuery.items).toHaveLength(0);
  });

  it("honours an explicit limit past the ranked default", async () => {
    const userId = await makeUser();
    users.push(userId);

    // `searchExercises` and `check-queries` read the whole library in one go,
    // so the ranked block's default size must be a default and not a ceiling.
    const wide = await searchExercises(userId, { query: "barbell", limit: 500 });
    expect(wide.length).toBeGreaterThan(EXERCISE_RANKED_LIMIT);

    const capped = await searchExercisePage(userId, { query: "barbell" });
    expect(capped.items).toHaveLength(EXERCISE_RANKED_LIMIT);
  });

  it("treats punctuation as characters that aren't there", async () => {
    const userId = await makeUser();
    users.push(userId);

    // Unescaped, "%" matched the entire library. The reason it doesn't now is
    // a different one — there is no LIKE pattern on this path at all, and the
    // matcher holds a one-character token to a literal appearance — but
    // `escapeLike` still guards the oversized-library fallback, and its own
    // tests are in `pure.test.ts`.
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
