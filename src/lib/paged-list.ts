/* -------------------------------------------------------------------------- *
 * The rows a list had already loaded.
 *
 * Restoring an offset is not enough on a list that paginates. `/feed`,
 * `/history` and Discover seed one server-rendered page into `useState`, so a
 * back navigation remounts them with 20 rows: the position the lifter left is
 * not merely forgotten, it is unreachable — there is no longer enough page to
 * scroll to.
 *
 * The rows are cached rather than re-fetched. Back is the most common gesture
 * in the app, and re-requesting four pages from a scale-to-zero database on
 * every press is exactly the spend `ui/load-more.tsx` refuses when it declines
 * to auto-load on a sentinel. The client already had these rows; keeping them
 * costs bytes and no round trip.
 *
 * Everything here is pure; `tests/paged-list.test.ts` holds it, and the
 * storage itself lives in `lib/session-memory.ts`.
 * -------------------------------------------------------------------------- */

import {
  LIST_STORAGE_PREFIX,
  cacheSession,
  cachedSession,
  writeSession,
} from "./session-memory";

/** Enough for several pages of any list here; past it the tail is dropped. */
export const MAX_SAVED_ITEMS = 200;

/* ----------------------------------- pure --------------------------------- */

export function listStorageKey(routeKey: string, name: string): string {
  return `${LIST_STORAGE_PREFIX}${routeKey}::${name}`;
}

/** Keeps the head: the offset being restored points into the rows read first. */
export function capItems<T>(items: T[], max: number = MAX_SAVED_ITEMS): T[] {
  return items.length <= max ? items : items.slice(0, max);
}

export function dedupeById<T>(items: T[], idOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = idOf(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/**
 * The snapshot wins only while it still agrees with the server about what is
 * at the top of the list. A post deleted, a workout logged since, a different
 * account — any of those shifts the leading ids, and then the fresh first page
 * is the truth and the cache is thrown away.
 */
export function mergeSaved<T>(
  initial: T[],
  saved: T[] | null,
  idOf: (item: T) => string,
): T[] {
  if (!saved || saved.length <= initial.length) return initial;
  for (let i = 0; i < initial.length; i++) {
    if (idOf(saved[i]!) !== idOf(initial[i]!)) return initial;
  }
  return saved;
}

/** A stored value is only a list if it is an array; anything else is noise. */
export function reviveList<T>(
  value: unknown,
  revive: (item: unknown) => T,
): T[] | null {
  return Array.isArray(value) ? value.map(revive) : null;
}

/* --------------------------------- impure --------------------------------- */

export function readList<T>(
  key: string,
  revive: (value: unknown) => T,
): T[] | null {
  return cachedSession(key, (value) => reviveList(value, revive));
}

export function writeList<T>(key: string, items: T[]) {
  const capped = capItems(items);
  cacheSession(key, capped);
  writeSession(key, capped);
}
