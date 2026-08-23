"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  NAVIGATION_SUSPEND_MS,
  RESTORE_DEADLINE_MS,
  SCROLL_INPUT_EVENTS,
  acceptScroll,
  currentKeys,
  flushScrollMemory,
  forgetRoute,
  getScroller,
  markRestoringNavigation,
  noteScrollInput,
  recallScroll,
  rememberScroll,
  resumeSaves,
  shouldSkipPath,
  suspendSaves,
  takeLatch,
} from "@/lib/scroll-memory";

/**
 * Remembers where you were on each screen, and puts you back there when you
 * return to it.
 *
 * Mounted once in the root layout, renders nothing. It reads `usePathname()`
 * and never `useSearchParams()`: a search-params hook in the root layout would
 * put the whole app behind a Suspense boundary and opt every static route out
 * of prerendering. The query is read off `window.location` at the moment of a
 * save or a restore instead, which is the same answer for free.
 *
 * A restore happens only on a *return* — a pop, the NavBar's fixed-href back
 * button, or a tab-bar tap. Anything else is a forward navigation and starts
 * at the top, the way tapping into a detail screen should.
 */
export function ScrollRestoration(): null {
  const pathname = usePathname();

  /* ------------------------------- saving -------------------------------- */
  useEffect(() => {
    let frame = 0;

    // The scroller is unnamed to `use-scroll-watch.ts`, which listens in the
    // capture phase because `scroll` doesn't bubble. Same trick here for the
    // same reason — but restoring needs the element itself, which is why the
    // layout gives it an id.
    const save = () => {
      frame = 0;
      const el = getScroller();
      if (!el) return;
      if (shouldSkipPath(window.location.pathname)) return;
      // Only what the lifter scrolled to, never what the framework scrolled
      // past on its way out of this route.
      if (!acceptScroll()) return;
      rememberScroll(currentKeys(), el.scrollTop);
    };
    const schedule = (event: Event) => {
      if (event.target !== getScroller()) return;
      if (!frame) frame = requestAnimationFrame(save);
    };

    // Every link click is a navigation about to scroll this container to the
    // top of somewhere else. Cheap to arm and self-expiring, so a click that
    // navigates nowhere costs a second of saving and nothing more.
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.("a[href]")) suspendSaves(NAVIGATION_SUSPEND_MS);
    };

    // A pop is a return whoever caused it: `router.back()`, the NavBar
    // chevron, the browser button, the iOS back-swipe. The entry key is read
    // now because by the time React commits we are already on the new entry.
    const onPop = () => {
      const keys = currentKeys();
      markRestoringNavigation("pop", keys.entryKey);
    };

    const flush = () => {
      save();
      flushScrollMemory();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    for (const type of SCROLL_INPUT_EVENTS) {
      document.addEventListener(type, noteScrollInput, {
        capture: true,
        passive: true,
      });
    }
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPop);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      for (const type of SCROLL_INPUT_EVENTS) {
        document.removeEventListener(type, noteScrollInput, { capture: true });
      }
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* ------------------------------ restoring ------------------------------ */
  useLayoutEffect(() => {
    const latch = takeLatch();
    const keys = currentKeys();

    if (shouldSkipPath(pathname)) {
      resumeSaves();
      return;
    }
    if (!latch) {
      // A forward navigation. Start at the top, and drop whatever this route
      // remembered — arriving at a list from a link or a deep link is a fresh
      // read, not a return to one.
      forgetRoute(keys.routeKey);
      resumeSaves();
      return;
    }
    // An anchor names a position inside the page and must win over a
    // remembered offset.
    if (window.location.hash) {
      resumeSaves();
      return;
    }

    const target = recallScroll(keys, latch.source);
    const el = getScroller();
    if (target == null || target <= 0 || !el) {
      resumeSaves();
      return;
    }

    /* ------------------------------------------------------------------ *
     * Re-assert the offset for a few frames rather than setting it once.
     *
     * Two things move underneath a restore. Next runs its own
     * scroll-to-top after the route commits, and whether that lands before
     * or after this effect is not something to reason about — the last
     * frame inside the deadline is ours either way. And the page arrives
     * short: every `(app)` route has a `loading.tsx`, so the first commit
     * is a skeleton and the assignment clamps to the few pixels that exist.
     * As the streamed payload, the restored list pages and the images fill
     * it in, later frames reach the real target.
     * ------------------------------------------------------------------ */
    const behavior = el.style.scrollBehavior;
    // A restore is a jump, never an animation — nobody asked to watch a
    // thousand pixels go by, and a smooth scroll would still be moving when
    // the next frame re-asserts the target.
    el.style.scrollBehavior = "auto";
    el.scrollTop = target;

    let frame = 0;
    let done = false;
    const startedAt = performance.now();

    const finish = () => {
      if (done) return;
      done = true;
      if (frame) cancelAnimationFrame(frame);
      el.style.scrollBehavior = behavior;
      for (const type of ABORT_EVENTS) {
        window.removeEventListener(type, abort, { capture: true });
      }
      resumeSaves();
    };

    // The moment the lifter touches the screen they own it. Restoring on top
    // of a scroll someone is performing is worse than not restoring at all.
    function abort() {
      finish();
    }

    const step = () => {
      frame = 0;
      if (done) return;
      // Assigned even while the page is too short to hold it: the browser
      // clamps, so the view sits at the end of what exists and climbs as the
      // rest arrives, rather than snapping back to the top.
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
      // No early exit on a few clean frames. Next scrolls the container again
      // when the streamed content replaces the skeleton, which is a later
      // commit than this effect — a loop that had already declared itself
      // settled by then handed the page back to the top.
      if (performance.now() - startedAt > RESTORE_DEADLINE_MS) return finish();
      frame = requestAnimationFrame(step);
    };

    for (const type of ABORT_EVENTS) {
      window.addEventListener(type, abort, {
        capture: true,
        passive: true,
        once: true,
      });
    }
    frame = requestAnimationFrame(step);
    return finish;
  }, [pathname]);

  /* iOS restores a bfcache page's scroll itself; re-asserting would jump. */
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) takeLatch();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return null;
}

const ABORT_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/**
 * Scroll the app back to the top, for the one gesture that means it: tapping
 * the tab you are already on.
 */
export function scrollAppToTop() {
  const el = getScroller();
  if (!el) return;
  el.scrollTop = 0;
  forgetRoute(currentKeys().routeKey);
  // The click that got here armed the navigation suspension a moment ago, and
  // this one goes nowhere — nothing will commit to lift it, and the lifter is
  // about to scroll a page that would not be recording.
  resumeSaves();
}
