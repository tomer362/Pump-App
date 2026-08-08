"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { toggleRoutineLike } from "@/lib/actions/routine-social";
import { cn, haptic } from "@/lib/utils";
import { ENTER, REDUCED } from "@/lib/motion";
import { useMotionPreset } from "@/hooks/use-motion-preset";

/**
 * Optimistic, then reconciled from the server's count — the same shape the feed
 * post uses. A like has to feel free on a phone, and the server round trip is a
 * cold Neon query away.
 */
export function RoutineLikeButton({
  routineId,
  initialLiked,
  initialCount,
  size = "md",
}: {
  routineId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
}) {
  const { enabled } = useMotionPreset();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [burst, setBurst] = useState(0);
  const [, startTransition] = useTransition();

  function onLike(e: React.MouseEvent) {
    // Cards are wrapped in a link; liking must not navigate.
    e.preventDefault();
    e.stopPropagation();

    const next = !liked;
    setLiked(next);
    setCount((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      haptic.medium();
      setBurst((n) => n + 1);
    }
    startTransition(async () => {
      const res = await toggleRoutineLike(routineId);
      if (res.ok && res.data) {
        setLiked(res.data.liked);
        setCount(res.data.likeCount);
      } else if (!res.ok) {
        // Put the optimistic change back — a refused like that keeps showing as
        // liked is worse than no feedback at all.
        setLiked(!next);
        setCount((n) => Math.max(0, n + (next ? -1 : 1)));
      }
    });
  }

  const icon = size === "sm" ? "size-[17px]" : "size-[19px]";

  return (
    <button
      onClick={onLike}
      aria-pressed={liked}
      aria-label={liked ? "Unlike routine" : "Like routine"}
      className="press tap relative flex items-center gap-1.5 px-2.5 py-2"
    >
      <motion.span
        key={burst}
        animate={
          enabled && liked && burst > 0
            ? { scale: [1, 1.35, 0.92, 1] }
            : { scale: 1 }
        }
        transition={enabled ? ENTER : REDUCED}
        className="inline-flex"
      >
        <Heart
          className={cn(
            icon,
            "transition-colors",
            liked ? "fill-volt text-volt" : "text-text-3",
          )}
          strokeWidth={2.2}
        />
      </motion.span>
      <span
        className={cn(
          "num text-[13px] font-semibold",
          liked ? "text-volt" : "text-text-3",
        )}
      >
        {count > 0 ? count : ""}
      </span>
    </button>
  );
}
