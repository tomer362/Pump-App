"use client";

import { useEffect, useState } from "react";

/**
 * Seconds since `start`, ticking once a second.
 *
 * Derives from wall-clock time rather than accumulating a counter, so it stays
 * correct when the tab is backgrounded — mobile browsers throttle timers hard,
 * and an incrementing counter drifts badly during a real workout.
 */
export function useElapsed(start: Date | string | number, running = true) {
  const startMs =
    typeof start === "number"
      ? start
      : start instanceof Date
        ? start.getTime()
        : new Date(start).getTime();

  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startMs) / 1000)),
  );

  useEffect(() => {
    if (!running) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    // Resync the instant we come back from the background.
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [startMs, running]);

  return seconds;
}
