"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Elapsed } from "@/components/ui/elapsed";
import type { ActiveWorkoutSummary } from "@/lib/queries/workout";
import { SPRING } from "@/lib/motion";
import { REDUCED } from "@/lib/motion";
import { useMotionPreset } from "@/hooks/use-motion-preset";
import { useWorkoutEnded } from "@/lib/ended-workouts";

/**
 * Persistent "you have a workout running" bar. Sits directly above the tab bar
 * so leaving the workout screen never feels like losing the session.
 */
export function ActiveWorkoutPill({
  workout,
}: {
  workout: ActiveWorkoutSummary;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { enabled } = useMotionPreset();
  // This tab finished or discarded the session, but the layout rendering us
  // came out of the Router Cache from while it was live. Stand down at once,
  // and ask for a fresh layout so the spacer and the stale-activity sweep
  // catch up. Safe to refresh here: we are on an `(app)` route, never on the
  // workout screen whose celebration a refresh would tear down.
  const ended = useWorkoutEnded(workout.id);
  useEffect(() => {
    if (ended) router.refresh();
  }, [ended, router]);

  // Redundant while you're already looking at the workout.
  const onWorkoutScreen = pathname.startsWith("/workout/");

  return (
    <AnimatePresence>
      {!onWorkoutScreen && !ended && (
        <motion.div
          initial={enabled ? { y: 60, opacity: 0 } : { opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={enabled ? { y: 60, opacity: 0 } : { opacity: 0 }}
          transition={enabled ? SPRING.snappy : REDUCED}
          className="bottom-dock fixed inset-x-0 z-40 px-3 pb-2"
        >
          <Link
            href={`/workout/${workout.id}`}
            className="press bg-volt mx-auto flex max-w-lg items-center gap-3 rounded-field px-4 py-2.5 text-black"
          >
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-black/40" />
              <span className="relative inline-flex size-2.5 rounded-full bg-black" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-tight font-semibold">
                {workout.name}
              </span>
              <span className="block text-[11px] leading-tight font-medium opacity-70">
                {workout.completedSets} set{workout.completedSets === 1 ? "" : "s"} logged
              </span>
            </span>
            <Elapsed
              start={workout.startedAt}
              className="num text-[17px] font-bold"
            />
            <ChevronRight className="size-4 shrink-0 opacity-60" strokeWidth={2.5} />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
