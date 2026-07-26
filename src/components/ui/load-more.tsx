"use client";

import { Loader2, Plus } from "lucide-react";
import { haptic } from "@/lib/utils";

/**
 * An explicit button rather than an intersection-observer auto-load. On a
 * metered phone connection, and against a scale-to-zero database, fetching
 * because a sentinel drifted into view spends someone else's data and compute
 * on a page they may only have scrolled past.
 */
export function LoadMore({
  onClick,
  loading,
  label = "Load more",
}: {
  onClick: () => void;
  loading: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={() => {
        haptic.light();
        onClick();
      }}
      disabled={loading}
      className="press tap border-hairline text-text-2 hover:text-text-1 mx-auto flex w-full items-center justify-center gap-2 rounded-field border py-3 text-[13px] font-semibold disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Loading
        </>
      ) : (
        <>
          <Plus className="size-4" strokeWidth={2.6} />
          {label}
        </>
      )}
    </button>
  );
}
