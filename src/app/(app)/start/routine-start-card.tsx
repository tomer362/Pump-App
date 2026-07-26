"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Percent, Play } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { startWorkoutFromRoutine } from "@/lib/actions/workout";
import type { RoutineListItem } from "@/lib/queries/routine";
import { cn, haptic } from "@/lib/utils";

const PRESETS = [
  { value: 0.6, label: "60%", note: "Heavy deload" },
  { value: 0.7, label: "70%", note: "Deload" },
  { value: 0.8, label: "80%", note: "Light deload" },
  { value: 0.9, label: "90%", note: "Back-off" },
  { value: 1, label: "100%", note: "As prescribed" },
  { value: 1.05, label: "105%", note: "Push" },
  { value: 1.1, label: "110%", note: "Overload" },
];

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

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Adjust the load"
        footer={
          <Button
            block
            variant="volt"
            loading={loading}
            onClick={() => start(multiplier)}
          >
            Start at {Math.round(multiplier * 100)}%
          </Button>
        }
      >
        <div className="px-4 pb-4">
          <p className="text-text-2 text-[14px] leading-relaxed">
            Every prescribed weight in{" "}
            <span className="text-text-1 font-semibold">{routine.name}</span>{" "}
            gets scaled by this. Use it for a deload week, or to push a little
            past the plan.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  haptic.light();
                  setMultiplier(p.value);
                }}
                className={cn(
                  "press rounded-field border px-3 py-2.5 text-left transition-colors",
                  multiplier === p.value
                    ? "border-volt bg-volt-fade"
                    : "border-hairline bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "num block text-[18px] font-bold",
                    multiplier === p.value ? "text-volt" : "text-text-1",
                  )}
                >
                  {p.label}
                </span>
                <span className="text-text-3 block text-[12px]">{p.note}</span>
              </button>
            ))}
          </div>

          <p className="text-text-3 mt-4 text-[12px] leading-relaxed">
            Only weights change — sets and reps stay as written. Records set
            during a scaled session still count.
          </p>
        </div>
      </Sheet>
    </>
  );
}
