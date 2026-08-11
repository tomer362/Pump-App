/**
 * Turning what someone typed into exercise-search terms.
 *
 * Pure, so `tests/pure.test.ts` can hold it — same reason `lib/day.ts` is its
 * own module. What consumes these is `lib/exercise-match.ts`, which scores each
 * token, and the oversized-library fallback in `lib/queries/exercise.ts`, which
 * is the only thing left that builds a LIKE pattern out of one.
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
 * Only the oversized-library fallback still builds one, but that is exactly the
 * path nobody exercises by hand, so the escaping stays tested.
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
 * How many tokens one query may contribute. Each one is scored against three
 * fields of every candidate row, so an unbounded count lets a pasted paragraph
 * turn one keystroke into real work. Nobody narrows a 249-row library with a
 * seventh word.
 */
export const MAX_QUERY_TOKENS = 6;

/**
 * Whitespace-separated words, in the order typed, capped and trimmed.
 * Returns `[]` for a blank query, which callers read as "no name filter".
 */
export function tokenizeQuery(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_TOKENS);
}
