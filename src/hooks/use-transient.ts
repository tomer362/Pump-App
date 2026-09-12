"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State that clears itself after a delay — a "Copied" tick, a row flash, a
 * cue that should stand down on its own.
 *
 * Every hand-rolled `setTimeout(() => setX(idle), ms)` in the app had the same
 * two holes: nothing cleared it on unmount, so a row removed mid-flash set
 * state on a dead component, and nothing cleared it on the next flash, so an
 * earlier timer could cut a newer flash short. Both are the hook's job now.
 */
export function useTransient<T>(idle: T, ms: number) {
  const [value, setValue] = useState<T>(idle);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const flash = useCallback(
    (next: T, holdMs = ms) => {
      clear();
      setValue(next);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setValue(idle);
      }, holdMs);
    },
    [clear, idle, ms],
  );

  const reset = useCallback(() => {
    clear();
    setValue(idle);
  }, [clear, idle]);

  useEffect(() => clear, [clear]);

  return [value, flash, reset] as const;
}
