"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { cn, formatDuration, haptic } from "@/lib/utils";
import type { Block } from "./workout-screen";

type Phase = "ready" | "work" | "rest" | "done";

/**
 * Full-screen interval timer with spoken cues — the phone is usually on the
 * floor during these, so the audio channel matters more than the visual one.
 */
export function IntervalRunner({
  block,
  onClose,
  onRoundComplete,
}: {
  block: Block;
  onClose: () => void;
  /**
   * Called as each work phase finishes. Without this the runner was a pretty
   * standalone clock that recorded nothing — an interval-only workout could
   * never be finished, because Finish requires at least one completed set.
   */
  onRoundComplete: (setIndex: number, seconds: number) => void;
}) {
  const work = block.intervalWorkSeconds ?? 30;
  const rest = block.intervalRestSeconds ?? 30;
  const rounds = Math.max(1, block.sets.length);

  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(work);
  const [running, setRunning] = useState(false);
  const [speech, setSpeech] = useState(true);

  const endsAt = useRef<number | null>(null);
  const spokenAt = useRef<number | null>(null);

  const say = useCallback(
    (text: string) => {
      if (!speech) return;
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.pitch = 1;
        u.lang = "en-GB";
        synth.speak(u);
      } catch {
        /* Speech is an enhancement — silence is an acceptable fallback. */
      }
    },
    [speech],
  );

  const beginPhase = useCallback(
    (next: Phase, seconds: number, nextRound: number) => {
      setPhase(next);
      setRound(nextRound);
      setRemaining(seconds);
      endsAt.current = Date.now() + seconds * 1000;
      spokenAt.current = null;
      if (next === "work") say(`Round ${nextRound}. Go.`);
      if (next === "rest") say("Rest.");
      haptic.medium();
    },
    [say],
  );

  // Wall-clock driven, same as the rest timer, so backgrounding can't drift it.
  useEffect(() => {
    if (!running || phase === "done" || phase === "ready") return;

    const tick = () => {
      if (endsAt.current == null) return;
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);

      if (left <= 3 && left > 0 && spokenAt.current !== left) {
        spokenAt.current = left;
        say(String(left));
        haptic.light();
      }

      if (left === 0) {
        if (phase === "work") {
          // Record the work phase that just completed. `round` is 1-based.
          onRoundComplete(round - 1, work);
          if (round >= rounds) {
            setPhase("done");
            setRunning(false);
            say("Finished. Well done.");
            haptic.success();
          } else if (rest > 0) {
            beginPhase("rest", rest, round);
          } else {
            beginPhase("work", work, round + 1);
          }
        } else {
          beginPhase("work", work, round + 1);
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 200);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running, phase, round, rounds, rest, work, beginPhase, say, onRoundComplete]);

  function start() {
    // Speaking on the tap satisfies iOS's gesture requirement for audio.
    beginPhase("work", work, 1);
    setRunning(true);
  }

  function togglePause() {
    if (!running) {
      endsAt.current = Date.now() + remaining * 1000;
      setRunning(true);
    } else {
      setRunning(false);
      window.speechSynthesis?.cancel();
    }
  }

  function reset() {
    setRunning(false);
    setPhase("ready");
    setRound(1);
    setRemaining(work);
    endsAt.current = null;
    window.speechSynthesis?.cancel();
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const total = phase === "rest" ? rest : work;
  const progress = total > 0 ? remaining / total : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "fixed inset-0 z-50 flex flex-col pt-safe pb-safe",
        phase === "work" ? "bg-volt text-black" : "bg-bg text-text-1",
      )}
      style={{ transition: "background-color 300ms ease" }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <IconButton
          label="Toggle voice cues"
          onClick={() => setSpeech((v) => !v)}
          className={phase === "work" ? "text-black/70" : "text-text-2"}
        >
          {speech ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </IconButton>
        <span className="truncate px-2 text-[14px] font-semibold opacity-70">
          {block.name}
        </span>
        <IconButton
          label="Close"
          onClick={onClose}
          className={phase === "work" ? "text-black/70" : "text-text-2"}
        >
          <X className="size-5" />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-[12px] font-bold tracking-[0.16em] uppercase opacity-60">
          {phase === "ready"
            ? "Ready"
            : phase === "done"
              ? "Complete"
              : phase === "work"
                ? "Work"
                : "Rest"}
        </p>

        <div className="relative my-6 grid place-items-center">
          <svg viewBox="0 0 200 200" className="size-64 -rotate-90">
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              strokeWidth="8"
              className={phase === "work" ? "stroke-black/15" : "stroke-surface-2"}
            />
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={phase === "work" ? "stroke-black" : "stroke-volt"}
              strokeDasharray={2 * Math.PI * 92}
              strokeDashoffset={2 * Math.PI * 92 * (1 - progress)}
              style={{ transition: "stroke-dashoffset 200ms linear" }}
            />
          </svg>
          <span className="num absolute text-[64px] leading-none font-extrabold">
            {formatDuration(remaining)}
          </span>
        </div>

        <p className="num text-[15px] font-semibold opacity-70">
          Round {round} of {rounds}
        </p>
        <p className="num mt-1 text-[13px] opacity-50">
          {work}s work · {rest}s rest
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 px-6 pb-8">
        {phase === "ready" ? (
          <Button variant={"volt"} size="lg" block onClick={start}>
            <Play className="size-5" fill="currentColor" />
            Start
          </Button>
        ) : phase === "done" ? (
          <>
            <Button variant="solid" size="lg" block onClick={reset}>
              <RotateCcw className="size-5" />
              Again
            </Button>
            <Button variant="volt" size="lg" block onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button
              variant={phase === "work" ? "solid" : "solid"}
              size="lg"
              className={phase === "work" ? "bg-black/15 text-black" : ""}
              onClick={reset}
            >
              <RotateCcw className="size-5" />
            </Button>
            <Button
              variant="solid"
              size="lg"
              block
              className={phase === "work" ? "bg-black text-volt" : ""}
              onClick={togglePause}
            >
              {running ? (
                <>
                  <Pause className="size-5" fill="currentColor" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="size-5" fill="currentColor" />
                  Resume
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
