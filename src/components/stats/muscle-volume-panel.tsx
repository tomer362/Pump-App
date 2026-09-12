"use client";

import { useState, useRef } from "react";
import { showToast } from "@/components/ui/toast";
import { Segmented } from "@/components/ui/primitives";
import { MuscleVolumeChart } from "./muscle-volume-chart";
import { getMuscleVolumeAction } from "@/lib/actions/stats-range";
import { MUSCLE_WINDOWS } from "@/lib/stats-windows";
import type { MuscleVolume } from "@/lib/queries/stats";

const OPTIONS = MUSCLE_WINDOWS.map((w) => ({
  value: String(w.days),
  label: w.label,
}));

/**
 * Per-muscle set counts over a switchable window.
 *
 * The set targets the chart draws are weekly figures, so anything longer than
 * 7 days is shown as a weekly average — otherwise a 90-day column sails past
 * the band and reads as wild overtraining.
 */
export function MuscleVolumePanel({
  initial,
  unit,
}: {
  initial: MuscleVolume[];
  unit: "kg" | "lb";
}) {
  // The window and its rows change together: `days` used to move first, so
  // for the length of the fetch the 7-day set counts were divided by twelve.
  const [shown, setShown] = useState({ days: "7", data: initial });
  const [pending, setPending] = useState<string | null>(null);
  const request = useRef(0);
  const days = pending ?? shown.days;
  const data = shown.data;
  const loading = pending != null;

  async function pick(next: string) {
    if (next === shown.days && pending == null) return;
    const id = ++request.current;
    setPending(next);
    let rows: MuscleVolume[];
    try {
      rows = await getMuscleVolumeAction(Number(next));
    } catch {
      showToast("Couldn't load that range. Check your connection.");
      if (request.current === id) setPending(null);
      return;
    }
    // A slower earlier request must never paint over a newer one.
    if (request.current !== id) return;
    setShown({ days: next, data: rows });
    setPending(null);
  }

  const weeks = Number(shown.days) / 7;
  const perWeek =
    weeks === 1
      ? data
      : data.map((d) => ({
          ...d,
          sets: Math.round((d.sets / weeks) * 10) / 10,
          volumeKg: d.volumeKg / weeks,
        }));

  return (
    <div>
      <Segmented
        className="mb-3"
        value={days}
        onChange={pick}
        options={OPTIONS}
      />
      <div className={loading ? "opacity-50 transition-opacity" : undefined}>
        <MuscleVolumeChart data={perWeek} unit={unit} />
      </div>
      {weeks > 1 && (
        <p className="text-text-3 mt-2 text-[11px]">
          Averaged per week over the last {days} days.
        </p>
      )}
    </div>
  );
}
