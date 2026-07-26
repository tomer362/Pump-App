"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { AchievementIcon } from "@/components/achievement-icon";
import { Sheet } from "@/components/ui/sheet";
import type { AchievementRow } from "@/lib/queries/stats";
import { cn, haptic } from "@/lib/utils";

export function AchievementGrid({
  achievements,
}: {
  achievements: AchievementRow[];
}) {
  const [selected, setSelected] = useState<AchievementRow | null>(null);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;

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
            return (
              <motion.button
                key={a.key}
                onClick={() => {
                  haptic.light();
                  setSelected(a);
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.25 }}
                className="press flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "grid aspect-square w-full place-items-center rounded-[14px] border transition-colors",
                    isUnlocked
                      ? "border-volt/40 bg-volt-fade text-volt"
                      : "border-hairline bg-surface-2 text-text-3/50",
                  )}
                >
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
