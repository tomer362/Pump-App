/**
 * Turning what someone typed into exercise-search terms.
 *
 * Pure, so `tests/pure.test.ts` can hold it — same reason `lib/day.ts` is its
 * own module. The SQL that consumes these lives in `lib/queries/exercise.ts`.
 *
 * The library names every movement `<Movement> (<Equipment>)`, which is what
 * made the old single `ILIKE '%<whole query>%'` so bad at its job: "incline
 * dumbbell" and "bench press barbell" both describe exactly one exercise and
 * both matched nothing, because the words are never adjacent in the name. So
 * the query is split and every token has to match *somewhere*, in any order.
 */

/**
 * Neutralise the wildcards in a user-supplied `ILIKE` pattern.
 *
 * Backslash first, or it would double-escape the ones added after it. Without
 * this a search for "%" matched the entire library and "_" matched everything
 * with at least one character — not dangerous (the pattern is still a bound
 * parameter, never interpolated), just wrong.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * How many tokens one query may contribute. Each one becomes its own OR-group
 * of comparisons across three columns, so an unbounded count lets a pasted
 * paragraph build a predicate that costs real time on a scale-to-zero
 * database. Nobody narrows a 249-row library with a seventh word.
 */
export const MAX_QUERY_TOKENS = 6;

/**
 * Whitespace-separated words, in the order typed, capped and trimmed.
 * Returns `[]` for a blank query, which callers read as "no name filter".
 */
export function tokenizeQuery(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_TOKENS);
}

/**
 * Trigram similarity a token needs against a name before it counts as a
 * near-miss for the same word.
 *
 * 0.35, which is lower than it looks. `word_similarity` scores a transposition
 * harshly — "incilne" against "Incline" is 0.375, because swapping two letters
 * destroys four of the five trigrams — so the usual 0.6 default rejects the
 * single most common kind of typo there is. Measured against the seeded
 * library, 0.35 catches "incilne", "dumbell", "deadlfit" and "squatt" while a
 * word that resembles nothing ("zxqwerty") still matches zero rows.
 */
export const FUZZY_THRESHOLD = 0.35;

/**
 * Shortest token that earns a fuzzy comparison. Below four characters a
 * trigram score stops meaning "did you misspell this" and starts meaning "does
 * this share two letters with anything", which is most of the library.
 */
export const FUZZY_MIN_TOKEN_LEN = 4;
