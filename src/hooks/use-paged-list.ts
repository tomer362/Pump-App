"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { currentKeys } from "@/lib/scroll-memory";
import { subscribeNever } from "@/lib/session-memory";
import {
  dedupeById,
  listStorageKey,
  mergeSaved,
  readList,
  writeList,
} from "@/lib/paged-list";

/**
 * A keyset-paginated list whose loaded pages survive a back navigation.
 *
 * The three lists that use it (`feed-list`, `history-list`, `discover-list`)
 * keep their own rendering, grouping and cursors — this owns only the part
 * they had identical: append-with-dedupe, the exhausted flag, and now the
 * session cache that makes a restored scroll offset reachable. Without it a
 * back navigation remounts the list one page tall and the position the lifter
 * left has nowhere to land.
 */
export function usePagedList<T>({
  initial,
  pageSize,
  idOf,
  fetchMore,
  revive,
  name,
}: {
  initial: T[];
  pageSize: number;
  idOf: (item: T) => string;
  /** Given the last row, the next page. The list's own cursor stays its own. */
  fetchMore: (last: T) => Promise<T[]>;
  /** RSC hands these across as `Date`s; JSON hands them back as strings. */
  revive: (value: unknown) => T;
  /** Distinguishes two lists on one route, and two orderings of one list. */
  name: string;
}) {
  // Through a store, never a `useState` initialiser: the first client render
  // has to match the server HTML or React discards the subtree — and the
  // subtree here is the list being restored.
  const key = useSyncExternalStore(
    subscribeNever,
    () => listStorageKey(currentKeys().routeKey, name),
    () => null,
  );
  const saved = useMemo(
    () => (key ? readList(key, revive) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  /** Pages fetched during this mount, on top of whatever was restored. */
  const [extra, setExtra] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  /** The last page request failed; the button offers a retry instead of hiding. */
  const [failed, setFailed] = useState(false);

  const base = mergeSaved(initial, saved, idOf);
  const items = useMemo(
    () => (extra.length ? dedupeById([...base, ...extra], idOf) : base),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, extra],
  );

  // A short first page means there is nothing behind it — but a restored list
  // is longer than its first page and says nothing about what follows.
  const exhausted =
    ended || (base.length === initial.length && initial.length < pageSize);

  const more = useCallback(async () => {
    const last = items[items.length - 1];
    if (!last || loading) return;
    setLoading(true);
    let next: T[];
    try {
      next = await fetchMore(last);
    } catch {
      // A dropped request used to be read as an empty page, which marked
      // the list exhausted and hid "Load more" for good — on a phone on gym
      // wifi, the one place a retry is needed most.
      setLoading(false);
      setFailed(true);
      return;
    }
    setLoading(false);
    setFailed(false);
    if (next.length < pageSize) setEnded(true);
    if (!next.length) return;
    // Guard against a duplicate if a row lands on the cursor boundary.
    const merged = dedupeById([...items, ...next], idOf);
    setExtra(merged.slice(base.length));
    if (key) writeList(key, merged);
  }, [items, base.length, loading, fetchMore, pageSize, idOf, key]);

  return { items, loading, exhausted, failed, more };
}
