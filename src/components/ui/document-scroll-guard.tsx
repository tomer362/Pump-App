"use client";

import { useEffect } from "react";
import { keyboardCoverage } from "@/hooks/use-keyboard-inset";

/* -------------------------------------------------------------------------- *
 * Puts the document back at zero whenever something scrolls it.
 *
 * The whole layout rests on one invariant: the document does not scroll.
 * `body` is a single `100dvh` box, `#app-scroll` fills it, and every piece of
 * chrome that has to stay on screen — the workout header, the tab bar, the
 * rest bar — is `sticky` or `fixed` against a viewport assumed to be at the
 * top of it. `overflow: hidden` enforces that for a finger. It enforces it for
 * nothing else:
 *
 *   · iOS scrolls the *page* to reveal a focused field when the keyboard
 *     opens — clipped or not — and restores it on blur only if it believes
 *     nothing else has scrolled since;
 *   · `scrollIntoView` scrolls every scrollable ancestor including the
 *     viewport (which is why `lib/scroll-memory.ts` carries the arithmetic to
 *     do without it, and why nothing in `src/` calls it);
 *   · `element.focus()` does the same unless passed `preventScroll`;
 *   · a bfcache restore, a find-on-page, an extension.
 *
 * The failure is neither cosmetic nor recoverable. On `/workout/[id]` the
 * header carries the *only* Finish button; once the document is off zero that
 * header sits above the top of the screen, the set list underneath keeps
 * scrolling normally inside `#app-scroll` — so nothing looks broken enough to
 * explain itself — and no gesture scrolls a clipped document back. The session
 * is stuck mid-workout until a reload.
 *
 * So this is the one place in `src/` that writes the document's scroll offset,
 * and the only value it ever writes is 0. It is not an exception to the
 * invariant in `lib/scroll-memory.ts`; it is the enforcement of it.
 * -------------------------------------------------------------------------- */

/**
 * A pinch. `layout.tsx` ships `maximumScale: 5` deliberately, so someone who
 * zoomed in has panned the *visual* viewport on purpose and undoing it would
 * be a worse bug than the one this fixes. It is also impossible —
 * `visualViewport.offsetTop` is read-only — which is worth saying out loud: a
 * header lost to a pinch is a different fault from a header lost to a scroll,
 * and this guard only ever claims the second.
 */
function zoomed(): boolean {
  return (window.visualViewport?.scale ?? 1) > 1.01;
}

/**
 * How long after focus leaves a field we keep re-asserting zero. iOS animates
 * the keyboard down over roughly 250 ms and pans while it moves, so a single
 * write on `focusout` lands before the pan it is meant to undo.
 */
const SETTLE_MS = 600;

/** Writes per second before we stop fighting something that keeps re-scrolling. */
const WRITE_BUDGET = 8;

export function DocumentScrollGuard(): null {
  useEffect(() => {
    const doc = document.scrollingElement;
    if (!doc) return;

    let frame = 0;
    let settling = 0;
    let settleUntil = 0;
    let writes = 0;
    let windowStartedAt = 0;

    const pin = () => {
      frame = 0;
      if (zoomed()) return;
      // While the keyboard is genuinely up, iOS's pan is doing a job: keeping
      // the field being typed in visible. Fighting it there would push the
      // weight input back under the keyboard and iOS would pan again — the
      // chase `use-keyboard-inset.ts` warns about. We heal when it closes,
      // which is what `settleUntil` keeps the door open for.
      if (keyboardCoverage() > 0 && performance.now() > settleUntil) return;
      if (doc.scrollTop === 0 && doc.scrollLeft === 0) return;

      // A tug-of-war we would lose is one to walk away from: if something is
      // re-scrolling the document every frame, pinning it every frame burns
      // battery mid-workout and fixes nothing. The next focus change or
      // foreground re-arms us.
      const now = performance.now();
      if (now - windowStartedAt > 1000) {
        windowStartedAt = now;
        writes = 0;
      }
      if ((writes += 1) > WRITE_BUDGET) return;

      // Assignment, not `window.scrollTo({ top: 0 })`: no behaviour to
      // negotiate with, nothing to animate, and it reads as what it is.
      doc.scrollTop = 0;
      doc.scrollLeft = 0;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(pin);
    };

    /* Re-assert across the keyboard's close animation rather than once. */
    const settle = () => {
      if (settling) return;
      const step = () => {
        pin();
        settling =
          performance.now() < settleUntil ? requestAnimationFrame(step) : 0;
      };
      settling = requestAnimationFrame(step);
    };

    /**
     * `scroll` on an element doesn't bubble, but `scroll` on the *document*
     * does and reaches `window` — so a bare window listener is already exactly
     * "the document moved". It never sees `#app-scroll`, a sheet body or the
     * heatmap strip, and needs no target check to prove it.
     */
    const onScroll = () => schedule();

    /* `focusout`, not `blur`: blur doesn't bubble and the field is a
       descendant. This is the moment the keyboard starts closing. */
    const onFocusOut = () => {
      settleUntil = performance.now() + SETTLE_MS;
      windowStartedAt = 0;
      writes = 0;
      settle();
    };

    /* Moving from the kg field to the reps field is a focusout followed
       immediately by a focusin, and the keyboard never leaves. Stand down. */
    const onFocusIn = () => {
      settleUntil = 0;
    };

    const vv = window.visualViewport;

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    // The keyboard opening and closing, and any pan iOS performs without
    // scrolling the layout viewport at all.
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    // Coming back from the app switcher, and a bfcache restore — both can hand
    // back an offset we never wrote.
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("orientationchange", schedule);

    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (settling) cancelAnimationFrame(settling);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);

  return null;
}
