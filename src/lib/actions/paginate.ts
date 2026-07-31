"use server";

import { getCurrentUser } from "@/lib/session";
import { getFollowingFeed, type FeedItem } from "@/lib/queries/social";
import { getWorkoutHistory } from "@/lib/queries/workout";
import {
  getDiscoverRoutines,
  DISCOVER_SORTS,
  type DiscoverCursor,
  type DiscoverRoutine,
  type DiscoverSort,
} from "@/lib/queries/routine";
import {
  DISCOVER_PAGE_SIZE,
  FEED_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
} from "@/lib/pagination";

/**
 * Cursor pagination for the two infinite lists. Both underlying queries
 * already took a `before` cursor and nothing ever passed one, so the feed and
 * history simply stopped at their first page.
 *
 * Keyset rather than OFFSET: these lists are ordered by a timestamp that new
 * rows push onto the front, so an offset would duplicate or skip rows the
 * moment anyone posts mid-scroll.
 */
export async function loadMoreFeed(before: string): Promise<FeedItem[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const cursor = new Date(before);
  if (Number.isNaN(cursor.getTime())) return [];
  return getFollowingFeed(me.id, { limit: FEED_PAGE_SIZE, before: cursor });
}

export async function loadMoreHistory(before: string) {
  const me = await getCurrentUser();
  if (!me) return [];
  const cursor = new Date(before);
  if (Number.isNaN(cursor.getTime())) return [];
  return getWorkoutHistory(me.id, { limit: HISTORY_PAGE_SIZE, before: cursor });
}

/**
 * Discover pages on a composite cursor rather than a timestamp: "Popular" is
 * ordered by a counter that ties constantly, so the id has to ride along.
 */
export async function loadMoreDiscoverRoutines(
  sort: string,
  cursor: DiscoverCursor,
): Promise<DiscoverRoutine[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  if (!DISCOVER_SORTS.includes(sort as DiscoverSort)) return [];
  if (
    !cursor ||
    typeof cursor.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
    (typeof cursor.value !== "number" && typeof cursor.value !== "string")
  ) {
    return [];
  }

  return getDiscoverRoutines(me.id, {
    sort: sort as DiscoverSort,
    limit: DISCOVER_PAGE_SIZE,
    cursor,
  });
}
