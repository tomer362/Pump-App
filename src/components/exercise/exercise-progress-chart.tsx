"use client";

import { useMemo, useState } from "react";
import type { ExerciseHistoryPoint } from "@/lib/queries/exercise";
import { cn, formatWeight } from "@/lib/utils";

type Metric = "est1rm" | "weight" | "volume";

const METRICS: { value: Metric; label: string }[] = [
  { value: "est1rm", label: "Est. 1RM" },
  { value: "weight", label: "Top set" },
  { value: "volume", label: "Volume" },
];

/**
 * Strength over time for one exercise.
 *
 * A line, because sessions are a continuous progression and the shape of the
 * trend is the whole point. One metric at a time on a single axis — plotting
 * 1RM and volume together would need two scales and invent a relationship.
 */
export function ExerciseProgressChart({
  data,
  unit,
}: {
  data: ExerciseHistoryPoint[];
  unit: "kg" | "lb";
}) {
  const [metric, setMetric] = useState<Metric>("est1rm");
  const [active, setActive] = useState<number | null>(null);

  // Query returns newest-first; a time axis reads oldest-first.
  const points = useMemo(() => [...data].reverse(), [data]);

  const values = points.map((p) =>
    metric === "est1rm"
      ? (p.bestEst1rm ?? 0)
      : metric === "weight"
        ? (p.bestWeightKg ?? 0)
        : p.totalVolumeKg,
  );

  if (points.length < 2) {
    return (
      <p className="text-text-3 py-6 text-center text-[14px]">
        One session logged. The trend appears from the second one.
      </p>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  // Padded so the line never touches the top or bottom edge.
  const y = (v: number) => 92 - ((v - min) / span) * 84;
  const x = (i: number) => (i / (points.length - 1)) * 100;

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
  const areaPath = `${path} L 100 100 L 0 100 Z`;

  const lastIndex = values.length - 1;
  const shown = active ?? lastIndex;

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.value}
            onClick={() => setMetric(m.value)}
            className={cn(
              "press rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
              metric === m.value
                ? "bg-volt text-black"
                : "bg-surface-2 text-text-2",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative h-40 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
        >
          {/* Recessive hairline grid. Solid, never dashed. */}
          {[8, 50, 92].map((gy) => (
            <line
              key={gy}
              x1="0"
              y1={gy}
              x2="100"
              y2={gy}
              className="stroke-hairline"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Area wash at ~10% — a hint of mass, not a saturated block. */}
          <path d={areaPath} className="fill-volt/10" />
          <path
            d={path}
            fill="none"
            className="stroke-volt"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Markers sit in an overlay so they keep a circular aspect the
            non-uniform viewBox scaling would otherwise squash. */}
        <div className="pointer-events-none absolute inset-0">
          {values.map((v, i) => {
            const isShown = i === shown;
            if (!isShown && i !== lastIndex) return null;
            return (
              <span
                key={i}
                className={cn(
                  "ring-surface-1 absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
                  "bg-volt",
                )}
                style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
              />
            );
          })}
        </div>

        {/* Full-height hit strips: a 2.5px dot is impossible to tap. */}
        <div className="absolute inset-0 flex">
          {points.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(active === i ? null : i)}
              className="h-full flex-1"
              aria-label={`Session ${i + 1} of ${points.length}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-text-3 num text-[12px]">
          {points[shown].date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="num text-[17px] font-bold">
          {metric === "volume"
            ? `${formatWeight(values[shown], unit)} ${unit}`
            : `${formatWeight(values[shown], unit)} ${unit}`}
        </span>
      </div>

      <p className="text-text-3 mt-1 text-[11px]">
        {points.length} sessions · tap the chart to inspect one.
      </p>
    </div>
  );
}
