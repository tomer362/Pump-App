"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { currentKeys } from "@/lib/scroll-memory";
import {
  LIST_STORAGE_PREFIX,
  readSession,
  writeSession,
} from "@/lib/session-memory";
import {
  searchExerciseBatchAction,
  type ExerciseBatch,
} from "@/lib/actions/exercise-search";
import type {
  ExerciseCursor,
  ExerciseListItem,
  ExerciseScope,
} from "@/lib/queries/exercise";
import type { Equipment, Muscle } from "@/lib/db/schema";

export type ExerciseBatchFilters = {
  query?: string;
  muscle?: Muscle | "all";
  equipment?: Equipment | "all";
  scope?: ExerciseScope;
};

type Loaded = {
  /** Which filters these rows belong to — results carry their own signature. */
  key: string;
  recent: ExerciseListItem[];
  rest: ExerciseListItem[];
  /**
   * Matches the default scope hides. Comes back with the opening batch and is
   * discarded with it on any filter change — `loadMore` never touches it,
   * because it is a capped probe rather than a paginated list.
   */
  imported: ExerciseListItem[];
  cursor: ExerciseCursor | null;
};

/* -------------------------------------------------------------------------- *
 * The accumulated batches, cached for the session.
 *
 * Without this, coming back to the library from an exercise page leaves the
 * list one batch tall — so a remembered scroll position has nowhere to land,
 * and the sentinel would spend a round trip per batch climbing back to it. The
 * rows are already on the client; keeping them costs no query at all.
 * -------------------------------------------------------------------------- */

function snapshotKey(persistKey: string) {
  return `${LIST_STORAGE_PREFIX}${currentKeys().routeKey}::batches:${persistKey}`;
}

function reviveItem(value: unknown): ExerciseListItem {
  const item = value as ExerciseListItem;
  return {
    ...item,
    lastPerformedAt: item.lastPerformedAt
      ? new Date(item.lastPerformedAt)
      : null,
  };
}

function reviveLoaded(value: unknown): Loaded | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.key !== "string" || !v.key) return null;
  if (!Array.isArray(v.recent) || !Array.isArray(v.rest)) return null;
  if (!Array.isArray(v.imported)) return null;
  return {
    key: v.key,
    recent: v.recent.map(reviveItem),
    rest: v.rest.map(reviveItem),
    imported: v.imported.map(reviveItem),
    cursor: (v.cursor as ExerciseCursor | null) ?? null,
  };
}

function signatureOf(f: ExerciseBatchFilters) {
  return [
    f.query?.trim() ?? "",
    f.muscle ?? "all",
    f.equipment ?? "all",
    f.scope ?? "available",
  ].join("|");
}

/**
 * Scroll-driven batch loading for the exercise library.
 *
 * The opening batch is small enough to paint immediately, and each following
 * one is requested while the end of the list is still ~600 px away — so the
 * rows are already there by the time a thumb-flick reaches them, and neither
 * the first render nor the scroll waits on the whole library.
 *
 * Auto-loading is the deliberate exception to the explicit `<LoadMore>` button
 * the feed and history use. Those are unbounded, media-heavy, and someone may
 * only be scrolling past; this is a bounded few hundred rows of two-line text
 * that the user opened specifically to scroll through looking for one of them.
 */
export function useExerciseBatches(
  filters: ExerciseBatchFilters,
  {
    /** Skip fetching entirely while a sheet is closed. */
    enabled = true,
    /** Server-rendered opening batch, if the page had one. */
    initial,
    /**
     * The filters `initial` was rendered for, when they aren't the ones being
     * passed in. The library page always server-renders the *unfiltered*
     * batch, while the filters themselves are restored from the session — so
     * on a back navigation the first render already carries a search the
     * server knew nothing about, and labelling those rows with it would show
     * the whole library under the word "bench" and never refetch.
     */
    initialFor,
    debounceMs = 180,
    /**
     * Cache the accumulated batches for this route under this name, so a back
     * navigation gets its list back. Set it for the library page; not for the
     * picker sheet, which doesn't participate in history and where reopening
     * is usually a new search.
     */
    persistKey,
  }: {
    enabled?: boolean;
    initial?: ExerciseBatch;
    initialFor?: ExerciseBatchFilters;
    debounceMs?: number;
    persistKey?: string;
  } = {},
) {
  const signature = signatureOf(filters);

  // The signature the initial data was rendered for. Captured once: if the
  // user changes a filter and comes back, the refetched rows are the truth.
  const [initialKey] = useState(() =>
    initial ? signatureOf(initialFor ?? filters) : null,
  );
  const [loaded, setLoaded] = useState<Loaded>(() => ({
    key: initialKey ?? "",
    recent: initial?.recent ?? [],
    rest: initial?.items ?? [],
    imported: initial?.imported ?? [],
    cursor: initial?.cursor ?? null,
  }));
  const [loadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  /**
   * Whose rows the current `loaded` can be trusted to be — the server-rendered
   * batch, or a restored snapshot. Anything else gets refetched, which is what
   * keeps a filter you come back to honest.
   */
  const trusted = useRef<string | null>(initialKey);

  // `loading` is derived from whose filters the rows belong to rather than
  // written on every keystroke, so typing doesn't flash the list empty.
  const loading = enabled && loaded.key !== signature;

  // Read through refs inside callbacks so neither the observer nor the
  // fetchers have to be rebuilt as the user types.
  const filtersRef = useRef(filters);
  const loadedRef = useRef(loaded);
  const signatureRef = useRef(signature);
  const inFlight = useRef(false);
  useEffect(() => {
    filtersRef.current = filters;
    loadedRef.current = loaded;
    signatureRef.current = signature;
  });

  // Restored batches. Keyed on the signature rather than run once on mount,
  // because the filters they belong to are themselves restored — one commit
  // later than this component first renders.
  const snapshot = useRef<Loaded | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (!persistKey || !enabled) return;
    if (snapshot.current === undefined) {
      snapshot.current = readSession(snapshotKey(persistKey), reviveLoaded);
    }
    const saved = snapshot.current;
    if (!saved || saved.key !== signature) return;
    if (saved.rest.length <= loadedRef.current.rest.length) return;
    snapshot.current = null;
    trusted.current = signature;
    setLoaded(saved);
  }, [persistKey, enabled, signature]);

  // Opening batch. Debounced, so a search request isn't fired per keystroke.
  const request = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    if (trusted.current === signature && loadedRef.current.key === signature) {
      return;
    }
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      const batch = await searchExerciseBatchAction({ ...filtersRef.current });
      // A slower earlier request must never overwrite a newer one's rows.
      if (request.current !== id) return;
      // Fresh rows outrank a snapshot for every filter from here on.
      snapshot.current = null;
      trusted.current = signature;
      setLoaded({
        key: signature,
        recent: batch.recent ?? [],
        rest: batch.items,
        imported: batch.imported ?? [],
        cursor: batch.cursor,
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [enabled, signature, debounceMs, nonce]);

  const loadMore = useCallback(async () => {
    const current = loadedRef.current;
    if (
      inFlight.current ||
      !current.cursor ||
      current.key !== signatureRef.current
    ) {
      return;
    }
    inFlight.current = true;
    setLoadingMore(true);
    // Read the opening-batch token, so a filter change mid-scroll — which
    // bumps it — makes this batch land as stale and be ignored.
    const id = request.current;
    const batch = await searchExerciseBatchAction({
      ...filtersRef.current,
      after: current.cursor,
    });
    inFlight.current = false;
    setLoadingMore(false);
    if (request.current !== id) return;
    setLoaded((prev) => {
      if (prev.key !== current.key) return prev;
      const seen = new Set(prev.rest.map((e) => e.id));
      return {
        ...prev,
        rest: [...prev.rest, ...batch.items.filter((e) => !seen.has(e.id))],
        cursor: batch.cursor,
      };
    });
  }, []);

  /**
   * Sentinel. `rootMargin` is what makes this feel instant rather than
   * paginated — the batch is requested well before the sentinel is on screen.
   * Root is left as the viewport: every list this drives scrolls inside a
   * container that is itself clipped to the viewport, so a sentinel entering
   * the viewport is the same event either way.
   */
  const visible = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver(
        ([entry]) => {
          visible.current = entry.isIntersecting;
          if (entry.isIntersecting) void loadMore();
        },
        { rootMargin: "600px 0px" },
      );
      observer.current.observe(node);
    },
    [loadMore],
  );

  useEffect(() => () => observer.current?.disconnect(), []);

  // Persist whatever is on screen, so a back navigation lands in the same
  // list. Only past the opening batch: a first page costs nothing to render
  // again and is what the server already sends.
  useEffect(() => {
    if (!persistKey || !enabled) return;
    if (loaded.key !== signature || !loaded.rest.length) return;
    writeSession(snapshotKey(persistKey), loaded);
  }, [persistKey, enabled, loaded, signature]);

  // A batch that doesn't push the sentinel out of view produces no second
  // intersection event — on a tall screen, or under a filter with few matches,
  // the list would stall one batch in. Keep pulling while it is still in view.
  useEffect(() => {
    if (!loadingMore && visible.current && loaded.cursor) void loadMore();
  }, [loaded, loadingMore, loadMore]);

  return {
    recent: loaded.recent,
    rest: loaded.rest,
    imported: loaded.imported,
    loading,
    loadingMore,
    /** Everything the current filters can return is on screen. */
    exhausted: loaded.cursor == null,
    sentinelRef,
    /**
     * Refetch the opening batch — after creating an exercise, say. Through a
     * nonce the fetch effect depends on: blanking the key used to change
     * nothing the effect watched, so the library never refetched and, with
     * the key no longer matching the signature, never auto-loaded again.
     */
    refresh: useCallback(() => {
      setNonce((n) => n + 1);
    }, []),
  };
}
