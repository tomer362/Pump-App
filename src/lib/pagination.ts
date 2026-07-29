/**
 * Page sizes for the cursor-paginated lists. Kept out of the `"use server"`
 * module because such a module may only export async functions — and out of
 * the client components, because the first page is rendered on the server and
 * both halves have to agree on when there's more to fetch.
 */
export const FEED_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE = 30;

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
