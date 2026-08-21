"use client";

import { useMemo, useState } from "react";
import { Table2, TrendingUp } from "lucide-react";
import type { ExerciseSessionPoint } from "@/lib/queries/exercise";
import { CHART_RANGES, withinRange, type ChartRangeKey } from "@/lib/stats-windows";
import { cn, formatWeight } from "@/lib/utils";

type Metric = "est1rm" | "weight" | "volume" | "reps";

const METRICS: { value: Metric; label: string; weighted: boolean }[] = [
  { value: "est1rm", label: "Est. 1RM", weighted: true },
  { value: "weight", label: "Top set", weighted: true },
  { value: "volume", label: "Volume", weighted: true },
  { value: "reps", label: "Reps", weighted: false },
];

/**
 * An assisted machine has two of these and neither means what the pill above
 * says: `weight` is the session's *lowest* counterweight (the query flips the
 * aggregate), and the other two would be an estimated 1RM for being weak and a
 * tonnage total of help received. Offering three pills where two are nonsense
 * is how the number gets misread, so they are not offered.
 */
const ASSISTED_METRICS: typeof METRICS = [
  { value: "weight", label: "Assist", weighted: true },
  { value: "reps", label: "Reps", weighted: false },
];

function valueOf(p: ExerciseSessionPoint, metric: Metric): number {
  switch (metric) {
    case "est1rm":
      return p.bestEst1rm ?? 0;
    case "weight":
      return p.topWeightKg ?? 0;
    case "volume":
      return p.volumeKg;
    case "reps":
      return p.reps;
  }
}

/**
 * Strength over time for one exercise.
 *
 * A line, because sessions are a continuous progression and the shape of the
 * trend is the whole point. One metric at a time on a single axis — plotting
 * 1RM and volume together would need two scales and invent a relationship.
 *
 * Every value is also reachable from the table view, so nothing is locked
 * behind a tap on a 2.5px marker.
 */
export function ExerciseProgressChart({
  data,
  unit,
  assisted = false,
}: {
  data: ExerciseSessionPoint[];
  unit: "kg" | "lb";
  /** Weight is the machine's counterweight, not load. See ASSISTED_METRICS. */
  assisted?: boolean;
}) {
  const metrics = assisted ? ASSISTED_METRICS : METRICS;
  const [metric, setMetric] = useState<Metric>(assisted ? "weight" : "est1rm");
  const [range, setRange] = useState<ChartRangeKey>("1y");
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const meta = metrics.find((m) => m.value === metric)!;
  const days = CHART_RANGES.find((r) => r.key === range)!.days;

  // The series arrives oldest-first, which is also how a time axis reads.
  const points = useMemo(() => withinRange(data, days), [data, days]);
  const values = useMemo(
    () => points.map((p) => valueOf(p, metric)),
    [points, metric],
  );

  // The minus travels with every printed figure, on the axis and in the table
  // as well as the tooltip: a line trending down is only good news if the
  // reader can see the number is help received.
  const format = (v: number) =>
    meta.weighted
      ? `${assisted ? "−" : ""}${formatWeight(v, unit)} ${unit}`
      : `${Math.round(v)}`;

  const controls = (
    <>
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {metrics.map((m) => (
          <Pill
            key={m.value}
            label={m.label}
            active={metric === m.value}
            onClick={() => {
              setMetric(m.value);
              setActive(null);
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {CHART_RANGES.map((r) => (
          <Pill
            key={r.key}
            label={r.label}
            active={range === r.key}
            onClick={() => {
              setRange(r.key);
              setActive(null);
            }}
          />
        ))}
        <button
          onClick={() => setAsTable((t) => !t)}
          aria-pressed={asTable}
          className="press tap text-text-3 ml-auto grid size-9 shrink-0 place-items-center rounded-full"
          aria-label={asTable ? "Show chart" : "Show table"}
        >
          {asTable ? (
            <TrendingUp className="size-4" />
          ) : (
            <Table2 className="size-4" />
          )}
        </button>
      </div>
    </>
  );

  if (points.length === 0) {
    return (
      <div>
        {controls}
        <p className="text-text-3 py-6 text-center text-[14px]">
          Nothing logged in this range.
        </p>
      </div>
    );
  }

  if (asTable) {
    // Newest first: the table is for reading off recent numbers, not for
    // following the trend — that's what the chart is.
    const rows = [...points].reverse();
    return (
      <div>
        {controls}
        <div className="divide-hairline mt-3 divide-y">
          {rows.map((p) => (
            <div key={p.workoutId} className="flex items-baseline gap-3 py-2">
              <span className="text-text-3 num flex-1 text-[13px]">
                {p.date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="num text-[15px] font-bold">
                {format(valueOf(p, metric))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div>
        {controls}
        <p className="text-text-3 py-6 text-center text-[14px]">
          One session in this range. The trend appears from the second one.
        </p>
      </div>
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
      {controls}

      <div className="relative mt-3 h-40 w-full">
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
                className="bg-volt ring-surface-1 absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
              />
            );
          })}
        </div>

        {/* Full-height hit strips: a 2.5px dot is impossible to tap. */}
        <div className="absolute inset-0 flex">
          {points.map((p, i) => (
            <button
              key={p.workoutId}
              onClick={() => setActive(active === i ? null : i)}
              className="h-full flex-1"
              aria-label={`Session ${i + 1} of ${points.length}`}
            />
          ))}
        </div>
      </div>

      {/* The min and max are labelled directly, so the axis needs no ticks. */}
      <div className="text-text-3 num mt-2 flex justify-between text-[11px]">
        <span>low {format(min)}</span>
        <span>high {format(max)}</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-text-3 num text-[12px]">
          {points[shown].date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="num text-[17px] font-bold">
          {format(values[shown])}
        </span>
      </div>

      <p className="text-text-3 mt-1 text-[11px]">
        {points.length} sessions · tap the chart to inspect one.
      </p>
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-volt text-black" : "bg-surface-2 text-text-2",
      )}
    >
      {label}
    </button>
  );
}
