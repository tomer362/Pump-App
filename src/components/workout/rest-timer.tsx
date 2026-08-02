"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { cn, formatDuration, haptic } from "@/lib/utils";

export type RestTimerState = {
  /** Wall-clock end time. Survives backgrounding; a counter would not. */
  endsAt: number;
  totalSeconds: number;
} | null;

const STORAGE_KEY = "pump.rest-timer";

/* -------------------------------------------------------------------------- */
/* The running timer as an external store.                                     */
/*                                                                             */
/* It has to survive a reload mid-rest — losing a countdown to a stray refresh */
/* is the most jarring failure this screen has — which means seeding it from   */
/* sessionStorage. Doing that in a `useState` initialiser makes the first      */
/* client render disagree with the server HTML, and React responds by throwing */
/* away the subtree: the bar you were restoring is the thing that gets         */
/* remounted. An external store gets this right by construction — the server   */
/* snapshot is null, matching the HTML, and React re-reads the client snapshot */
/* immediately after subscribing.                                              */
/* -------------------------------------------------------------------------- */

let current: RestTimerState = null;
let currentWorkoutId: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStorage(workoutId: string | undefined): RestTimerState {
  if (!workoutId) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as {
      endsAt: number;
      totalSeconds: number;
      workoutId: string;
    };
    // Only this workout's timer, and only if it hasn't already run out.
    if (saved.workoutId !== workoutId) return null;
    if (saved.endsAt <= Date.now()) return null;
    return { endsAt: saved.endsAt, totalSeconds: saved.totalSeconds };
  } catch {
    return null;
  }
}

function writeStorage(state: RestTimerState, workoutId: string | null) {
  try {
    if (state && workoutId) {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, workoutId }),
      );
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* Private mode can refuse writes; the timer still works in-session. */
  }
}

function setTimerState(next: RestTimerState) {
  current = next;
  writeStorage(current, currentWorkoutId);
  emit();
}

/**
 * Rest timer state. Everything is derived from an absolute end timestamp so a
 * throttled background tab, a lock screen, or a tab switch can't make the
 * timer drift — the single most common failure of web-based trackers.
 */
export function useRestTimer(workoutId?: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // First subscription happens after mount, so the restore lands in the
      // post-hydration re-read rather than during render.
      if (!loaded) {
        loaded = true;
        currentWorkoutId = workoutId ?? null;
        current = readStorage(workoutId);
      }
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    [workoutId],
  );

  const state = useSyncExternalStore(
    subscribe,
    () => current,
    // The server has no sessionStorage — and no timer can be running there.
    () => null,
  );

  const [ticked, setTicked] = useState(0);
  const firedRef = useRef(false);

  // Derived, not stored: with no timer running there is nothing to count down,
  // so resetting via setState in an effect would only cause a second render.
  const remaining = state ? ticked : 0;

  const start = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      firedRef.current = false;
      currentWorkoutId = workoutId ?? null;
      setTimerState({
        endsAt: Date.now() + seconds * 1000,
        totalSeconds: seconds,
      });
    },
    [workoutId],
  );

  const stop = useCallback(() => setTimerState(null), []);

  /** Shift the end time by `delta` seconds, never below "now". */
  const adjust = useCallback((delta: number) => {
    if (!current) return;
    const now = Date.now();
    // Clamp against the present, not against epoch zero — clamping the
    // absolute timestamp to 0 would jump the timer back to 1970.
    const endsAt = Math.max(now, current.endsAt + delta * 1000);
    // Keep the denominator consistent with the new duration so the draining
    // track stays proportional.
    const totalSeconds = Math.max(
      1,
      Math.ceil((endsAt - now) / 1000),
      current.totalSeconds + delta,
    );
    setTimerState({ endsAt, totalSeconds });
  }, []);

  /** Restart at an exact duration — what the presets want. */
  const setDuration = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      firedRef.current = false;
      currentWorkoutId = workoutId ?? null;
      setTimerState({
        endsAt: Date.now() + seconds * 1000,
        totalSeconds: seconds,
      });
    },
    [workoutId],
  );

  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
      setTicked(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        haptic.success();
        // Timer finishing while the phone is in a pocket needs a sound too.
        void playChime();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state]);

  // Clear a couple of seconds after it hits zero, so the "0:00" is seen.
  useEffect(() => {
    if (state && remaining === 0) {
      const id = window.setTimeout(() => setTimerState(null), 2500);
      return () => window.clearTimeout(id);
    }
  }, [state, remaining]);

  return {
    state,
    remaining,
    start,
    stop,
    adjust,
    setDuration,
    running: state != null,
  };
}

/** Short synthesised beep — avoids shipping an audio asset. */
async function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // iOS suspends contexts created without a gesture; resume is a no-op if allowed.
    if (ctx.state === "suspended") await ctx.resume();
    const now = ctx.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.2);
    }
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* Audio is a nicety; never let it break the workout. */
  }
}

/** What the rest is for: the set the lifter stands up and does next. */
export type NextUp = {
  /** Exercise name. */
  name: string;
  /** Superset letter, when the next set belongs to a group. */
  supersetGroup?: string | null;
  /** "Set 3", or "Warm-up". */
  setLabel: string;
  /** The numbers to hit — "52.5 kg × 8". Null when nothing is known yet. */
  target: string | null;
  onJump: () => void;
};

export function RestTimerBar({
  state,
  remaining,
  nextUp,
  onStop,
  onAdjust,
  onSetDuration,
}: {
  state: RestTimerState;
  remaining: number;
  nextUp?: NextUp | null;
  onStop: () => void;
  onAdjust: (delta: number) => void;
  onSetDuration: (seconds: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const progress = state ? remaining / state.totalSeconds : 0;
  const urgent = remaining > 0 && remaining <= 3;
  const done = state != null && remaining === 0;

  useEffect(() => {
    if (urgent) haptic.light();
  }, [urgent, remaining]);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="fixed inset-x-0 bottom-0 z-40"
        >
          <div className="mx-auto max-w-lg px-3 pb-3 mb-safe">
            <div
              className={cn(
                "relative overflow-hidden rounded-card border transition-colors",
                done
                  ? "border-volt bg-volt text-black"
                  : "border-hairline bg-surface-1",
              )}
            >
              {/* Draining track — the primary read at a glance. */}
              {!done && (
                <div
                  className="bg-volt-fade absolute inset-y-0 left-0 origin-left"
                  style={{
                    width: "100%",
                    transform: `scaleX(${progress})`,
                    transition: "transform 250ms linear",
                  }}
                />
              )}

              <div className="relative flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => {
                    haptic.light();
                    onAdjust(-15);
                  }}
                  aria-label="Subtract 15 seconds"
                  className={cn(
                    "press tap grid place-items-center rounded-[10px] px-2",
                    done ? "text-black/60" : "bg-surface-2 text-text-2",
                  )}
                  disabled={done}
                >
                  <Minus className="size-4" strokeWidth={2.6} />
                </button>

                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="press flex min-w-0 flex-1 flex-col items-center"
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold tracking-[0.1em] uppercase",
                      done ? "text-black/60" : "text-text-3",
                    )}
                  >
                    {done ? "Rest complete" : "Rest"}
                  </span>
                  <span
                    className={cn(
                      "num text-[26px] leading-none font-bold",
                      urgent && "animate-pulse-volt text-volt",
                      done && "text-black",
                    )}
                  >
                    {formatDuration(remaining)}
                  </span>
                </button>

                <button
                  onClick={() => {
                    haptic.light();
                    onAdjust(15);
                  }}
                  aria-label="Add 15 seconds"
                  className={cn(
                    "press tap grid place-items-center rounded-[10px] px-2",
                    done ? "text-black/60" : "bg-surface-2 text-text-2",
                  )}
                  disabled={done}
                >
                  <Plus className="size-4" strokeWidth={2.6} />
                </button>

                <button
                  onClick={() => {
                    haptic.light();
                    onStop();
                  }}
                  aria-label="Skip rest"
                  className={cn(
                    "press tap grid place-items-center rounded-[10px] px-2",
                    done ? "text-black" : "text-text-3",
                  )}
                >
                  <X className="size-5" strokeWidth={2.4} />
                </button>
              </div>

              {/* The two minutes of rest are the one stretch of the session
                  where the lifter is looking at the screen with nothing to do,
                  so the bar says what the rest is *for*. Tapping it scrolls the
                  row into place, which is otherwise a scroll hunt with a
                  countdown running. */}
              {nextUp && (
                <button
                  onClick={nextUp.onJump}
                  className={cn(
                    "press relative flex w-full items-center gap-2 px-3 py-2 text-left",
                    done ? "border-t border-black/15" : "hairline-t",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-bold tracking-[0.1em] uppercase",
                      done ? "text-black/60" : "text-text-3",
                    )}
                  >
                    Next
                  </span>
                  {nextUp.supersetGroup && (
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border text-[9px] font-bold",
                        done
                          ? "border-black/40 text-black/70"
                          : "text-volt border-volt/50",
                      )}
                    >
                      {nextUp.supersetGroup}
                    </span>
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] font-semibold",
                      done ? "text-black" : "text-text-1",
                    )}
                  >
                    {nextUp.name}
                  </span>
                  <span
                    className={cn(
                      "num shrink-0 text-[12px]",
                      done ? "text-black/70" : "text-text-2",
                    )}
                  >
                    {nextUp.setLabel}
                    {nextUp.target && ` · ${nextUp.target}`}
                  </span>
                </button>
              )}

              {expanded && !done && (
                <div className="hairline-t relative flex gap-2 px-3 py-2.5">
                  {[30, 60, 90, 120, 180].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        haptic.light();
                        onSetDuration(s);
                      }}
                      className="press num bg-surface-2 text-text-2 h-9 flex-1 rounded-[10px] text-[13px] font-semibold"
                    >
                      {s < 60 ? `${s}s` : `${s / 60}m`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
