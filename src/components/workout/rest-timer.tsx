"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { cn, formatDuration, haptic } from "@/lib/utils";

export type RestTimerState = {
  /** Wall-clock end time. Survives backgrounding; a counter would not. */
  endsAt: number;
  totalSeconds: number;
} | null;

/**
 * Rest timer state. Everything is derived from an absolute end timestamp so a
 * throttled background tab, a lock screen, or a browser tab switch can't make
 * the timer drift — the single most common failure of web-based trackers.
 */
export function useRestTimer() {
  const [state, setState] = useState<RestTimerState>(null);
  const [ticked, setTicked] = useState(0);
  const firedRef = useRef(false);

  // Derived, not stored: with no timer running there is nothing to count down,
  // so resetting via setState in an effect would only cause a second render.
  const remaining = state ? ticked : 0;

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    firedRef.current = false;
    setState({ endsAt: Date.now() + seconds * 1000, totalSeconds: seconds });
  }, []);

  const stop = useCallback(() => setState(null), []);

  const adjust = useCallback((delta: number) => {
    setState((s) => {
      if (!s) return s;
      const next = Math.max(0, s.endsAt + delta * 1000);
      return { endsAt: next, totalSeconds: Math.max(1, s.totalSeconds + delta) };
    });
  }, []);

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
      const id = window.setTimeout(() => setState(null), 2500);
      return () => window.clearTimeout(id);
    }
  }, [state, remaining]);

  return { state, remaining, start, stop, adjust, running: state != null };
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

export function RestTimerBar({
  state,
  remaining,
  onStop,
  onAdjust,
}: {
  state: RestTimerState;
  remaining: number;
  onStop: () => void;
  onAdjust: (delta: number) => void;
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

              {expanded && !done && (
                <div className="hairline-t relative flex gap-2 px-3 py-2.5">
                  {[30, 60, 90, 120, 180].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        haptic.light();
                        onAdjust(s - remaining);
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
