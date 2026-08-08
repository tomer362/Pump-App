"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { AchievementIcon } from "@/components/achievement-icon";
import { Sheet } from "@/components/ui/sheet";
import { markAchievementsSeen } from "@/lib/actions/achievement-actions";
import type { AchievementRow } from "@/lib/queries/stats";
import { cn, haptic } from "@/lib/utils";
import { useMotionPreset } from "@/hooks/use-motion-preset";
import { REDUCED, STAGGER } from "@/lib/motion";

export function AchievementGrid({
  achievements,
}: {
  achievements: AchievementRow[];
}) {
  const { enabled } = useMotionPreset();
  const [selected, setSelected] = useState<AchievementRow | null>(null);
  const [, startTransition] = useTransition();
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  const hasUnseen = achievements.some(
    (a) => a.unlockedAt != null && a.seenAt == null,
  );

  // Seeing the grid is the acknowledgement. Deferred a beat so the marker is
  // actually visible on arrival rather than clearing before first paint.
  useEffect(() => {
    if (!hasUnseen) return;
    const id = window.setTimeout(() => {
      startTransition(async () => {
        await markAchievementsSeen();
      });
    }, 1500);
    return () => window.clearTimeout(id);
  }, [hasUnseen]);

  return (
    <>
      <div className="border-hairline bg-surface-1 rounded-card border p-3">
        <p className="text-text-3 mb-3 text-[12px]">
          <span className="num text-text-1 font-bold">{unlocked}</span> of{" "}
          <span className="num">{achievements.length}</span> unlocked
        </p>
        <div className="grid grid-cols-4 gap-2.5">
          {achievements.map((a, i) => {
            const isUnlocked = a.unlockedAt != null;
            const isNew = isUnlocked && a.seenAt == null;
            return (
              <motion.button
                key={a.key}
                onClick={() => {
                  haptic.light();
                  setSelected(a);
                }}
                initial={{ opacity: 0, scale: enabled ? 0.9 : 1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  enabled
                    ? { delay: Math.min(i * STAGGER, 0.4), duration: 0.25 }
                    : REDUCED
                }
                className="press flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "relative grid aspect-square w-full place-items-center rounded-[14px] border transition-colors",
                    isUnlocked
                      ? "border-volt/40 bg-volt-fade text-volt"
                      : "border-hairline bg-surface-2 text-text-3/50",
                  )}
                >
                  {isNew && (
                    <span
                      aria-label="New"
                      className="bg-volt ring-bg absolute -top-1 -right-1 size-2.5 rounded-full ring-2"
                    />
                  )}
                  {isUnlocked ? (
                    <AchievementIcon name={a.icon} className="size-6" />
                  ) : (
                    <Lock className="size-4" strokeWidth={2.2} />
                  )}
                </span>
                <span
                  className={cn(
                    "line-clamp-2 text-center text-[10px] leading-tight",
                    isUnlocked ? "text-text-2" : "text-text-3/60",
                  )}
                >
                  {a.title}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <Sheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected?.title}
      >
        {selected && (
          <div className="flex flex-col items-center px-6 pb-8 text-center">
            <span
              className={cn(
                "grid size-20 place-items-center rounded-[22px] border",
                selected.unlockedAt
                  ? "border-volt/40 bg-volt-fade text-volt"
                  : "border-hairline bg-surface-2 text-text-3/50",
              )}
            >
              {selected.unlockedAt ? (
                <AchievementIcon name={selected.icon} className="size-9" />
              ) : (
                <Lock className="size-7" strokeWidth={2} />
              )}
            </span>
            <p className="text-text-2 mt-4 text-[15px] leading-relaxed">
              {selected.description}
            </p>
            <p className="text-text-3 mt-3 text-[13px]">
              {selected.unlockedAt
                ? `Unlocked ${new Date(selected.unlockedAt).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}`
                : "Not unlocked yet"}
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
