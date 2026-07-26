/**
 * Page sizes for the cursor-paginated lists. Kept out of the `"use server"`
 * module because such a module may only export async functions — and out of
 * the client components, because the first page is rendered on the server and
 * both halves have to agree on when there's more to fetch.
 */
export const FEED_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE = 30;
