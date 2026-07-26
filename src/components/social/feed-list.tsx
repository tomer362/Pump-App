"use client";

import { useState } from "react";
import { PostCard } from "./post-card";
import { LoadMore } from "@/components/ui/load-more";
import { loadMoreFeed } from "@/lib/actions/paginate";
import { FEED_PAGE_SIZE } from "@/lib/pagination";
import type { FeedItem } from "@/lib/queries/social";

export function FeedList({
  initial,
  unit,
}: {
  initial: FeedItem[];
  unit: "kg" | "lb";
}) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  // A short first page means there is nothing behind it.
  const [exhausted, setExhausted] = useState(initial.length < FEED_PAGE_SIZE);

  async function more() {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    const next = await loadMoreFeed(new Date(last.createdAt).toISOString());
    setLoading(false);
    if (next.length < FEED_PAGE_SIZE) setExhausted(true);
    if (!next.length) return;
    // Guard against a duplicate if a post lands on the cursor boundary.
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.postId));
      return [...prev, ...next.filter((p) => !seen.has(p.postId))];
    });
  }

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
