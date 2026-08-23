"use client";

import { useCallback, useRef } from "react";
import {
  acceptScroll,
  currentKeys,
  peekLatch,
  recallScroll,
  rememberScroll,
} from "@/lib/scroll-memory";

/**
 * Scroll memory for a named scroller *inside* a page — the stats heatmap's
 * half-year strip is the one that needs it.
 *
 * Same rule as the page itself: a return puts you back where you were, and a
 * fresh arrival gets `onFirstVisit` (for the heatmap, the pin to this week).
 * The latch is only peeked at, never spent: `ScrollRestoration` consumes it,
 * and refs attach before its effect runs.
 *
 * A ref callback rather than an effect, because these scrollers appear late —
 * the heatmap's grid doesn't exist until a client-side date arrives.
 */
export function useScrollMemory(
  name: string,
  /** Must be stable — define it at module level, not inline. */
  onFirstVisit?: (el: HTMLElement) => void,
) {
  // Decided once per mount, not once per attach. A ref callback runs twice
  // under Strict Mode, and by the second run `ScrollRestoration` has consumed
  // the latch — so the second attach would take the first one's restored pan
  // for a first visit and pin the grid back to this week.
  const decided = useRef<number | null | undefined>(undefined);

  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      if (decided.current === undefined) {
        const latch = peekLatch();
        decided.current = latch
          ? recallScroll(currentKeys(), latch.source, name)
          : null;
      }
      const saved = decided.current;
      if (saved != null) el.scrollLeft = saved;
      else onFirstVisit?.(el);

      let frame = 0;
      const save = () => {
        frame = 0;
        // Same rule as the page scroller: a pan somebody performed, not the
        // pin this component does on a first visit.
        if (!acceptScroll()) return;
        rememberScroll(currentKeys(), el.scrollLeft, name);
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(save);
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        if (frame) cancelAnimationFrame(frame);
        el.removeEventListener("scroll", onScroll);
      };
    },
    [name, onFirstVisit],
  );
}
