"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { currentKeys } from "@/lib/scroll-memory";
import {
  UI_STORAGE_PREFIX,
  cacheSession,
  cachedSession,
  subscribeNever,
  writeSession,
} from "@/lib/session-memory";

/**
 * A piece of screen state that survives leaving the screen — a search box's
 * contents, which tab of a page you were reading.
 *
 * These are the other half of "put me back where I was". Restoring a scroll
 * offset onto a list that has forgotten what you searched for restores a
 * position in the wrong list.
 *
 * Not the URL, though the URL would be the tidier place for them. Every one of
 * these screens is a server component: `router.replace` with a new query
 * re-runs it, so a tab tap on `/exercises/[id]` would re-issue eight
 * aggregates and a keystroke in the library search would add a database round
 * trip on top of the one the client already makes. Against a scale-to-zero
 * database that is the wrong trade for state nobody links to.
 *
 * Read through a store rather than a `useState` initialiser: the first client
 * render has to match the server HTML, and the server never has a value.
 */
export function useRouteMemory<T>(
  name: string,
  fallback: T,
  /** Validates a stored value — a shape from an older build must not load. */
  revive: (value: unknown) => T | null,
): [T, (next: T) => void] {
  const key = useSyncExternalStore(
    subscribeNever,
    () => `${UI_STORAGE_PREFIX}${currentKeys().routeKey}::${name}`,
    () => null,
  );
  const stored = useMemo(
    () => (key ? cachedSession(key, revive) : null),
    // `revive` is a module-level function at every call site; taking it as a
    // dependency would re-read storage on a caller's every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const [override, setOverride] = useState<{ value: T } | null>(null);

  const set = useCallback(
    (next: T) => {
      setOverride({ value: next });
      if (key) {
        cacheSession(key, next);
        writeSession(key, next);
      }
    },
    [key],
  );

  return [override ? override.value : (stored ?? fallback), set];
}
