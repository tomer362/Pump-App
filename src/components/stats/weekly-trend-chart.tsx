"use client";

import { useRef, useState } from "react";
import type { WeeklyPoint } from "@/lib/queries/stats";
import { change, compactNumber, nearestIndex, niceScale, signed } from "@/lib/chart";
import {
  ChartFigures,
  ChartReadout,
  GridLines,
  MetricTabs,
  TableToggle,
  XAxis,
  YAxis,
  useElementWidth,
} from "@/components/ui/chart";
import { cn, formatShortDate, kgToLb } from "@/lib/utils";

type Metric = "volume" | "sets" | "workouts";

const METRICS: { value: Metric; label: string }[] = [
  { value: "volume", label: "Volume" },
  { value: "sets", label: "Sets" },
  { value: "workouts", label: "Sessions" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PLOT_H = 150;
const AXIS_H = 22;
const PAD_TOP = 10;
const PAD_L = 2;
const GUTTER = 38;
const BAR_MAX = 18;
const BAR_GAP = 4;

/**
 * Weekly training load over time. Columns rather than a line: weeks are
 * discrete buckets, and a column's length *is* the value — which is why the
 * axis starts at zero here and nowhere else.
 *
 * One metric is shown at a time — two measures on one plot would need two
 * y-scales, which invents a relationship that isn't in the data. Every week is
 * the same colour; the one under your thumb (or the current one) is the only
 * one at full strength.
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
  const [asTable, setAsTable] = useState(false);

  const controls = (
    <MetricTabs
      value={metric}
      onChange={(m) => {
        setMetric(m);
        setActive(null);
      }}
      options={METRICS}
    />
  );

  if (data.length < 2) {
    return (
      <div>
        {controls}
        <p className="text-text-3 py-10 text-center text-[14px]">
          Log a couple more weeks and your trend shows up here.
        </p>
      </div>
    );
  }

  const weighted = metric === "volume";
  const values = data.map((p) => {
    const v = metric === "volume" ? p.volumeKg : metric === "sets" ? p.sets : p.workouts;
    return weighted && unit === "lb" ? kgToLb(v) : v;
  });
  const fmt = (v: number) =>
    v.toLocaleString("en-GB", { maximumFractionDigits: weighted ? 0 : 1 });
  const unitLabel = weighted ? unit : undefined;
  const withUnit = (v: number) => `${fmt(v)}${unitLabel ? ` ${unitLabel}` : ""}`;

  const lastIndex = data.length - 1;
  const shown = active != null && active <= lastIndex ? active : lastIndex;
  const weekLabel = (p: WeeklyPoint, i: number) =>
    i === lastIndex ? `This week · from ${formatShortDate(p.weekStart)}` : `Week of ${formatShortDate(p.weekStart)}`;

  const delta = (() => {
    if (shown === 0) return null;
    const d = change(values[shown - 1], values[shown]);
    return {
      abs: d.abs,
      text: d.abs === 0 ? "same as last week" : `${withUnit(Math.abs(d.abs))} vs last week`,
      good: d.abs > 0,
    };
  })();

  const bestIndex = values.reduce((b, v, i) => (v > values[b] ? i : b), 0);
  const total = values.reduce((a, b) => a + b, 0);

  const footer = (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-text-3 text-[11px]">Weeks start on Monday.</p>
      <TableToggle asTable={asTable} onChange={setAsTable} />
    </div>
  );

  if (asTable) {
    const rows = data.map((p, i) => ({ p, i })).reverse();
    return (
      <div>
        {controls}
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-text-3 border-hairline border-b text-[11px] tracking-[0.06em] uppercase">
              <th className="py-2 text-left font-semibold">Week of</th>
              <th className="py-2 text-right font-semibold">Sessions</th>
              <th className="py-2 text-right font-semibold">Sets</th>
              <th className="py-2 text-right font-semibold">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-hairline divide-y">
            {rows.map(({ p }) => (
              <tr key={p.weekStart.toISOString()}>
                <td className="text-text-2 num py-2 text-[13px]">{formatShortDate(p.weekStart)}</td>
                <td className="num py-2 text-right text-[13px]">{p.workouts}</td>
                <td className="num py-2 text-right text-[13px]">{p.sets}</td>
                <td className="num py-2 text-right text-[13px] font-bold">
                  {fmt(unit === "lb" ? kgToLb(p.volumeKg) : p.volumeKg)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {footer}
      </div>
    );
  }

  return (
    <div>
      {controls}

      <div className="mt-4">
        <ChartReadout
          value={fmt(values[shown])}
          unit={unitLabel}
          label={weekLabel(data[shown], shown)}
          delta={delta}
          isLatest={shown === lastIndex}
          onLatest={() => setActive(null)}
        />
      </div>

      <Columns
        data={data}
        values={values}
        shown={shown}
        onPick={setActive}
        format={compactNumber}
        label={`${METRICS.find((m) => m.value === metric)!.label} per week`}
      />

      <div className="border-hairline mt-4 border-t pt-3">
        <ChartFigures
          items={[
            {
              label: "Best week",
              value: withUnit(values[bestIndex]),
              detail: formatShortDate(data[bestIndex].weekStart),
            },
            {
              label: "Average",
              value: withUnit(Math.round((total / data.length) * 10) / 10),
              detail: "per week",
            },
            {
              label: "Change",
              value: `${signed(values[lastIndex] - values[0], fmt)}${unitLabel ? ` ${unitLabel}` : ""}`,
              detail: `over ${data.length} weeks`,
            },
          ]}
        />
      </div>

      {footer}
    </div>
  );
}

function Columns({
  data,
  values,
  shown,
  onPick,
  format,
  label,
}: {
  data: WeeklyPoint[];
  values: number[];
  shown: number;
  onPick: (fn: (prev: number | null) => number | null) => void;
  format: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const lastIndex = data.length - 1;
  const plotL = PAD_L;
  const plotR = Math.max(plotL + 1, width - GUTTER);
  const slot = (plotR - plotL) / data.length;
  const barW = Math.max(2, Math.min(BAR_MAX, slot - BAR_GAP));

  const scale = niceScale(0, Math.max(1, ...values), { zero: true, maxTicks: 4 });
  const y = (v: number) =>
    PAD_TOP + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * (PLOT_H - PAD_TOP);
  const centres = data.map((_, i) => plotL + slot * i + slot / 2);

  // One label per month, on the first week that falls in it.
  const ticks = data.flatMap((p, i) => {
    const prev = data[i - 1];
    if (prev && prev.weekStart.getMonth() === p.weekStart.getMonth()) return [];
    return [{ x: centres[i] - barW / 2, label: MONTHS[p.weekStart.getMonth()] }];
  });

  const pickAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    onPick(() => nearestIndex(centres, clientX - rect.left));
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current) pickAt(e.clientX);
  };
  const onPointerEnd = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : null;
    if (step != null) {
      e.preventDefault();
      onPick((a) => Math.max(0, Math.min(lastIndex, (a ?? lastIndex) + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      onPick(() => 0);
    } else if (e.key === "End") {
      e.preventDefault();
      onPick(() => null);
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${label}. ${data.length} weeks. Use the arrow keys to move between them.`}
      onKeyDown={onKeyDown}
      className="focus-visible:ring-hairline-strong mt-3 w-full touch-pan-y rounded-[6px] outline-none select-none focus-visible:ring-1"
      style={{ height: PLOT_H + AXIS_H }}
    >
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={PLOT_H + AXIS_H}
          className="block overflow-visible"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          aria-hidden
        >
          <GridLines ticks={scale.ticks} y={y} x0={plotL} x1={plotR} />
          <YAxis ticks={scale.ticks} y={y} x={plotR} format={format} />
          <XAxis ticks={ticks} baseline={PLOT_H} x1={plotR} />

          {values.map((v, i) => {
            const top = y(v);
            // 4px rounded data-end, square at the baseline: a path, since a
            // rect rounds every corner. A zero week keeps a 2px stub so the
            // week is visibly there and visibly empty.
            const h = Math.max(2, PLOT_H - top);
            const r = Math.min(4, h, barW / 2);
            const x0 = centres[i] - barW / 2;
            const x1 = x0 + barW;
            const yTop = PLOT_H - h;
            const d = `M ${x0} ${PLOT_H} V ${yTop + r} Q ${x0} ${yTop} ${x0 + r} ${yTop} H ${x1 - r} Q ${x1} ${yTop} ${x1} ${yTop + r} V ${PLOT_H} Z`;
            return (
              <path
                key={data[i].weekStart.toISOString()}
                d={d}
                className={cn(
                  "transition-[fill] duration-150",
                  i === shown ? "fill-volt" : "fill-volt/35",
                )}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
