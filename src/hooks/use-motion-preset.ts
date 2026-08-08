"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { ENTER, REDUCED, SPRING } from "@/lib/motion";

/**
 * Motion transitions that already respect the OS reduced-motion setting.
 *
 * The global CSS override cannot reach `motion`'s JS-driven transforms, so
 * honouring the preference has to happen at each call site. One hook per file
 * beats a hand-written ternary per transition, which is how thirteen of the
 * seventeen motion components ended up ignoring the setting entirely.
 *
 * `enabled` is for the cases a transition can't express: a slide that should
 * become a cross-fade, or a burst that shouldn't happen at all.
 */
export function useMotionPreset() {
  const reduce = useReducedMotion();

  return useMemo(() => {
    if (reduce) {
      return {
        enabled: false,
        spring: {
          snappy: REDUCED,
          sheet: REDUCED,
          pop: REDUCED,
          snap: REDUCED,
        },
        enter: REDUCED,
      } as const;
    }
    return { enabled: true, spring: SPRING, enter: ENTER } as const;
  }, [reduce]);
}
