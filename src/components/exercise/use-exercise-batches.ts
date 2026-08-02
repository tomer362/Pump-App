"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    debounceMs = 180,
  }: {
    enabled?: boolean;
    initial?: ExerciseBatch;
    debounceMs?: number;
  } = {},
) {
  const signature = signatureOf(filters);

  // The signature the initial data was rendered for. Captured once: if the
  // user changes a filter and comes back, the refetched rows are the truth.
  const [initialKey] = useState(() => (initial ? signature : null));
  const [loaded, setLoaded] = useState<Loaded>(() => ({
    key: initialKey ?? "",
    recent: initial?.recent ?? [],
    rest: initial?.items ?? [],
    imported: initial?.imported ?? [],
    cursor: initial?.cursor ?? null,
  }));
  const [loadingMore, setLoadingMore] = useState(false);

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

  // Opening batch. Debounced, so a search request isn't fired per keystroke.
  const request = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    if (initialKey === signature && loadedRef.current.key === signature) return;
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      const batch = await searchExerciseBatchAction({ ...filtersRef.current });
      // A slower earlier request must never overwrite a newer one's rows.
      if (request.current !== id) return;
      setLoaded({
        key: signature,
        recent: batch.recent ?? [],
        rest: batch.items,
        imported: batch.imported ?? [],
        cursor: batch.cursor,
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [enabled, signature, initialKey, debounceMs]);

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
    // Bump the opening-batch token too: a filter change mid-scroll must not
    // land after this batch and be overwritten by it.
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
    /** Refetch the opening batch — after creating an exercise, say. */
    refresh: useCallback(() => {
      setLoaded((prev) => ({ ...prev, key: "" }));
    }, []),
  };
}
