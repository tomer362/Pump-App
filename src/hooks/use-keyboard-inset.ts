"use client";

import { useEffect, useState } from "react";

/**
 * Height currently covered by the on-screen keyboard, in px.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens, so a
 * bottom-docked control ends up underneath it. `visualViewport` is the only
 * reliable signal. Returns 0 when the keyboard is closed or unsupported.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // Ignore small deltas: the URL bar collapsing is not a keyboard.
      setInset(covered > 120 ? Math.round(covered) : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
