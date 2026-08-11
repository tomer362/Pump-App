/**
 * Page sizes for the cursor-paginated lists. Kept out of the `"use server"`
 * module because such a module may only export async functions — and out of
 * the client components, because the first page is rendered on the server and
 * both halves have to agree on when there's more to fetch.
 */
export const FEED_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE = 30;
export const DISCOVER_PAGE_SIZE = 20;

/**
 * The exercise library is a few hundred rows and every picker used to pull all
 * of them — one query with a correlated subquery per row, then that many DOM
 * nodes — before the sheet could show anything. It pages instead, and the page
 * is deliberately larger than the feed's: rows are two lines of text, the next
 * batch is fetched before the sentinel is on screen, and a page that doesn't
 * overfill a phone viewport just turns one slow load into six.
 */
export const EXERCISE_PAGE_SIZE = 40;

/**
 * "Recent" is the whole point of the picker's ordering, and it's what the old
 * fetch-everything-and-sort-in-JS shape existed to produce. It comes back as
 * its own small query now, so it never grows with the library.
 */
export const EXERCISE_RECENT_LIMIT = 12;

/**
 * A text search is one ranked block, not a paginated one: relevance is a
 * computed float, and a keyset cursor can only walk indexed columns. Sixty
 * two-line rows is around six phone screens of a few-hundred-row library —
 * past that nobody is scrolling, they are retyping.
 */
export const EXERCISE_RANKED_LIMIT = 60;

/**
 * How many candidate rows a text search will pull back to score in JS.
 *
 * The pool is the built-in library plus one user's own custom rows, so this is
 * headroom rather than a limit anybody reaches — a few hundred narrow rows is
 * one scan of a small table, and it buys ranking and highlight offsets that no
 * `WHERE` clause can produce. Past the cap the search falls back to the literal
 * `ILIKE` predicate and ranks whatever that returns: the one person with
 * thousands of custom exercises loses subsequence recall, not their search.
 */
export const EXERCISE_POOL_CAP = 1200;

/**
 * Recent rows fetched before the matcher filters them. Wider than
 * `EXERCISE_RECENT_LIMIT` because the twelve most recent are not necessarily
 * the twelve that match what is being typed. Still bounded by one person's
 * training history rather than by the library.
 */
export const EXERCISE_RECENT_POOL = 60;

/**
 * How many hidden imported exercises the inline reveal will offer before it
 * gives up counting and points at the Imported scope instead.
 *
 * Small on purpose. The reveal exists so a search that should have matched
 * something isn't a dead end — not as a second way to browse the library. In
 * practice nobody has 25 imported exercises matching one search; the cap is
 * what stops the hint from lying when someone does.
 */
export const IMPORTED_HINT_LIMIT = 25;
