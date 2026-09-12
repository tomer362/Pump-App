"use client";

import { PostCard } from "./post-card";
import { LoadMore } from "@/components/ui/load-more";
import { loadMoreFeed } from "@/lib/actions/paginate";
import { FEED_PAGE_SIZE } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import type { FeedItem } from "@/lib/queries/social";

/** JSON has no `Date`; the feed renders `createdAt` as one. */
function reviveFeedItem(value: unknown): FeedItem {
  const item = value as FeedItem;
  return { ...item, createdAt: new Date(item.createdAt) };
}

export function FeedList({
  initial,
  unit,
}: {
  initial: FeedItem[];
  unit: "kg" | "lb";
}) {
  // The loaded pages are cached for the session, so coming back from a post
  // returns to the row you tapped rather than to the top of page one.
  const { items, loading, exhausted, more } = usePagedList({
    initial,
    pageSize: FEED_PAGE_SIZE,
    name: "feed",
    idOf: (item) => item.postId,
    revive: reviveFeedItem,
    fetchMore: (last) =>
      loadMoreFeed(new Date(last.createdAt).toISOString(), last.postId),
  });

  return (
    <div className="space-y-3 px-4">
      {items.map((item) => (
        <PostCard key={item.postId} item={item} unit={unit} />
      ))}
      {!exhausted && (
        <LoadMore onClick={more} loading={loading} label="Older posts" />
      )}
    </div>
  );
}
