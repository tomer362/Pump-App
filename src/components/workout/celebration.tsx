"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { AchievementIcon } from "@/components/achievement-icon";
import type { FinishSummary } from "@/lib/actions/workout";
import { formatDurationLong, formatWeight, haptic } from "@/lib/utils";
import { EASE_OUT_QUART } from "@/lib/motion";

/**
 * The pay-off screen. Sequence: checkmark strokes itself in → stats count up in
 * a stagger → PR/achievement cards rise → confetti, but only when a record was
 * actually set, so the celebration keeps meaning something.
 */
export function WorkoutCelebration({
  summary,
  unit,
  onDone,
}: {
  summary: FinishSummary;
  unit: "kg" | "lb";
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const hasPr = summary.prs.length > 0;

  useEffect(() => {
    haptic.success();
    if (!hasPr || reduce) return;
    let cancelled = false;
    // Loaded on demand so the ~7 kB canvas library never touches first paint.
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const fire = (particleRatio: number, opts: Record<string, unknown>) =>
        confetti({
          origin: { y: 0.42 },
          colors: ["#d7ff3e", "#ffd84d", "#ffffff"],
          disableForReducedMotion: true,
          particleCount: Math.floor(160 * particleRatio),
          ...opts,
        });
      window.setTimeout(() => {
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      }, 620);
    });
    return () => {
      cancelled = true;
    };
  }, [hasPr, reduce]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="bg-bg fixed inset-0 z-[60] overflow-y-auto overscroll-contain pt-safe pb-safe"
    >
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-6 py-10">
        <div className="flex flex-col items-center">
          <DrawnCheck />

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4, ease: EASE_OUT_QUART }}
            className="font-display mt-6 text-center text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em]"
          >
            Workout complete
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.68, duration: 0.4 }}
            className="text-text-3 mt-1.5 text-[14px]"
          >
            {hasPr
              ? `${summary.prs.length} new record${summary.prs.length === 1 ? "" : "s"}. Big day.`
              : "Logged and saved."}
          </motion.p>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3">
          <CountStat
            label="Duration"
            delay={0.8}
            value={formatDurationLong(summary.durationSeconds)}
          />
          <CountStat
            label="Volume"
            delay={0.9}
            countTo={summary.totalVolumeKg}
            format={(n) => formatWeight(n, unit)}
            unit={unit}
            accent
          />
          <CountStat label="Sets" delay={1.0} countTo={summary.totalSets} />
          <CountStat label="Reps" delay={1.1} countTo={summary.totalReps} />
        </div>

        {hasPr && (
          <div className="mt-8">
            <h2 className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Personal records
            </h2>
            <div className="space-y-2">
              {summary.prs.map((pr, i) => (
                <motion.div
                  key={`${pr.exerciseName}-${i}`}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 1.25 + i * 0.09,
                    type: "spring",
                    stiffness: 380,
                    damping: 26,
                  }}
                  className="border-pr/40 bg-pr-fade rounded-card flex items-center gap-3 border px-4 py-3"
                >
                  <span className="bg-pr grid size-9 shrink-0 place-items-center rounded-full text-black">
                    <Trophy className="size-[18px]" strokeWidth={2.4} />
                  </span>
                  {/* Name gets the full width; the numbers sit beneath it, so a
                      long exercise name isn't truncated by a trailing badge. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {pr.exerciseName}
                    </p>
                    <p className="text-text-3 num mt-0.5 flex items-center gap-2 text-[13px]">
                      {pr.weightKg != null && pr.reps != null && (
                        <span>
                          {formatWeight(pr.weightKg, unit)} {unit} × {pr.reps}
                        </span>
                      )}
                      <Badge tone="pr">
                        est. {formatWeight(pr.value, unit)} {unit}
                      </Badge>
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {summary.unlockedAchievements.length > 0 && (
          <div className="mt-8">
            <h2 className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Unlocked
            </h2>
            <div className="space-y-2">
              {summary.unlockedAchievements.map((a, i) => (
                <AchievementUnlock key={a.key} achievement={a} index={i} />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.4 }}
          className="pt-10"
        >
          <Button variant="volt" size="lg" block onClick={onDone}>
            Done
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** SVG checkmark that strokes itself in, then the ring settles behind it. */
function DrawnCheck() {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className="size-[104px]"
      initial={reduce ? {} : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
    >
      <motion.circle
        cx="60"
        cy="60"
        r="52"
        className="fill-volt-fade stroke-volt"
        strokeWidth="3"
        initial={reduce ? {} : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT_QUART }}
      />
      <motion.path
        d="M38 61 L53 76 L83 46"
        fill="none"
        className="stroke-volt"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? {} : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.28, duration: 0.38, ease: EASE_OUT_QUART }}
      />
    </motion.svg>
  );
}

function AchievementUnlock({
  achievement,
  index,
}: {
  achievement: { key: string; title: string; description: string; icon: string };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: 1.35 + index * 0.1,
        type: "spring",
        stiffness: 360,
        damping: 22,
      }}
      className="border-hairline bg-surface-1 rounded-card relative flex items-center gap-3 overflow-hidden border px-4 py-3"
    >
      {/* Shimmer sweep — reads as "medal catching the light". */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, transparent 35%, rgba(215,255,62,0.16) 50%, transparent 65%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.8s ease-out 1.6s 1",
        }}
      />
      <span className="bg-volt-fade text-volt grid size-9 shrink-0 place-items-center rounded-full">
        <AchievementIcon name={achievement.icon} className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold">{achievement.title}</p>
        <p className="text-text-3 truncate text-[13px]">
          {achievement.description}
        </p>
      </div>
    </motion.div>
  );
}

function CountStat({
  label,
  value,
  countTo,
  format,
  unit,
  accent,
  delay,
}: {
  label: string;
  value?: string;
  countTo?: number;
  format?: (n: number) => string;
  unit?: string;
  accent?: boolean;
  delay: number;
}) {
  const shown = useCountUp(countTo ?? 0, delay, countTo != null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE_OUT_QUART }}
      className="border-hairline bg-surface-1 rounded-card border px-4 py-3"
    >
      <p className="text-text-3 text-[11px] font-semibold tracking-[0.06em] uppercase">
        {label}
      </p>
      <p
        className={`num mt-1 text-[26px] leading-none font-bold ${
          accent ? "text-volt" : "text-text-1"
        }`}
      >
        {countTo != null ? (format ? format(shown) : Math.round(shown)) : value}
        {unit && (
          <span className="text-text-3 ml-1 text-[13px] font-semibold">
            {unit}
          </span>
        )}
      </p>
    </motion.div>
  );
}

/** Ease-out count-up driven by rAF. */
function useCountUp(target: number, delaySeconds: number, enabled: boolean) {
  const [animated, setAnimated] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const reduce = useReducedMotion();

  // With reduced motion the final value is shown outright — deriving it avoids
  // a state write inside the effect.
  const value = reduce ? target : animated;

  useEffect(() => {
    if (!enabled || reduce) return;
    const duration = 900;
    let startedAt: number | null = null;
    const timeout = window.setTimeout(() => {
      const step = (t: number) => {
        if (startedAt == null) startedAt = t;
        const p = Math.min(1, (t - startedAt) / duration);
        setAnimated(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    }, delaySeconds * 1000);

    return () => {
      window.clearTimeout(timeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, delaySeconds, enabled, reduce]);

  return value;
}
