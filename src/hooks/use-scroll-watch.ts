"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type ScrollWatch = {
  /**
   * The exercise block currently under the header — what the lifter is
   * reading. `null` means nothing has passed under it yet: we're at the top of
   * the workout, where the header's own summary is the right thing to show.
   */
  activeBlockId: string | null;
  /** Where the tracked set sits relative to the viewport; null when in view. */
  targetAway: "up" | "down" | null;
};

const IDLE: ScrollWatch = { activeBlockId: null, targetAway: null };

/**
 * Watches the one scroller for two things at once: which exercise is under the
 * header, and whether the set you're due to do next has left the screen.
 *
 * Rects rather than an IntersectionObserver: both answers are thresholds on a
 * live position ("has this crossed the header line *now*"), not events on a
 * ratio, and an observer only reports at the instant a threshold is crossed —
 * between callbacks its numbers are stale. A workout is a handful of blocks,
 * so a measure pass is a few reads, and it runs at most once per frame.
 *
 * `scroll` doesn't bubble, so the listener is registered in the capture phase:
 * that catches the scroll of the single container in the root layout without
 * this hook needing a ref to it.
 */
export function useScrollWatch({
  headerRef,
  bottomInset,
  targetSetId,
}: {
  /** Sticky chrome at the top. Its bottom edge is the line blocks cross. */
  headerRef: RefObject<HTMLElement | null>;
  /** Height of the docked chrome at the bottom, in px. */
  bottomInset: number;
  /** The set to keep track of, usually the next unfinished one. */
  targetSetId: string | null;
}): ScrollWatch {
  const [watch, setWatch] = useState<ScrollWatch>(IDLE);
  const measureRef = useRef<() => void>(() => {});

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const top = headerRef.current?.getBoundingClientRect().bottom ?? 0;
      const floor = window.innerHeight - bottomInset;

      // The exercise being read is the one whose *name row* has gone under the
      // header while the block itself is still on screen. Both halves matter:
      // while a title is visible the header has nothing to add and would just
      // print the same words twice, and once a block has scrolled away
      // entirely it is no longer what you're looking at — that gap between two
      // exercises is a legitimate "nothing", and the header falls back to the
      // session summary for it.
      let activeBlockId: string | null = null;
      let activeBottom = 0;
      for (const section of document.querySelectorAll<HTMLElement>("[data-block-id]")) {
        const title = section.querySelector<HTMLElement>("[data-block-title]");
        // A block mid-enter or mid-exit may have no title yet; skipping it
        // keeps the ones below it measured. `break` stopped the whole scan and
        // left the header and the jump pill stale for everything after.
        if (!title) continue;
        if (title.getBoundingClientRect().bottom > top) {
          // This exercise's title is still on screen, so it hasn't taken over
          // yet — unless the one before it has left entirely, in which case
          // this is what you're arriving at. Handing over here rather than
          // dropping to "nothing" matters: the gap between two exercises is
          // only ~40px of scrolling, and falling back to the session summary
          // for it would flash the header on every boundary.
          if (activeBlockId && activeBottom <= top) {
            activeBlockId = section.dataset.blockId ?? null;
          }
          break;
        }
        activeBlockId = section.dataset.blockId ?? null;
        activeBottom = section.getBoundingClientRect().bottom;
      }

      let targetAway: ScrollWatch["targetAway"] = null;
      if (targetSetId) {
        const el = document.querySelector<HTMLElement>(
          `[data-set-id="${CSS.escape(targetSetId)}"]`,
        );
        const rect = el?.getBoundingClientRect();
        if (rect) {
          // A row half-hidden behind the chrome counts as gone: you can't tap
          // its checkmark, which is the only reason to point at it.
          if (rect.bottom < top + 8) targetAway = "up";
          else if (rect.top > floor - 8) targetAway = "down";
        }
      }

      setWatch((prev) =>
        prev.activeBlockId === activeBlockId && prev.targetAway === targetAway
          ? prev
          : { activeBlockId, targetAway },
      );
    };

    measureRef.current = measure;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [headerRef, bottomInset, targetSetId]);

  // Sets and exercises appear, collapse and grow without the page scrolling,
  // and every one of those moves the rows this hook is measuring. Re-measuring
  // after each render is cheaper than tracking which mutation mattered.
  useEffect(() => {
    measureRef.current();
  });

  return watch;
}
