"use client";

import { useState } from "react";
import type { WeeklyPoint } from "@/lib/queries/stats";
import { cn, formatVolume } from "@/lib/utils";

type Metric = "volume" | "sets" | "workouts";

const METRICS: { value: Metric; label: string }[] = [
  { value: "volume", label: "Volume" },
  { value: "sets", label: "Sets" },
  { value: "workouts", label: "Sessions" },
];

/**
 * Weekly training load over time. Columns rather than a line: weeks are
 * discrete buckets, and columns survive a narrow phone better than a line with
 * twelve markers on it.
 *
 * One metric is shown at a time — two measures on one plot would need two
 * y-scales, which invents a relationship that isn't in the data.
 */
export function WeeklyTrendChart({
  data,
  unit,
}: {
  data: WeeklyPoint[];
  unit: "kg" | "lb";
}) {
  const [metric, setMetric] = useState<Metric>("volume");
  const [active, setActive] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <p className="text-text-3 py-8 text-center text-[14px]">
        Log a couple more weeks and your trend shows up here.
      </p>
    );
  }

  const valueOf = (p: WeeklyPoint) =>
    metric === "volume" ? p.volumeKg : metric === "sets" ? p.sets : p.workouts;

  const format = (n: number) =>
    metric === "volume" ? `${formatVolume(n, unit)} ${unit}` : String(Math.round(n));

  const max = Math.max(1, ...data.map(valueOf));
  const lastIndex = data.length - 1;

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

      {/* Container height includes the x-axis band so the labels are never
          clipped into a nested scroll. */}
      <div className="flex h-[168px] items-end gap-[2px]">
        {data.map((p, i) => {
          const v = valueOf(p);
          const pct = (v / max) * 100;
          const isActive = active === i;
          const isLast = i === lastIndex;
          return (
            <button
              key={p.weekStart.toISOString()}
              onClick={() => setActive(isActive ? null : i)}
              className="group flex h-full flex-1 flex-col justify-end"
              aria-label={`Week of ${p.weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${format(v)}`}
            >
              {/* Selective direct label: the latest week, plus whatever is
                  tapped. A number on every column would go unread. */}
              <span
                className={cn(
                  "num mb-1 text-center text-[10px] font-bold whitespace-nowrap",
                  isActive || isLast
                    ? "text-text-1"
                    : "text-transparent group-hover:text-text-3",
                )}
              >
                {format(v)}
              </span>
              <span
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  isActive || isLast ? "bg-volt" : "bg-volt/30",
                )}
                style={{ height: `${Math.max(pct, 2)}%`, maxHeight: "100%" }}
              />
              <span
                className={cn(
                  "num mt-1 text-center text-[9px] whitespace-nowrap",
                  isActive || isLast ? "text-text-2" : "text-text-3",
                )}
              >
                {p.weekStart.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </button>
          );
        })}
      </div>

      {active != null && (
        <p className="text-text-3 num mt-2 text-center text-[12px]">
          Week of{" "}
          {data[active].weekStart.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
          })}{" "}
          · {data[active].workouts} session
          {data[active].workouts === 1 ? "" : "s"} · {data[active].sets} sets ·{" "}
          {formatVolume(data[active].volumeKg, unit)} {unit}
        </p>
      )}
    </div>
  );
}
