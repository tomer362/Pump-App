"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { cn, formatDuration, haptic } from "@/lib/utils";
import {
  armRestChime,
  cancelRestChime,
  playRestChime,
  primeRestAudio,
} from "@/lib/rest-audio";
import { SPRING } from "@/lib/motion";
import { REDUCED } from "@/lib/motion";
import { useMotionPreset } from "@/hooks/use-motion-preset";

export type RestTimerState = {
  /** Wall-clock end time. Survives backgrounding; a counter would not. */
  endsAt: number;
  totalSeconds: number;
  /**
   * The set this rest follows, so the strip sitting in that gap can show the
   * same countdown as the bar. Persisted with the rest of the state — a reload
   * mid-rest that restored the clock but forgot whose gap it was would leave
   * two numbers on screen disagreeing, which is the thing this exists to stop.
   */
  setId: string | null;
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
      setId?: string | null;
      workoutId: string;
    };
    // Only this workout's timer, and only if it hasn't already run out.
    if (saved.workoutId !== workoutId) return null;
    if (saved.endsAt <= Date.now()) return null;
    return {
      endsAt: saved.endsAt,
      totalSeconds: saved.totalSeconds,
      setId: saved.setId ?? null,
    };
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

/* -------------------------------------------------------------------------- */
/* The countdown, also in the store.                                           */
/*                                                                             */
/* It used to be `useState` inside `useRestTimer`, whose caller is the entire   */
/* workout screen — so every quarter-second re-rendered the whole set table,    */
/* and a tap on ±15s had to wait for one of those renders before the digits or  */
/* the track could move. Here, one module-level interval owns the clock, the    */
/* seconds are a snapshot alongside the timer itself, and `setTimerState`       */
/* recomputes them *synchronously*: the adjust and the number it produces are   */
/* one update. The workout screen reads only `current`, whose identity doesn't  */
/* change on a tick, so `useSyncExternalStore` bails out and it never re-renders*/
/* for the clock at all.                                                        */
/* -------------------------------------------------------------------------- */

let remainingNow = 0;
let ticker: number | null = null;
let clearTimer: number | null = null;
/** The `endsAt` that has already buzzed, so an extended rest can buzz again. */
let chimedFor: number | null = null;

function secondsLeft(state: RestTimerState) {
  return state ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) : 0;
}

/** Re-read the clock. Returns whether the displayed second actually moved. */
function recompute(): boolean {
  const next = secondsLeft(current);
  if (current && next === 0 && chimedFor !== current.endsAt) {
    chimedFor = current.endsAt;
    haptic.success();
    // The sound is keyed on the same `endsAt` inside `rest-audio`, so this and
    // the copy that was scheduled to fire while the phone was asleep are the
    // same event and only one of them is ever heard.
    void playRestChime(current.endsAt);
  }
  if (next === remainingNow) return false;
  remainingNow = next;
  return true;
}

/** Clear a couple of seconds after it hits zero, so the "0:00" is seen. */
function scheduleAutoClear() {
  if (clearTimer != null) {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (current && remainingNow === 0) {
    clearTimer = window.setTimeout(() => {
      clearTimer = null;
      setTimerState(null);
    }, 2500);
  }
}

function onVisible() {
  // Browsers throttle intervals in a backgrounded tab, so the first thing to do
  // on return is re-read the clock rather than trust the last tick.
  if (document.visibilityState !== "visible") return;
  if (recompute()) {
    scheduleAutoClear();
    emit();
  }
}

function startTicker() {
  if (ticker != null) return;
  ticker = window.setInterval(() => {
    if (!recompute()) return;
    scheduleAutoClear();
    emit();
  }, 250);
  document.addEventListener("visibilitychange", onVisible);
}

function stopTicker() {
  if (ticker == null) return;
  window.clearInterval(ticker);
  ticker = null;
  document.removeEventListener("visibilitychange", onVisible);
}

function setTimerState(next: RestTimerState) {
  current = next;
  writeStorage(current, currentWorkoutId);
  if (next) startTicker();
  else stopTicker();
  // Schedule the sound the instant the rest starts, while the app is still in
  // the foreground — by the time the phone is in a pocket there is nothing left
  // running that could do it. See `lib/rest-audio.ts`.
  if (next) armRestChime(next.endsAt);
  else cancelRestChime();
  // Before the emit, so subscribers see the new state and its seconds together.
  recompute();
  scheduleAutoClear();
  emit();
}

/**
 * Rest timer state. Everything is derived from an absolute end timestamp so a
 * throttled background tab, a lock screen, or a tab switch can't make the
 * timer drift — the single most common failure of web-based trackers.
 *
 * This hook deliberately does **not** count. Its caller is the whole workout
 * screen; if the seconds lived here, every tick would re-render the entire set
 * table, and a tap on ±15s would queue behind that work instead of landing on
 * the next frame. The countdown lives inside the bar, which is the only thing
 * that displays it — this hook changes only when a rest starts, stops, or is
 * adjusted.
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
        // Before the auto-clear check — with `remainingNow` still at its
        // initial 0, a restored rest would look finished and be swept away.
        recompute();
        scheduleAutoClear();
      }
      return subscribeTick(onChange);
    },
    [workoutId],
  );

  const state = useSyncExternalStore(
    subscribe,
    () => current,
    // The server has no sessionStorage — and no timer can be running there.
    () => null,
  );

  const start = useCallback(
    (seconds: number, setId: string | null = null) => {
      if (seconds <= 0) return;
      // Inside the tap that ticked the set: iOS only lets a gesture unlock
      // audio, and every later scheduling depends on that having happened.
      primeRestAudio();
      currentWorkoutId = workoutId ?? null;
      setTimerState({
        endsAt: Date.now() + seconds * 1000,
        totalSeconds: seconds,
        setId,
      });
    },
    [workoutId],
  );

  const stop = useCallback(() => setTimerState(null), []);

  /** Shift the end time by `delta` seconds, never below "now". */
  const adjust = useCallback((delta: number) => {
    if (!current) return;
    // Also a tap, so also a chance to unlock audio — this is the one that
    // rescues a rest restored from storage after a reload, which had no gesture
    // of its own to prime from.
    primeRestAudio();
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
    setTimerState({ endsAt, totalSeconds, setId: current.setId });
  }, []);

  /** Restart at an exact duration — what the presets want. */
  const setDuration = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      primeRestAudio();
      currentWorkoutId = workoutId ?? null;
      setTimerState({
        endsAt: Date.now() + seconds * 1000,
        totalSeconds: seconds,
        // Still the same gap: the presets change how long it is, not what it is.
        setId: current?.setId ?? null,
      });
    },
    [workoutId],
  );

  return {
    state,
    start,
    stop,
    adjust,
    setDuration,
    running: state != null,
  };
}

/**
 * Shared by both hooks. The interval runs only while something is subscribed
 * *and* a rest is running, so navigating off the workout screen mid-rest leaves
 * nothing ticking — the timer is an absolute timestamp and picks itself back up
 * on return.
 */
function subscribeTick(onChange: () => void) {
  listeners.add(onChange);
  if (current) {
    startTicker();
    // Catch up after a gap; the caller re-reads the snapshot right after this.
    // If this is the read that lands on zero, the interval's own recompute will
    // return false and never get round to the sweep, so do it here.
    if (recompute()) scheduleAutoClear();
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) stopTicker();
  };
}

/**
 * Seconds left on the running rest. Only the bar and the one rest strip whose
 * gap is running subscribe to this, so a tick re-renders two leaves and never
 * the set table.
 */
export function useRemaining() {
  return useSyncExternalStore(
    subscribeTick,
    () => remainingNow,
    () => 0,
  );
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

export function RestTimerBar(props: {
  state: RestTimerState;
  nextUp?: NextUp | null;
  onStop: () => void;
  onAdjust: (delta: number) => void;
  onSetDuration: (seconds: number) => void;
  /**
   * Put the bar away without touching the clock. The rest goes on running —
   * the strip in the gap is still counting it down — so this is a panel
   * closing, not a rest being skipped. See the dismissal effect below.
   */
  onDismiss?: () => void;
}) {
  const { state, ...rest } = props;
  return (
    <AnimatePresence>
      {state && <RestTimerPanel key="rest" state={state} {...rest} />}
    </AnimatePresence>
  );
}

function RestTimerPanel({
  state,
  nextUp,
  onStop,
  onAdjust,
  onSetDuration,
  onDismiss,
}: {
  state: NonNullable<RestTimerState>;
  nextUp?: NextUp | null;
  onStop: () => void;
  onAdjust: (delta: number) => void;
  onSetDuration: (seconds: number) => void;
  onDismiss?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const remaining = useRemaining();
  const { enabled } = useMotionPreset();
  const panel = useRef<HTMLDivElement>(null);

  const progress = remaining / state.totalSeconds;
  const urgent = remaining > 0 && remaining <= 3;
  const done = remaining === 0;

  useEffect(() => {
    if (urgent) haptic.light();
  }, [urgent, remaining]);

  /**
   * Anything else you do puts the bar away.
   *
   * The panel is summoned by tapping the running strip, so it is transient by
   * construction — it must not be something you then have to dismiss. A touch
   * anywhere outside it, or a scroll, is you going back to the workout, and
   * the rest carries on regardless: only the panel closes.
   *
   * `pointerdown` in the capture phase, so the dismissal lands before whatever
   * you actually tapped runs — and `scroll` in capture too, because scroll
   * doesn't bubble and the app's one scroller is the container in the root
   * layout, which this component has no ref to.
   */
  useEffect(() => {
    if (!onDismiss) return;
    const away = (e: Event) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      onDismiss();
    };
    const scrolled = () => onDismiss();
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("scroll", scrolled, true);
    };
  }, [onDismiss]);

  return (
    <motion.div
      ref={panel}
      initial={enabled ? { y: 80 } : { opacity: 0 }}
      animate={enabled ? { y: 0 } : { opacity: 1 }}
      exit={enabled ? { y: 80, opacity: 0 } : { opacity: 0 }}
      transition={enabled ? SPRING.snappy : REDUCED}
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
          {/* Draining track — the primary read at a glance.

              Keyed on `endsAt` so ±15s remounts it: a fifth of the bar's width
              eased over 250ms reads as the track lagging behind the thumb,
              whereas a fresh element simply starts at its new length. Between
              adjusts the key holds and the per-second drain animates. */}
          {!done && (
            <div
              key={state.endsAt}
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
  );
}
