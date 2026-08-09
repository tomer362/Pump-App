"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { RpePicker } from "@/components/workout/rpe-picker";
import { updateSet } from "@/lib/actions/workout";
import { cn, haptic } from "@/lib/utils";

/**
 * A performed set on your own history detail, with its effort rating editable.
 *
 * Rating a set honestly is something you often only manage afterwards — the
 * checkmark gets tapped between breaths and the rest bar starts, and by the time
 * you'd think about how the set felt you're already under the next one. So the
 * rating stays open after the session: nothing else about a finished workout
 * needs to move for it, because RPE is the one logged value that feeds no
 * denormalised counter, no volume figure and no personal record. Editing it is
 * therefore safe long after `finishWorkout` has written all of those.
 *
 * The whole row is the target rather than the value on the right of it. History
 * is a browsing surface, not the workout screen's data table, so a 44px row is
 * affordable here — and a 12px "RPE" label is not a tap target.
 */
export function SetRpeRow({
  setId,
  initialRpe,
  title,
  children,
}: {
  setId: string;
  initialRpe: number | null;
  /** Sheet heading — the exercise and which set, e.g. "Bench Press · Set 3". */
  title: string;
  /** The set number and its values, rendered on the server. */
  children: React.ReactNode;
}) {
  const [rpe, setRpe] = useState(initialRpe);
  const [open, setOpen] = useState(false);

  function choose(next: number | null) {
    if (next === rpe) {
      setOpen(false);
      return;
    }
    const previous = rpe;
    setRpe(next);
    setOpen(false);
    haptic.light();
    void updateSet(setId, { rpe: next }).then((res) => {
      // There is no toast anywhere in this app; the value snapping back is the
      // signal that the write didn't land.
      if (!res.ok) setRpe(previous);
    });
  }

  return (
    <>
      <button
        onClick={() => {
          haptic.light();
          setOpen(true);
        }}
        aria-label={
          rpe != null
            ? `${title} — effort ${rpe}. Change it.`
            : `${title} — no effort rating. Add one.`
        }
        className="press flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-[13px]"
      >
        {children}
        <span
          className={cn(
            "num ml-auto shrink-0 text-[12px]",
            // Unrated is a prompt, not a value: dimmer than the figure it would
            // become, and never volt — an absent rating is not state worth the
            // accent.
            rpe != null ? "text-text-3" : "text-text-3/55",
          )}
        >
          {rpe != null ? `RPE ${rpe}` : "RPE"}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="px-4 pb-5">
          <RpePicker
            value={rpe}
            onChange={choose}
            idPrefix={`history-${setId}`}
          />
        </div>
      </Sheet>
    </>
  );
}
