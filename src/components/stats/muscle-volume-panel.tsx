"use client";

import { useState } from "react";
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
  const [days, setDays] = useState("7");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function pick(next: string) {
    setDays(next);
    setLoading(true);
    const rows = await getMuscleVolumeAction(Number(next));
    setLoading(false);
    setData(rows);
  }

  const weeks = Number(days) / 7;
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
