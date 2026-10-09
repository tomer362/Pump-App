"use client";

import { useEffect, useState } from "react";
import { keyboardHeightOf, keyboardOverlapOf } from "@/lib/keyboard";

/*
 * iOS Safari does not resize the layout viewport when the keyboard opens, so a
 * bottom-docked control ends up underneath it. `visualViewport` is the only
 * reliable signal. Both readings return 0 when the keyboard is closed or
 * unsupported — and they answer different questions; see `lib/keyboard.ts`.
 */

function reading() {
  const vv = window.visualViewport;
  if (!vv) return null;
  return {
    innerHeight: window.innerHeight,
    vvHeight: vv.height,
    offsetTop: vv.offsetTop,
  };
}

/**
 * The keyboard's height, read once. Does not move when the page pans, which is
 * why `document-scroll-guard.tsx` asks this — a guard that thought the
 * keyboard had closed mid-typing would fight the field iOS just panned into
 * view.
 */
export function keyboardHeight(): number {
  const r = reading();
  return r ? keyboardHeightOf(r) : 0;
}

/** How much of the layout viewport's bottom the keyboard hides right now. */
export function keyboardOverlap(): number {
  const r = reading();
  return r ? keyboardOverlapOf(r) : 0;
}

/**
 * The same readings, as a subscription.
 *
 * `panAware` (the default) follows `keyboardOverlap` — for fixed chrome that
 * has to sit on the visible bottom edge. Pass `false` for padding *inside* the
 * page: a pan then changes nothing, so typing re-renders nothing.
 *
 * Android *does* resize the visual viewport, so every keyboard transition
 * re-renders each consumer. Keep that render cheap, and never let a consumer's
 * effects move focus off the field that opened the keyboard — that closes it,
 * which fires another resize, and the two chase each other.
 */
export function useKeyboardInset({ panAware = true } = {}) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const read = panAware ? keyboardOverlap : keyboardHeight;
    const update = () => {
      const next = read();
      // `scroll` fires far more often than the value changes; bail so the
      // consumer doesn't re-render on every tick.
      setInset((prev) => (prev === next ? prev : next));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [panAware]);

  return inset;
}
