/* -------------------------------------------------------------------------- *
 * Where you were on each screen.
 *
 * The document never scrolls: `body` is clipped and everything moves inside
 * one container in the root layout (`#app-scroll`). Both the browser's own
 * scroll restoration and Next's act on the *document* scroller, which here is
 * permanently at zero — so nothing was ever restored, and every back landed at
 * the top of the list you had just been reading.
 *
 * That invariant is now enforced rather than assumed —
 * `components/ui/document-scroll-guard.tsx` puts the document back to zero if
 * anything moves it — because when it slipped, every `sticky` and `fixed`
 * element in the app went above the top of the screen and stayed there.
 *
 * This module is the memory, plus the arithmetic for where to point the one
 * scroller; `components/ui/scroll-restoration.tsx` is the one thing that drives
 * the memory half. Everything above the `impure` divider is pure so
 * `tests/scroll-memory.test.ts` can hold it without a DOM.
 * -------------------------------------------------------------------------- */

export const SCROLL_STORAGE_KEY = "pump.scroll";
/** The id on the single scroller in `app/layout.tsx`. */
export const SCROLLER_ID = "app-scroll";
/** LRU cap. A session that visits 30 screens has forgotten the first one. */
export const MAX_ENTRIES = 30;
/**
 * How long the restore loop keeps re-asserting the offset.
 *
 * It has to outlast two things: a `loading.tsx` skeleton being replaced by
 * streamed content — until then the page is 600 px tall and the offset clamps
 * to nothing — and Next's own scroll handling, which runs again on the commit
 * where that content lands and would otherwise have the last word.
 */
export const RESTORE_DEADLINE_MS = 2000;
/** How long a "this navigation is a return" latch stays valid. */
export const LATCH_TTL_MS = 1200;

/**
 * The workout screen owns its own scrolling — `jumpToSet` scrolls a row to
 * centre and `useScrollWatch` drives the header off live rects. A loop
 * re-asserting a pixel offset would fight both, and mid-workout "where I was"
 * means the next set, not an offset.
 */
export const SKIP_PREFIXES = ["/workout/"] as const;

export type RestoreSource = "pop" | "back-push" | "tab";

export type ScrollKeys = {
  routeKey: string;
  /** Navigation API entry key, where the browser has one. */
  entryKey: string | null;
};

export type ScrollEntry = {
  top: number;
  at: number;
  /** Named sub-scrollers on the page (the stats heatmap's horizontal strip). */
  sub?: Record<string, number>;
};

export type ScrollStore = {
  byEntry: Record<string, ScrollEntry>;
  byRoute: Record<string, ScrollEntry>;
};

export type Latch = {
  source: RestoreSource;
  /** The entry we are returning *to*, when the browser can tell us. */
  entryKey: string | null;
  at: number;
};

/* ----------------------------------- pure --------------------------------- */

export function emptyStore(): ScrollStore {
  return { byEntry: {}, byRoute: {} };
}

/**
 * A screen's identity: path plus query, never the hash. The hash names a
 * position *within* the page and an anchor must win over a remembered offset.
 */
export function routeKeyFrom(pathname: string, search: string): string {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const query = search.startsWith("?") ? search : search ? `?${search}` : "";
  return `${path}${query}`;
}

export function shouldSkipPath(pathname: string): boolean {
  return SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isLatchFresh(latch: Latch | null, now: number): boolean {
  return !!latch && now - latch.at <= LATCH_TTL_MS && now >= latch.at - 1000;
}

/** Keep the `max` most recently written keys. */
export function evictOldest<T extends { at: number }>(
  map: Record<string, T>,
  max: number,
): Record<string, T> {
  const keys = Object.keys(map);
  if (keys.length <= max) return map;
  const kept = keys
    .sort((a, b) => map[b]!.at - map[a]!.at)
    .slice(0, max);
  const next: Record<string, T> = {};
  for (const k of kept) next[k] = map[k]!;
  return next;
}

function readEntries(value: unknown): Record<string, ScrollEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, ScrollEntry> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.top !== "number" || typeof entry.at !== "number") continue;
    const sub: Record<string, number> = {};
    if (entry.sub && typeof entry.sub === "object") {
      for (const [name, v] of Object.entries(entry.sub as Record<string, unknown>)) {
        if (typeof v === "number") sub[name] = v;
      }
    }
    out[key] = {
      top: entry.top,
      at: entry.at,
      ...(Object.keys(sub).length ? { sub } : {}),
    };
  }
  return out;
}

/** Never throws: a half-written or foreign value is simply no memory. */
export function parseStore(raw: string | null): ScrollStore {
  if (!raw) return emptyStore();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();
    const value = parsed as Record<string, unknown>;
    return {
      byEntry: readEntries(value.byEntry),
      byRoute: readEntries(value.byRoute),
    };
  } catch {
    return emptyStore();
  }
}

export function serializeStore(store: ScrollStore): string {
  return JSON.stringify({
    byEntry: evictOldest(store.byEntry, MAX_ENTRIES),
    byRoute: evictOldest(store.byRoute, MAX_ENTRIES),
  });
}

/**
 * Which slot a restore reads.
 *
 * A pop returns to a history entry the browser can name, so it prefers the
 * entry-keyed slot and only falls back to the route. A `back="/path"` push and
 * a tab tap are *forward* navigations — they mint a new entry key, so the route
 * is the only slot they could ever match.
 */
export function lookup(
  store: ScrollStore,
  keys: ScrollKeys,
  source: RestoreSource,
): ScrollEntry | null {
  if (source === "pop" && keys.entryKey) {
    const byEntry = store.byEntry[keys.entryKey];
    if (byEntry) return byEntry;
  }
  return store.byRoute[keys.routeKey] ?? null;
}

/* ------------------------------ where to point ----------------------------- */

/**
 * The geometry of "put this row on screen", in the one scroller's own
 * coordinates. All content-space pixels: `elTop` is the row's distance from the
 * top of the scroller's content, not from the top of the screen.
 *
 * This lives beside the memory because it enforces the same rule the header
 * above states: the document never scrolls. `Element.scrollIntoView()` is the
 * obvious way to write both callers and is banned in `src/` for it — that API
 * scrolls *every* scrollable ancestor, and the document is one of them.
 * `overflow: hidden` stops a finger, not the API. A document left off zero puts
 * the workout header — and with it the only Finish button in the app — above
 * the top of the screen, while the set list underneath carries on scrolling
 * normally, so nothing the lifter can do brings it back. Only a reload does.
 */
export type ScrollBand = {
  /** Where the scroller is now. */
  scrollTop: number;
  /** The row's top, in content space. */
  elTop: number;
  /** The row's height. */
  elHeight: number;
  /** The scroller's visible height (`clientHeight`). */
  viewport: number;
  /** Sticky chrome across the top of it. */
  topInset: number;
  /** Docked chrome across the bottom. */
  bottomInset: number;
  /** `scrollHeight - clientHeight`. */
  maxScroll: number;
};

const clampScroll = (top: number, maxScroll: number) =>
  Math.max(0, Math.min(top, Math.max(0, maxScroll)));

/**
 * Centre a row in the band the lifter can actually see — between the sticky
 * header and the docked chrome, not in the raw viewport. Centring on the
 * viewport would land a row halfway under the rest bar on the one screen where
 * the thing you are aiming at is a 44px checkmark.
 *
 * A row taller than the band is aligned to its top rather than centred, which
 * is the half you need: the set number and the inputs.
 */
export function centreOffset(band: ScrollBand): number {
  const visible = band.viewport - band.topInset - band.bottomInset;
  const slack = Math.max(0, (visible - band.elHeight) / 2);
  return clampScroll(band.elTop - band.topInset - slack, band.maxScroll);
}

/**
 * Move only as far as it takes to bring a row inside the band — and not at all
 * if it is already there. What `scrollIntoView({ block: "nearest" })` means,
 * for the quick-log list, where scrolling a row that was already on screen
 * would yank the sheet under a thumb on every logged set.
 */
export function nearestOffset(band: ScrollBand): number {
  const bandTop = band.scrollTop + band.topInset;
  const bandBottom = band.scrollTop + band.viewport - band.bottomInset;
  if (band.elTop >= bandTop && band.elTop + band.elHeight <= bandBottom) {
    return band.scrollTop;
  }
  // Too tall to fit reads as "above": show the start of it.
  if (band.elTop < bandTop || band.elHeight > bandBottom - bandTop) {
    return clampScroll(band.elTop - band.topInset, band.maxScroll);
  }
  return clampScroll(
    band.elTop + band.elHeight - band.viewport + band.bottomInset,
    band.maxScroll,
  );
}

/* --------------------------------- impure --------------------------------- */

let store: ScrollStore = emptyStore();
let loaded = false;
let dirty = false;
let latch: Latch | null = null;

function load(): ScrollStore {
  if (loaded) return store;
  loaded = true;
  try {
    store = parseStore(window.sessionStorage.getItem(SCROLL_STORAGE_KEY));
  } catch {
    store = emptyStore();
  }
  return store;
}

/**
 * Writes go to memory on every frame and to storage only at the points a tab
 * can disappear. `sessionStorage` is synchronous and touches the main thread —
 * paying for it per scroll frame would show up in the one place this app cannot
 * afford jank.
 */
export function flushScrollMemory() {
  if (!dirty) return;
  dirty = false;
  try {
    window.sessionStorage.setItem(SCROLL_STORAGE_KEY, serializeStore(store));
  } catch {
    /* Private mode or quota: the memory just doesn't outlive this page. */
  }
}

export function currentKeys(): ScrollKeys {
  return {
    routeKey: routeKeyFrom(window.location.pathname, window.location.search),
    entryKey: currentEntryKey(),
  };
}

type NavigationLike = { currentEntry?: { key?: string } | null };

/**
 * The Navigation API's entry key, where it exists (Chrome 102+, Safari 18.2+).
 * It is what lets the same route appearing twice in one stack keep two
 * positions; without it both share the route slot and the older entry restores
 * the newer offset. Never `history.state` — the App Router owns that object.
 */
export function currentEntryKey(): string | null {
  try {
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    return nav?.currentEntry?.key ?? null;
  } catch {
    return null;
  }
}

export function rememberScroll(keys: ScrollKeys, top: number, name?: string) {
  const s = load();
  const at = Date.now();
  const write = (map: Record<string, ScrollEntry>, key: string) => {
    const prev = map[key];
    const sub = name
      ? { ...prev?.sub, [name]: top }
      : prev?.sub;
    map[key] = {
      top: name ? (prev?.top ?? 0) : top,
      at,
      ...(sub && Object.keys(sub).length ? { sub } : {}),
    };
  };
  write(s.byRoute, keys.routeKey);
  if (keys.entryKey) write(s.byEntry, keys.entryKey);
  s.byEntry = evictOldest(s.byEntry, MAX_ENTRIES);
  s.byRoute = evictOldest(s.byRoute, MAX_ENTRIES);
  dirty = true;
}

export function recallScroll(
  keys: ScrollKeys,
  source: RestoreSource,
  name?: string,
): number | null {
  const entry = lookup(load(), keys, source);
  if (!entry) return null;
  if (name) return entry.sub?.[name] ?? null;
  return entry.top;
}

export function forgetRoute(routeKey: string) {
  const s = load();
  if (s.byRoute[routeKey]) {
    delete s.byRoute[routeKey];
    dirty = true;
  }
}

/** Sign-out: another account's offsets must not survive in this tab. */
export function clearScrollMemory() {
  store = emptyStore();
  loaded = true;
  dirty = false;
  try {
    window.sessionStorage.removeItem(SCROLL_STORAGE_KEY);
  } catch {
    /* Nothing to do — the in-memory store is already empty. */
  }
}

/**
 * "The navigation about to happen is a return." Module state rather than React
 * state: it is set inside an event handler and read by the very next render,
 * which is a sequence, not a value anything should re-render for.
 *
 * A `popstate` sets it too, which covers `router.back()`, the NavBar chevron
 * and the iOS back-swipe. The TTL is what stops a cancelled swipe from turning
 * the next genuine forward navigation into a restore.
 */
export function markRestoringNavigation(source: RestoreSource, entryKey?: string | null) {
  latch = {
    source,
    entryKey: entryKey ?? null,
    at: Date.now(),
  };
  suspendSaves();
}

/* -------------------------------------------------------------------------- *
 * Which scrolls are worth remembering, and when to stop listening.
 *
 * Next scrolls the container to the top of the *incoming* route while the URL
 * is still the outgoing one, so a save handler that trusts every scroll event
 * writes those few pixels over the position the lifter actually left — on
 * every navigation, which is every time this feature is meant to work. No
 * event says "this scroll was the framework's", so the question is turned
 * around: a scroll counts when it is one somebody is performing.
 *
 * Which is a gesture just now (`SCROLL_INPUT_TTL_MS`), or the continuation of
 * one — a flick's momentum keeps firing `scroll` long after the finger has
 * left, with no further input events, so an unbroken chain of scrolls inherits
 * the gesture that started it. The framework's scroll is an isolated event
 * arriving after both windows have closed.
 *
 * Deliberately not `pointerdown`: tapping a link is input, and what follows it
 * is the navigation. For the narrow case of a tap that lands within the input
 * window, `suspendSaves` covers the gap — every anchor click arms it.
 * -------------------------------------------------------------------------- */

export const SCROLL_INPUT_TTL_MS = 400;
export const SCROLL_CHAIN_MS = 250;
export const NAVIGATION_SUSPEND_MS = 1000;
export const SCROLL_INPUT_EVENTS = ["wheel", "touchmove", "keydown"] as const;

let lastScrollInput = 0;
let lastAccepted = 0;
let suspendedUntil = 0;

export function noteScrollInput() {
  lastScrollInput = Date.now();
}

/** Both a question and a claim: a scroll that counts extends the chain. */
export function acceptScroll(): boolean {
  const now = Date.now();
  if (now >= suspendedUntil) {
    if (now - lastScrollInput <= SCROLL_INPUT_TTL_MS || now - lastAccepted <= SCROLL_CHAIN_MS) {
      lastAccepted = now;
      return true;
    }
  }
  return false;
}

/**
 * Stop saving for a moment: a navigation is starting, or one has started and
 * is about to be restored. A deadline rather than a counter, so a click that
 * turns out not to navigate can't leave saving off for the rest of the
 * session.
 */
export function suspendSaves(ms: number = RESTORE_DEADLINE_MS + 200) {
  suspendedUntil = Math.max(suspendedUntil, Date.now() + ms);
}

export function resumeSaves() {
  suspendedUntil = 0;
}

/** Consuming read: a latch is spent by the navigation that reads it. */
export function takeLatch(): Latch | null {
  const value = latch;
  latch = null;
  return value && isLatchFresh(value, Date.now()) ? value : null;
}

/** For a sub-scroller, whose ref attaches before the page-level effect runs. */
export function peekLatch(): Latch | null {
  return latch && isLatchFresh(latch, Date.now()) ? latch : null;
}

/** The one scroller. `null` before hydration and on a page that has none. */
export function getScroller(): HTMLElement | null {
  return document.getElementById(SCROLLER_ID);
}

