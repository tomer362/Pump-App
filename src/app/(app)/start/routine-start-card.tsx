"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Percent, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadPickerSheet } from "@/components/workout/load-picker";
import { startWorkoutFromRoutine } from "@/lib/actions/workout";
import type { RoutineListItem } from "@/lib/queries/routine";
import { haptic } from "@/lib/utils";
import { rpeRangeLabel } from "@/lib/rpe";

export function RoutineStartCard({
  routine,
  disabled,
}: {
  routine: RoutineListItem;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effort = rpeRangeLabel([routine.rpeMin, routine.rpeMax]);

  async function start(mult: number) {
    setLoading(true);
    setError(null);
    const res = await startWorkoutFromRoutine(routine.id, mult);
    if (res.ok && res.data) router.push(`/workout/${res.data.workoutId}`);
    else {
      setError(res.ok ? "Could not start" : res.error);
      setLoading(false);
    }
  }

  return (
    <>
      <div className="border-hairline bg-surface-1 rounded-card border px-4 py-3.5">
        <div className="flex items-start gap-3">
          <Link href={`/routines/${routine.id}`} className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{routine.name}</p>
            <p className="text-text-3 num mt-0.5 text-[12px]">
              {routine.exerciseCount} exercise
              {routine.exerciseCount === 1 ? "" : "s"} · {routine.setCount} sets
              {/* The effort this routine asks for, before you commit to it —
                  the one number on this card that says how hard the session
                  will be rather than how long. */}
              {effort && ` · @${effort}`}
            </p>
            {routine.preview.length > 0 && (
              <p className="text-text-3 mt-1.5 truncate text-[13px]">
                {routine.preview.join(" · ")}
                {routine.exerciseCount > routine.preview.length && " …"}
              </p>
            )}
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => {
                haptic.light();
                setSheet(true);
              }}
              aria-label="Adjust load"
              disabled={disabled}
              className="press tap bg-surface-2 text-text-2 grid place-items-center rounded-[10px] px-2.5 disabled:opacity-40"
            >
              <Percent className="size-4" strokeWidth={2.4} />
            </button>
            <Button
              variant="volt"
              size="sm"
              disabled={disabled}
              loading={loading}
              onClick={() => start(1)}
            >
              <Play className="size-3.5" fill="currentColor" />
              Start
            </Button>
          </div>
        </div>
        {error && <p className="text-danger mt-2 text-[12px]">{error}</p>}
      </div>

      <LoadPickerSheet
        open={sheet}
        onClose={() => setSheet(false)}
        routineName={routine.name}
        value={multiplier}
        onChange={setMultiplier}
        loading={loading}
        onConfirm={() => start(multiplier)}
      />
    </>
  );
}
