import { describe, expect, it } from "vitest";
import {
  filterMatches,
  matchExercise,
  normalizeForMatch,
  rankMatches,
  wordSimilarity,
  INEXACT_CEIL,
  LITERAL_FLOOR,
  LOOSE_MIN_TOKEN_LEN,
  RECENT_BONUS,
  TYPO_THRESHOLD,
  type MatchRange,
} from "@/lib/exercise-match";
import { tokenizeQuery } from "@/lib/exercise-search-terms";
import { SEED_EXERCISES, popularityOf } from "@/lib/db/seed-data";

/**
 * The matcher behind exercise search, against the **real** library.
 *
 * No database: `SEED_EXERCISES` is the same hand-authored list the seed writes,
 * and the matcher is pure, so every ranking claim below is a claim about the
 * 249 names actually shipped rather than about a fixture chosen to make the
 * assertion pass. That is the point — the bug this replaces ("incline dumbbell"
 * matching nothing) was a property of the real names.
 */

const LIB = SEED_EXERCISES.map((e) => ({
  id: e.slug,
  name: e.name,
  equipment: e.equipment as string,
  primaryMuscle: e.primaryMuscle as string,
  popularity: popularityOf(e.slug),
}));

/** Ranked names for a typed query, exactly as the query layer asks for them. */
function search(query: string, limit?: number) {
  return rankMatches(tokenizeQuery(query), LIB, { limit }).map((s) => s.row.name);
}

function scoreOf(query: string, name: string) {
  const hit = rankMatches(tokenizeQuery(query), LIB).find(
    (s) => s.row.name === name,
  );
  return hit?.match.score ?? null;
}

/** What the highlight would bold, as substrings. */
function highlighted(query: string, name: string) {
  const row = LIB.find((e) => e.name === name)!;
  const match = matchExercise(tokenizeQuery(query), row);
  return match?.ranges.map(([s, e]) => name.slice(s, e)) ?? null;
}

describe("normalisation", () => {
  it("never changes the length, so offsets stay valid", () => {
    // Every range this module emits indexes the original name. A fold that
    // added or dropped a character — which NFD does — would slide every
    // highlight after it onto the wrong letters.
    for (const e of LIB) {
      expect(normalizeForMatch(e.name), e.name).toHaveLength(e.name.length);
    }
    expect(normalizeForMatch("Bench Press (Barbell)")).toBe(
      "bench press (barbell)",
    );
    expect(normalizeForMatch("Café Row")).toBe("cafe row");
    expect(normalizeForMatch("İstanbul")).toHaveLength("İstanbul".length);
  });
});

describe("word similarity", () => {
  it("scores the common typos above the threshold and nonsense below it", () => {
    // A transposition destroys the bigrams either side of it, which is why the
    // threshold is 0.35 and not the 0.6 a trigram index defaults to.
    expect(wordSimilarity("incilne", "incline")).toBeGreaterThan(TYPO_THRESHOLD);
    expect(wordSimilarity("dumbell", "dumbbell")).toBeGreaterThan(TYPO_THRESHOLD);
    expect(wordSimilarity("bnech", "bench")).toBeGreaterThan(TYPO_THRESHOLD);
    expect(wordSimilarity("squatt", "squat")).toBeGreaterThan(TYPO_THRESHOLD);
    expect(wordSimilarity("zxqwerty", "incline")).toBeLessThan(TYPO_THRESHOLD);
    expect(wordSimilarity("bench", "bench")).toBe(1);
  });
});

describe("what matches", () => {
  it("matches tokens in any order and any position", () => {
    expect(search("incline dumbbell")).toContain(
      "Incline Bench Press (Dumbbell)",
    );
    // Across the parenthesis, which is what made the barbell bench press look
    // like it was missing from the library.
    for (const q of ["bench press barbell", "barbell bench press", "barbell bench"]) {
      expect(search(q), q).toContain("Bench Press (Barbell)");
    }
  });

  it("requires every token, not any of them", () => {
    // An OR would drag in every incline and every dumbbell movement.
    const both = rankMatches(tokenizeQuery("incline dumbbell"), LIB);
    expect(both.length).toBeGreaterThan(0);
    expect(both.map((s) => s.row.name)).not.toContain("Bench Press (Barbell)");
  });

  it("matches the equipment and muscle columns, not only the name", () => {
    // "Pec Deck" says neither word; it is a chest exercise on a machine.
    expect(search("chest machine")).toContain("Pec Deck");
  });

  it("finds the movement when a word is misspelled", () => {
    expect(search("incilne bench")[0]).toBe("Incline Bench Press (Barbell)");
    expect(search("dumbell curl").length).toBeGreaterThan(0);
    expect(search("bnech")[0]).toBe("Bench Press (Barbell)");
  });

  it("finds the movement from letters in order, with the gaps left out", () => {
    // The thing a LIKE could never do: no substring of these names contains
    // the query, and both are unambiguous to a reader.
    expect(search("latpull")[0]).toBe("Lat Pulldown (Cable)");
    expect(search("romaniandl")[0]).toBe("Romanian Deadlift (Barbell)");
  });

  it("returns nothing for a query that resembles nothing", () => {
    expect(search("zxqwerty")).toHaveLength(0);
  });

  it("treats punctuation as characters that simply aren't there", () => {
    // Previously this was about escaping `ILIKE` wildcards — unescaped, "%"
    // matched the whole library. There is no LIKE pattern left on this path;
    // "%" is one character, so it is below the loose-match floor and has to
    // appear literally, and "____" resembles no word.
    expect(search("%")).toHaveLength(0);
    expect(search("____")).toHaveLength(0);
  });

  it("holds short tokens to a literal match", () => {
    // Two letters as a subsequence is most of the library. Every hit for a
    // short token contains it outright.
    expect("ab".length).toBeLessThan(LOOSE_MIN_TOKEN_LEN);
    const hits = search("ab");
    expect(hits.length).toBeGreaterThan(0);
    for (const name of hits) {
      const row = LIB.find((e) => e.name === name)!;
      const hay = `${row.name} ${row.equipment} ${row.primaryMuscle}`.toLowerCase();
      expect(hay, name).toContain("ab");
    }
  });
});

describe("ranking", () => {
  it("leads with the exact match when the query is spelled correctly", () => {
    expect(search("bench press")[0]).toBe("Bench Press (Barbell)");
    expect(search("squat")[0]).toBe("Squat (Barbell)");
  });

  it("puts a word that contains the query above one that resembles it", () => {
    // "incilne" resembles "machine" closely enough to clear the threshold, so
    // the smith machine bench press is a legitimate hit — but "bench" opening
    // its name must not outweigh a near-perfect misspelling of "incline".
    const hits = search("incilne bench");
    expect(hits.indexOf("Incline Bench Press (Barbell)")).toBeLessThan(
      hits.indexOf("Bench Press (Smith Machine)"),
    );
  });

  it("sinks a scattered-letters match far below a real one", () => {
    // Strong shows both; the ranking is what makes showing both safe.
    const tight = matchExercise(["inclien"], {
      name: "Incline Bench Press (Barbell)",
      equipment: "barbell",
      primaryMuscle: "chest",
    })!;
    const spread = matchExercise(["inclien"], {
      name: "Standing Calf Raise (Machine)",
      equipment: "machine",
      primaryMuscle: "calves",
    })!;
    expect(spread.score).toBeGreaterThan(0);
    expect(spread.score).toBeLessThan(tight.score / 2);
  });

  it("breaks ties on popularity, then name, then id — a total order", () => {
    const once = rankMatches(tokenizeQuery("press"), LIB).map((s) => s.row.id);
    const shuffled = rankMatches(tokenizeQuery("press"), [...LIB].reverse()).map(
      (s) => s.row.id,
    );
    // Identical requests must produce identical order, or React keys shuffle.
    expect(shuffled).toEqual(once);
  });

  it("honours an explicit limit and defaults to none", () => {
    expect(search("press", 5)).toHaveLength(5);
    expect(search("press").length).toBeGreaterThan(5);
  });

  it("lifts a boosted row past its ties but never past a better match", () => {
    const boost = (row: { name: string }) =>
      row.name === "Incline Bench Press (Barbell)" ? 250 : 0;
    const ranked = rankMatches(tokenizeQuery("bench"), LIB, { boost });
    expect(ranked[0].row.name).toBe("Incline Bench Press (Barbell)");

    // The other half of it, as arithmetic rather than as an example: no boosted
    // resemblance can reach the weakest row that actually contains the word.
    expect(INEXACT_CEIL + RECENT_BONUS).toBeLessThan(LITERAL_FLOOR);
  });
});

describe("highlight ranges", () => {
  it("marks the token where it appears", () => {
    expect(highlighted("bench", "Incline Bench Press (Barbell)")).toEqual([
      "Bench",
    ]);
    expect(highlighted("bench barbell", "Bench Press (Barbell)")).toEqual([
      "Bench",
      "Barbell",
    ]);
  });

  it("marks the whole word behind a misspelling", () => {
    // There is no honest per-character alignment for "this is the word you
    // meant" — bolding a subset would claim a precision the match lacks.
    expect(highlighted("incilne", "Incline Bench Press (Barbell)")).toEqual([
      "Incline",
    ]);
  });

  it("marks the runs of a subsequence", () => {
    expect(highlighted("latpull", "Lat Pulldown (Cable)")).toEqual([
      "Lat",
      "Pull",
    ]);
  });

  it("leaves a secondary-column match unhighlighted", () => {
    // "machine" is the equipment, not part of "Pec Deck" — nothing in the name
    // can honestly light up.
    expect(highlighted("chest machine", "Pec Deck")).toEqual([]);
  });

  it("is in bounds, ascending and non-overlapping for every match", () => {
    const queries = [
      "bench",
      "incline dumbbell",
      "incilne bench",
      "dumbell curl",
      "latpull",
      "chest machine",
      "press",
      "squatt",
      "bench barbell bench",
      "romaniandl",
    ];
    let checked = 0;
    for (const q of queries) {
      for (const { row, match } of rankMatches(tokenizeQuery(q), LIB)) {
        let previousEnd = -1;
        for (const [start, end] of match.ranges as MatchRange[]) {
          expect(start, `${q} / ${row.name}`).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(row.name.length);
          expect(start).toBeLessThan(end);
          // Strictly after the previous range, and never merely touching it —
          // adjacent ranges would render as two spans with a visible seam.
          expect(start).toBeGreaterThan(previousEnd);
          previousEnd = end;
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("filterMatches", () => {
  it("keeps the input order, so Recent stays sorted by recency", () => {
    // Deliberately not the ranked order: recency is that list's ordering, and
    // the matcher is only there to decide what belongs in it.
    const byRecency = [
      LIB.find((e) => e.name === "Incline Bench Press (Barbell)")!,
      LIB.find((e) => e.name === "Bench Press (Barbell)")!,
    ];
    expect(filterMatches(tokenizeQuery("bench"), byRecency).map((s) => s.row.name))
      .toEqual(["Incline Bench Press (Barbell)", "Bench Press (Barbell)"]);
  });

  it("agrees with the ranked list about what matches", () => {
    // The regression test for the three-groups-one-matcher rule: a row cannot
    // appear in the main list and be missing from Recent, or the other way.
    for (const q of ["bench", "incilne", "latpull", "zxqwerty"]) {
      const ranked = new Set(
        rankMatches(tokenizeQuery(q), LIB).map((s) => s.row.id),
      );
      const filtered = new Set(
        filterMatches(tokenizeQuery(q), LIB).map((s) => s.row.id),
      );
      expect(filtered, q).toEqual(ranked);
    }
  });
});

describe("an empty query", () => {
  it("matches everything with no ranges", () => {
    // The browse path never calls the matcher, but nothing should blow up if a
    // caller passes no tokens — it means "don't constrain", as it always has.
    const match = matchExercise([], LIB[0]);
    expect(match).toEqual({ score: 0, ranges: [] });
    expect(scoreOf("", LIB[0].name)).toBe(0);
  });
});
