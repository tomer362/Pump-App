"use client";

import { useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import type { MuscleVolume } from "@/lib/queries/stats";
import { labelize } from "@/lib/utils";
import { cn, formatVolume } from "@/lib/utils";

/**
 * Weekly working sets per muscle (spec #17).
 *
 * Sets — not tonnage — are the unit, because weekly set count is what training
 * programmes are actually written in and it compares across exercises that
 * tonnage cannot. Secondary movers count half a set.
 *
 * One measure, one series, so every bar is the same colour: shading bars by
 * magnitude would double-encode bar length as hue and spend the only free
 * channel on information the length already carries.
 */
export function MuscleVolumeChart({
  data,
  unit,
  targetMin = 10,
  targetMax = 20,
}: {
  data: MuscleVolume[];
  unit: "kg" | "lb";
  targetMin?: number;
  targetMax?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  if (!data.length) {
    return (
      <p className="text-text-3 py-8 text-center text-[14px]">
        No completed sets in this window yet.
      </p>
    );
  }

  // Scale headroom so the target band is always visible even in a light week.
  const max = Math.max(targetMax + 4, ...data.map((d) => d.sets));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-text-3 text-[12px]">
          Working sets per muscle.{" "}
          <span className="text-text-2">
            {targetMin}–{targetMax}
          </span>{" "}
          is the usual weekly range for growth.
        </p>
        <button
          onClick={() => setShowTable((v) => !v)}
          aria-label={showTable ? "Show chart" : "Show table"}
          className="press hit-slop text-text-3 hover:text-text-1 ml-2 shrink-0 p-1.5"
        >
          {showTable ? (
            <BarChart3 className="size-4" />
          ) : (
            <Table2 className="size-4" />
          )}
        </button>
      </div>

      {showTable ? (
        <MuscleTable data={data} unit={unit} />
      ) : (
        <div>
          {/* The band is scoped to the bar rows only — wrapping the caption in
              it too would paint a tall block down the whole card. */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0"
              style={{ left: LABEL_W + GAP, right: VALUE_W + GAP }}
            >
              <div
                className="bg-volt/[0.07] absolute inset-y-0"
                style={{
                  left: `${(targetMin / max) * 100}%`,
                  width: `${((targetMax - targetMin) / max) * 100}%`,
                }}
              />
            </div>

            <ul className="relative space-y-[2px]">
            {data.map((d) => {
              const pct = Math.min(100, (d.sets / max) * 100);
              const inRange = d.sets >= targetMin;
              const isActive = active === d.muscle;
              return (
                <li key={d.muscle}>
                  <button
                    onClick={() => setActive(isActive ? null : d.muscle)}
                    // 32px rows, not 44. A 20px bar with 44px of row would
                    // make a sixteen-muscle chart 700px tall and turn the one
                    // screen you read at a glance into a scroll — and WCAG 2.2
                    // allows the smaller target where an equivalent control
                    // exists, which the table view beside it is. `py-[3px]`
                    // was 26px, which is the minimum and nothing more.
                    className="press flex w-full items-center py-1.5 text-left"
                    style={{ gap: GAP }}
                    aria-label={`${labelize(d.muscle)}: ${d.sets} sets`}
                  >
                    <span
                      className="text-text-2 shrink-0 truncate text-[12px] font-medium"
                      style={{ width: LABEL_W }}
                    >
                      {labelize(d.muscle)}
                    </span>

                    <span className="relative h-4 flex-1">
                      {/* Track */}
                      <span className="bg-surface-2 absolute inset-y-0 left-0 w-full rounded-[4px]" />
                      {/* Bar: square at the baseline, 4px rounded data-end */}
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-500",
                          inRange ? "bg-volt" : "bg-volt/35",
                        )}
                        style={{ width: `${Math.max(pct, 1.5)}%` }}
                      />
                    </span>

                    <span
                      className={cn(
                        "num shrink-0 text-right text-[13px] font-bold",
                        inRange ? "text-text-1" : "text-text-3",
                      )}
                      style={{ width: VALUE_W }}
                    >
                      {d.sets}
                    </span>
                  </button>

                  {isActive && (
                    <p
                      className="text-text-3 num pb-1 text-[11px]"
                      style={{ paddingLeft: LABEL_W + GAP }}
                    >
                      {d.sessions} session{d.sessions === 1 ? "" : "s"} ·{" "}
                      {formatVolume(d.volumeKg, unit)} {unit} ·{" "}
                      {d.sets < targetMin ? "below range" : "in range"}
                    </p>
                  )}
                </li>
              );
            })}
            </ul>
          </div>

          <p className="text-text-3 mt-3 text-[11px] leading-relaxed">
            Faded bars are under {targetMin} sets. Secondary muscles count as
            half a set. Tap a bar for detail.
          </p>
        </div>
      )}
    </div>
  );
}

/* Fixed gutters so the target band can be inset to exactly the plot column. */
const LABEL_W = 78;
const VALUE_W = 32;
const GAP = 8;

function MuscleTable({
  data,
  unit,
}: {
  data: MuscleVolume[];
  unit: "kg" | "lb";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-text-3 border-hairline border-b text-[11px] tracking-[0.06em] uppercase">
            <th className="py-1.5 text-left font-semibold">Muscle</th>
            <th className="py-1.5 text-right font-semibold">Sets</th>
            <th className="py-1.5 text-right font-semibold">Sessions</th>
            <th className="py-1.5 text-right font-semibold">Volume</th>
          </tr>
        </thead>
        <tbody className="divide-hairline divide-y">
          {data.map((d) => (
            <tr key={d.muscle}>
              <td className="py-1.5">{labelize(d.muscle)}</td>
              <td className="num py-1.5 text-right font-semibold">{d.sets}</td>
              <td className="num text-text-2 py-1.5 text-right">{d.sessions}</td>
              <td className="num text-text-2 py-1.5 text-right">
                {formatVolume(d.volumeKg, unit)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
