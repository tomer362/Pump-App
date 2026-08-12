/**
 * Scoring one exercise against what somebody typed.
 *
 * Pure and dependency-free, so `tests/exercise-match.test.ts` can hold the
 * whole of it without a database — same reason `lib/day.ts` and
 * `lib/exercise-search-terms.ts` are their own modules. The SQL that feeds it
 * candidates lives in `lib/queries/exercise.ts`.
 *
 * **Why this isn't SQL.** Matching used to be an `ILIKE` predicate with a
 * pg_trgm `word_similarity` rescue behind it, which got the right rows back and
 * could do nothing with them: a `WHERE` clause answers yes or no, so the list
 * came out ordered by popularity whatever the query was, and a near-miss could
 * sit above an exact match. It also cannot hand back character offsets, and
 * highlighting the matched letters is most of what makes a fuzzy list readable
 * — without it, a row that matched on scattered letters looks like a bug.
 * Ranking and offsets both need a score per row, so the scoring moved here and
 * the database went back to the structural filters it is good at. The pool is a
 * few hundred rows; scoring it costs less than the round trip that fetched it.
 */

/** Half-open `[start, end)` character offsets into the **original** name. */
export type MatchRange = [start: number, end: number];

export type Match = {
  score: number;
  /**
   * What to highlight, ascending and non-overlapping. Name matches only — the
   * name is the one string rendered next to the query, so an equipment-column
   * hit scores and ranks but lights nothing up.
   */
  ranges: MatchRange[];
};

export type MatchFields = {
  name: string;
  equipment: string;
  primaryMuscle: string;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Shortest token allowed to match loosely. Below four characters a subsequence
 * or a trigram score stops meaning "did you misspell this" and starts meaning
 * "does this share two letters with anything", which is most of the library —
 * so short tokens must appear literally.
 */
export const LOOSE_MIN_TOKEN_LEN = 4;

/**
 * Bigram overlap a token needs against a single word before it counts as a
 * misspelling of it.
 *
 * 0.35, which is lower than it looks, and the figure the pg_trgm predicate this
 * replaces was tuned to. A transposition destroys most of the bigrams either
 * side of it — "incilne" against "incline" scores 0.5, "bnech" against "bench"
 * 0.44 — so the usual 0.6 default rejects the single most common kind of typo
 * there is. Measured against the seeded library, 0.35 catches "incilne",
 * "dumbell", "deadlfit" and "squatt" while a word that resembles nothing
 * ("zxqwerty") still matches nothing.
 */
export const TYPO_THRESHOLD = 0.35;

/**
 * Score bands, in descending order of how much the match tells us.
 *
 * The gap between the bands is wide and the gap *within* the literal band is
 * narrow, and both halves of that matter. Wide between: no amount of
 * subsequence bonus may lift a scattered-letters match above a row that
 * contains the word. Narrow within: where in a name a word sits is the weakest
 * thing we know about it, so it must never outweigh how well the *other* token
 * matched. Positional spread of 200 put "Bench Press (Smith Machine)" above
 * "Incline Bench Press (Barbell)" for "incilne bench" — "bench" opens the one
 * and not the other, by more than the difference between a near-perfect
 * misspelling of "incline" and a coincidental resemblance to "machine".
 */
const SCORE_PREFIX = 900; // token opens the string
const SCORE_WORD_START = 850; // token opens a word inside it
const SCORE_SUBSTRING = 700; // token appears somewhere
const SCORE_SUBSEQ_BASE = 120; // letters in order, spread out
const SCORE_SUBSEQ_CAP = 450; // …never reaching a real substring
const SUBSEQ_RUN_BONUS = 40; // per character continuing a run
const SUBSEQ_WORD_BONUS = 30; // per character landing on a word start
const SCORE_TYPO_BASE = 100; // resembles a word without containing it
const SCORE_TYPO_RANGE = 300;

/**
 * The seam between "contains what you typed" and "doesn't". Exported so the
 * one rule that depends on the gap — a boost may never carry an inexact match
 * across it — can be asserted rather than asserted-about-in-a-comment.
 */
export const LITERAL_FLOOR = SCORE_SUBSTRING;
export const INEXACT_CEIL = Math.max(
  SCORE_SUBSEQ_CAP,
  SCORE_TYPO_BASE + SCORE_TYPO_RANGE,
);

/**
 * How much each column is worth. The name is what the user is reading; the
 * other two exist because the library writes equipment into the name in
 * parentheses and the muscle not at all, so "dumbbell chest" describes a shelf
 * of exercises whose names contain neither word in that arrangement.
 */
const WEIGHT = { name: 1, equipment: 0.5, primaryMuscle: 0.45 } as const;

/**
 * Floor under the average per-token score. Only ever excludes a match whose
 * every token is scattered across a very long name — the honest bottom of the
 * list is still in, because a loose match ranked last is information and a
 * missing row is not.
 */
const MIN_TOKEN_SCORE = 24;

/**
 * How much having trained something is worth, applied by the search action
 * rather than here — see `foldInRecent`.
 *
 * Strictly smaller than the gap between the literal bands and the inexact ones
 * (`LITERAL_FLOOR - INEXACT_CEIL`), so it can reorder two rows that both
 * contain what you typed and can never lift a row that merely resembles it
 * above one that does.
 */
export const RECENT_BONUS = 200;

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Lowercased and stripped of diacritics, **without changing the length**.
 *
 * Every offset this module produces indexes the original string, so a
 * normalisation that collapsed "é" into two code points — which a plain
 * `.normalize("NFD")` does — would slide every highlight after it. Characters
 * whose folded form isn't the same length are therefore left alone rather than
 * folded: matching "İ" imperfectly is a far smaller problem than bolding the
 * wrong letters.
 */
export function normalizeForMatch(text: string): string {
  let out = "";
  for (const ch of text) {
    const folded = ch
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    // Anything that isn't a one-for-one substitution is left as it was, so the
    // result is always the same length as the input and an offset into one is
    // an offset into the other.
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

/** Index 0, or preceded by something that isn't a letter or a digit. */
function isWordStart(hay: string, i: number): boolean {
  return i === 0 || !/[a-z0-9]/.test(hay[i - 1]);
}

/* -------------------------------------------------------------------------- */
/* The three ways a token can match one field                                  */
/* -------------------------------------------------------------------------- */

type Hit = { score: number; ranges: MatchRange[] };

/** Best literal occurrence: opening the string beats opening a word. */
function substringHit(token: string, hay: string): Hit | null {
  let at = hay.indexOf(token);
  if (at < 0) return null;
  if (at === 0) {
    return { score: SCORE_PREFIX, ranges: [[0, token.length]] };
  }
  // Prefer an occurrence that opens a word over one buried mid-word.
  for (let i = at; i >= 0; i = hay.indexOf(token, i + 1)) {
    if (isWordStart(hay, i)) {
      at = i;
      return { score: SCORE_WORD_START, ranges: [[at, at + token.length]] };
    }
  }
  return { score: SCORE_SUBSTRING, ranges: [[at, at + token.length]] };
}

/**
 * The letters, in order, with anything between them — what makes "Inclien"
 * find "Incline Bench Press" and, far below it, "Standing Calf Raise
 * (Machine)".
 *
 * Greedy forward to find whether it matches at all, then a backward tighten
 * that pulls each character as late as it can go. The tighten is what turns
 * "b…e…n…c…h" scattered over a long name into one consecutive run wherever the
 * name actually contains the word, which is the difference between a match that
 * scores well and one that reads as noise.
 *
 * The spread factor is the ranking: a token whose letters span the whole string
 * scores near the floor, one packed into a corner of it scores near the cap.
 */
function subsequenceHit(token: string, hay: string): Hit | null {
  const pos: number[] = [];
  let at = 0;
  for (const ch of token) {
    const found = hay.indexOf(ch, at);
    if (found < 0) return null;
    pos.push(found);
    at = found + 1;
  }

  for (let i = pos.length - 2; i >= 0; i--) {
    const latest = hay.lastIndexOf(token[i], pos[i + 1] - 1);
    if (latest > pos[i]) pos[i] = latest;
  }

  let runs = 0;
  let wordStarts = 0;
  for (let i = 0; i < pos.length; i++) {
    if (i > 0 && pos[i] === pos[i - 1] + 1) runs++;
    if (isWordStart(hay, pos[i])) wordStarts++;
  }

  const span = pos[pos.length - 1] - pos[0] + 1;
  const tightness = token.length / span;
  const raw =
    SCORE_SUBSEQ_BASE + runs * SUBSEQ_RUN_BONUS + wordStarts * SUBSEQ_WORD_BONUS;

  return {
    score: Math.min(SCORE_SUBSEQ_CAP, raw * tightness),
    ranges: mergeRanges(pos.map((p) => [p, p + 1] as MatchRange)),
  };
}

/** Padded-bigram Dice coefficient — the JS shape of pg_trgm's word comparison. */
function bigrams(word: string): string[] {
  const padded = ` ${word} `;
  const out: string[] = [];
  for (let i = 0; i < padded.length - 1; i++) out.push(padded.slice(i, i + 2));
  return out;
}

export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const left = bigrams(a);
  const right = bigrams(b);
  const pool = new Map<string, number>();
  for (const g of right) pool.set(g, (pool.get(g) ?? 0) + 1);
  let shared = 0;
  for (const g of left) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      shared++;
      pool.set(g, n - 1);
    }
  }
  return (2 * shared) / (left.length + right.length);
}

/**
 * A misspelling of one of the words in the field — the case a subsequence can't
 * reach, because a transposition puts the letters out of order.
 *
 * Highlights the whole word it resembles: there are no per-character offsets to
 * report when the claim is "this looks like that", and bolding an arbitrary
 * subset of the letters would suggest a precision the match doesn't have.
 */
function typoHit(token: string, hay: string): Hit | null {
  let best = 0;
  let bestRange: MatchRange | null = null;
  const word = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = word.exec(hay))) {
    const sim = wordSimilarity(token, m[0]);
    if (sim > best) {
      best = sim;
      bestRange = [m.index, m.index + m[0].length];
    }
  }
  if (!bestRange || best < TYPO_THRESHOLD) return null;
  const scaled = (best - TYPO_THRESHOLD) / (1 - TYPO_THRESHOLD);
  return {
    score: SCORE_TYPO_BASE + scaled * SCORE_TYPO_RANGE,
    ranges: [bestRange],
  };
}

function bestHit(token: string, hay: string): Hit | null {
  const literal = substringHit(token, hay);
  if (literal) return literal;
  if (token.length < LOOSE_MIN_TOKEN_LEN) return null;

  const loose = [subsequenceHit(token, hay), typoHit(token, hay)].filter(
    (h): h is Hit => h != null,
  );
  if (loose.length === 0) return null;
  return loose.reduce((a, b) => (b.score > a.score ? b : a));
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  if (ranges.length < 2) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: MatchRange[] = [sorted[0]];
  for (const [start, end] of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* One exercise                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Score one row against a tokenised query, or `null` when it isn't a match.
 *
 * Every token has to match *something* and a token may match in any of the
 * three fields — AND across tokens, OR within one. Order is not significant:
 * it is a search box, not a phrase, and "barbell bench" has to find the bench
 * press as surely as "bench barbell" does.
 */
export function matchExercise(
  tokens: string[],
  fields: MatchFields,
): Match | null {
  if (tokens.length === 0) return { score: 0, ranges: [] };

  const hay = {
    name: normalizeForMatch(fields.name),
    equipment: normalizeForMatch(fields.equipment),
    primaryMuscle: normalizeForMatch(fields.primaryMuscle),
  };

  let total = 0;
  const ranges: MatchRange[] = [];

  for (const raw of tokens) {
    const token = normalizeForMatch(raw);
    let best = 0;
    let bestRanges: MatchRange[] | null = null;

    for (const field of ["name", "equipment", "primaryMuscle"] as const) {
      const hit = bestHit(token, hay[field]);
      if (!hit) continue;
      const weighted = hit.score * WEIGHT[field];
      if (weighted > best) {
        best = weighted;
        // Only the name is rendered against the query, so it is the only
        // field whose offsets mean anything to the reader.
        bestRanges = field === "name" ? hit.ranges : [];
      }
    }

    // One token nobody can account for is a miss, however well the rest did.
    if (!bestRanges) return null;
    total += best;
    ranges.push(...bestRanges);
  }

  if (total / tokens.length < MIN_TOKEN_SCORE) return null;
  return { score: total, ranges: mergeRanges(ranges) };
}

/* -------------------------------------------------------------------------- */
/* A list of them                                                              */
/* -------------------------------------------------------------------------- */

export type Rankable = MatchFields & { id: string; popularity: number };

/**
 * The matcher used as a predicate: which rows match, in the order they came in.
 *
 * "Recent" is the caller this exists for. Recency *is* that list's ordering —
 * re-sorting it by relevance would answer a question nobody asked — but it
 * still has to agree with the main list about what the query matches, and it
 * still wants the ranges so its rows highlight like every other row.
 */
export function filterMatches<T extends Rankable>(
  tokens: string[],
  rows: T[],
  boost?: (row: T) => number,
): { row: T; match: Match }[] {
  const out: { row: T; match: Match }[] = [];
  for (const row of rows) {
    const match = matchExercise(tokens, row);
    if (!match) continue;
    const lift = boost?.(row) ?? 0;
    out.push(lift ? { row, match: { ...match, score: match.score + lift } } : { row, match });
  }
  return out;
}

/**
 * Match a candidate pool and put the best first.
 *
 * Ties break on popularity, then name, then id — the same triple the unsearched
 * library is ordered by, so a query that can't tell two rows apart leaves them
 * in the order the user would have seen without it.
 */
export function rankMatches<T extends Rankable>(
  tokens: string[],
  rows: T[],
  { limit, boost }: { limit?: number; boost?: (row: T) => number } = {},
): { row: T; match: Match }[] {
  const scored = filterMatches(tokens, rows, boost);

  scored.sort(
    (a, b) =>
      b.match.score - a.match.score ||
      b.row.popularity - a.row.popularity ||
      a.row.name.localeCompare(b.row.name) ||
      (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0),
  );

  return limit == null ? scored : scored.slice(0, limit);
}
