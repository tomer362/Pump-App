"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { QuickLogSheet, type QuickLogSetValues } from "./quick-log-sheet";

/**
 * The bottom-docked "Log a set" bar on an exercise page.
 *
 * Docked, not a nav-bar action: the nav bar's right slot is the top corner of
 * the screen, which is the worst place a thumb can reach, and the primary
 * action on a phone belongs in the bottom third.
 *
 * Geometry mirrors `ActiveWorkoutPill` — `--bottom-dock` is the tab bar plus
 * the system inset below it, and when a workout *is* running the pill already
 * occupies that strip, so this stacks above it rather than under it.
 */
export function QuickLogDock({
  exerciseId,
  exerciseName,
  trackingType,
  unit,
  prefill,
  activeWorkoutId,
}: {
  exerciseId: string;
  exerciseName: string;
  trackingType: string;
  unit: "kg" | "lb";
  prefill: QuickLogSetValues | null;
  activeWorkoutId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Keeps the page's last card clear of the docked bar. */}
      <div aria-hidden className="h-16" />

      <div
        className="fixed inset-x-0 z-30 px-3 pb-2"
        // Clears the tab bar, and the active-workout pill on top of it when
        // there is one — 56px is the pill's own height.
        style={{
          bottom: activeWorkoutId
            ? "calc(var(--bottom-dock) + 56px)"
            : "var(--bottom-dock)",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="press bg-volt rounded-field mx-auto flex h-12 w-full max-w-lg items-center justify-center gap-2 text-[15px] font-bold text-black"
        >
          <Plus className="size-5" strokeWidth={2.8} />
          Log a set
        </button>
      </div>

      {open && (
        <QuickLogSheet
          open={open}
          onClose={() => setOpen(false)}
          exerciseId={exerciseId}
          exerciseName={exerciseName}
          trackingType={trackingType}
          unit={unit}
          prefill={prefill}
          activeWorkoutId={activeWorkoutId}
        />
      )}
    </>
  );
}
