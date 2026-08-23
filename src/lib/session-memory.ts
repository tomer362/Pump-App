/* -------------------------------------------------------------------------- *
 * Small per-tab memories: the rows a list had loaded, the filters a search box
 * was set to, which tab of a page you were reading.
 *
 * `sessionStorage`, never `localStorage`. All of it answers "where was I a
 * minute ago" — a search query from three days ago is noise, and cached rows
 * with an unbounded lifetime are stale data pretending to be fresh.
 * -------------------------------------------------------------------------- */

export const LIST_STORAGE_PREFIX = "pump.list.";
export const UI_STORAGE_PREFIX = "pump.ui.";

/** sessionStorage is a few MB in total and the scroll offsets share it. */
export const MAX_SNAPSHOT_BYTES = 150_000;

export function readSession<T>(
  key: string,
  revive: (value: unknown) => T | null,
): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return revive(JSON.parse(raw));
  } catch {
    // Private mode, or a value some other version of the app wrote.
    return null;
  }
}

/** Refuses to store an oversized value rather than truncating it. */
export function writeSession(
  key: string,
  value: unknown,
  maxBytes: number = MAX_SNAPSHOT_BYTES,
) {
  try {
    const raw = JSON.stringify(value);
    if (raw.length > maxBytes) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, raw);
  } catch {
    // Quota: drop the cached rows rather than the scroll offsets, which are
    // numbers and are the half of this that always works.
    clearByPrefix(LIST_STORAGE_PREFIX);
  }
}

export function clearByPrefix(prefix: string) {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(prefix)) doomed.push(key);
    }
    for (const key of doomed) window.sessionStorage.removeItem(key);
  } catch {
    /* Nothing to clear if storage is refusing us anyway. */
  }
}

/* -------------------------------------------------------------------------- *
 * Reading through `useSyncExternalStore`.
 *
 * A stored value can't be seeded with a `useState` initialiser — the first
 * client render has to match the server HTML or React discards the subtree,
 * which on a restored list is the very thing being restored. The store shape
 * gets it right by construction (a `null` server snapshot, the real value read
 * straight after subscribing), and it is what the rest of the app already does
 * for `sessionStorage`. `getSnapshot` has to be referentially stable, hence
 * the cache.
 * -------------------------------------------------------------------------- */

const cache = new Map<string, unknown>();

export function cachedSession<T>(
  key: string,
  revive: (value: unknown) => T | null,
): T | null {
  if (!cache.has(key)) cache.set(key, readSession(key, revive));
  return cache.get(key) as T | null;
}

/** Keeps the cache honest when this tab is the one doing the writing. */
export function cacheSession<T>(key: string, value: T) {
  cache.set(key, value);
}

/** Nothing here changes under a mounted component — only navigation does. */
export function subscribeNever() {
  return () => {};
}

/** Sign-out: these hold one account's rows, searches and reading positions. */
export function clearSessionMemory() {
  cache.clear();
  clearByPrefix(LIST_STORAGE_PREFIX);
  clearByPrefix(UI_STORAGE_PREFIX);
}
