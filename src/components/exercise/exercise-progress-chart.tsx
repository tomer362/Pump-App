"use client";

import { DayLabel } from "@/components/ui/day-label";
import { useMemo, useRef, useState } from "react";
import type { ExerciseSessionPoint } from "@/lib/queries/exercise";
import { CHART_RANGES, withinRange, type ChartRangeKey } from "@/lib/stats-windows";
import {
  change,
  compactNumber,
  nearestIndex,
  niceScale,
  signed,
  timeDomain,
  timeTicks,
} from "@/lib/chart";
import { Segmented } from "@/components/ui/primitives";
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
import { formatShortDate, kgToLb } from "@/lib/utils";

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

/**
 * `null` for a session that has no figure for this metric — not `0`.
 *
 * The query returns NULL for `best_e1rm`/`top_weight` when a session's
 * completed working sets carried no load at all (a bodyweight day, or an
 * assisted machine, where an estimated 1RM is meaningless). Coercing that to
 * zero printed "0 kg" against a day nothing was logged at zero, dropped the
 * line to the floor and put a fictional 0 on the axis. Volume and reps are
 * COALESCEd counts, where zero really is zero.
 */
function valueOf(p: ExerciseSessionPoint, metric: Metric): number | null {
  switch (metric) {
    case "est1rm":
      return p.bestEst1rm;
    case "weight":
      return p.topWeightKg;
    case "volume":
      return p.volumeKg;
    case "reps":
      return p.reps;
  }
}

/* Plot geometry, in pixels. The container height includes the axis band, so
   the month labels never end up in a nested scroll. */
const PLOT_H = 172;
const AXIS_H = 22;
const PAD_TOP = 20;
const PAD_L = 4;
const PAD_R = 8;
/** Room for a five-glyph tick label to the right of the plot. */
const GUTTER = 42;
/** Past this many sessions a dot per session is a bead string; only the ends
    and the selection are marked and the line carries the rest. */
const MAX_DOTTED = 24;

const RANGE_OPTIONS = CHART_RANGES.map((r) => ({ value: r.key, label: r.label }));

/**
 * Strength over time for one exercise.
 *
 * A line, because sessions are a continuous progression and the shape of the
 * trend is the whole point — which is also why the x-axis is *time*, not
 * session number: two sessions a week apart sit close together, a lay-off is a
 * flat gap, and the trend you see is the trend that happened. One metric at a
 * time on a single axis; plotting 1RM and volume together would need two
 * scales and invent a relationship.
 *
 * The readout above the plot is the tooltip. Scrubbing the plot rewrites it —
 * a thumb dragged across the line, not a tap aimed at a 2.5 px dot — and every
 * value is reachable in the table view besides, so nothing is gated behind
 * the gesture.
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
  // A year is the trend people open this for — unless it holds no trend, in
  // which case a lift last done in spring opening on an empty 1Y is the chart
  // saying "nothing" about something it knows.
  const [range, setRange] = useState<ChartRangeKey>(() =>
    withinRange(data, 365).length >= 2 ? "1y" : "all",
  );
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const meta = metrics.find((m) => m.value === metric)!;
  const rangeMeta = CHART_RANGES.find((r) => r.key === range)!;
  // "Best" on an assisted machine is the least help — the one metric where the
  // low end of the axis is the one you are aiming for.
  const lowerIsBetter = assisted && metric === "weight";

  // The series arrives oldest-first, which is also how a time axis reads.
  // Sessions with no figure for the selected metric are not points on this
  // chart — they are dropped rather than plotted at zero, so switching metric
  // can legitimately change how many sessions the chart has.
  const points = useMemo(
    () => withinRange(data, rangeMeta.days).filter((p) => valueOf(p, metric) != null),
    [data, rangeMeta.days, metric],
  );
  // Everything below works in the display unit, so ticks land on clean
  // pounds for a lifter who reads pounds.
  const values = useMemo(
    () =>
      points.map((p) => {
        const v = valueOf(p, metric)!;
        return meta.weighted && unit === "lb" ? kgToLb(v) : v;
      }),
    [points, metric, meta.weighted, unit],
  );

  // The minus travels with every printed figure, in the table and the figures
  // as well as the readout: a number going down is only good news if the
  // reader can see it is help received.
  const sign = assisted && meta.weighted ? "−" : "";
  const fmt = (v: number) =>
    v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  const unitLabel = meta.weighted ? unit : undefined;
  const withUnit = (v: number) =>
    `${sign}${fmt(v)}${unitLabel ? ` ${unitLabel}` : ""}`;

  const lastIndex = points.length - 1;
  const shown = active != null && active <= lastIndex ? active : lastIndex;

  const controls = (
    <MetricTabs
      value={metric}
      onChange={(m) => {
        setMetric(m);
        setActive(null);
      }}
      options={metrics}
    />
  );

  const rangeRow = (
    <div className="mt-4 flex items-center gap-2">
      <Segmented
        className="flex-1"
        value={range}
        onChange={(r) => {
          setRange(r);
          setActive(null);
        }}
        options={RANGE_OPTIONS}
      />
      <TableToggle asTable={asTable} onChange={setAsTable} />
    </div>
  );

  if (points.length === 0) {
    // Two different absences, and telling them apart is the difference between
    // "train more" and "this figure doesn't exist for how you log this lift".
    const anySession = withinRange(data, rangeMeta.days).length > 0;
    return (
      <div>
        {controls}
        <p className="text-text-3 py-10 text-center text-[14px]">
          {anySession
            ? `No ${meta.label.toLowerCase()} to show — nothing in this range carried a load.`
            : "Nothing logged in this range."}
        </p>
        {rangeRow}
      </div>
    );
  }

  const deltaAt = (i: number) => {
    if (i <= 0) return null;
    const d = change(values[i - 1], values[i]);
    return {
      abs: d.abs,
      text:
        d.abs === 0
          ? "same as previous"
          : `${fmt(Math.abs(d.abs))}${unitLabel ? ` ${unitLabel}` : ""} vs previous`,
      good: lowerIsBetter ? d.abs < 0 : d.abs > 0,
    };
  };

  if (asTable) {
    // Newest first: the table is for reading off recent numbers, not for
    // following the trend — that's what the chart is.
    const rows = points.map((p, i) => ({ p, i })).reverse();
    const thisYear = new Date().getFullYear();
    return (
      <div>
        {controls}
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-text-3 border-hairline border-b text-[11px] tracking-[0.06em] uppercase">
              <th className="py-2 text-left font-semibold">Session</th>
              <th className="py-2 text-right font-semibold">{meta.label}</th>
              <th className="py-2 text-right font-semibold">Change</th>
            </tr>
          </thead>
          <tbody className="divide-hairline divide-y">
            {rows.map(({ p, i }) => {
              const d = i > 0 ? values[i] - values[i - 1] : null;
              return (
                <tr key={p.workoutId}>
                  <td className="text-text-2 num py-2 text-[13px]">
                    {formatShortDate(p.date)}
                    {p.date.getFullYear() !== thisYear && (
                      <span className="text-text-3"> {p.date.getFullYear()}</span>
                    )}
                  </td>
                  <td className="num py-2 text-right text-[15px] font-bold">
                    {withUnit(values[i])}
                  </td>
                  <td className="text-text-3 num py-2 text-right text-[13px]">
                    {d == null ? "—" : signed(d, fmt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rangeRow}
      </div>
    );
  }

  // Extremes for the figures strip and the one direct label on the plot.
  let bestIndex = 0;
  for (let i = 1; i < values.length; i++) {
    if (lowerIsBetter ? values[i] < values[bestIndex] : values[i] > values[bestIndex]) {
      bestIndex = i;
    }
  }
  const overall = change(values[0], values[lastIndex]);

  return (
    <div>
      {controls}

      <div className="mt-4">
        <ChartReadout
          value={`${sign}${fmt(values[shown])}`}
          unit={unitLabel}
          label={<DayLabel date={points[shown].date} />}
          delta={deltaAt(shown)}
          isLatest={shown === lastIndex}
          onLatest={() => setActive(null)}
        />
      </div>

      {/* Assistance is plotted negated, so the axis reads −40 at the foot and
          −25 at the head and *less* help climbs — the direction progress goes
          on every other chart. The readout and the figures keep the true
          number with its minus; only the picture is flipped. */}
      <Plot
        points={points}
        values={lowerIsBetter ? values.map((v) => -v) : values}
        rangeDays={rangeMeta.days}
        shown={shown}
        inspecting={active != null}
        bestIndex={bestIndex}
        format={(v) => (v < 0 ? `−${compactNumber(-v)}` : compactNumber(v))}
        label={`${meta.label} per session`}
        onPick={setActive}
      />

      <div className="border-hairline mt-4 border-t pt-3">
        <ChartFigures
          items={[
            {
              label: lowerIsBetter ? "Least" : "Best",
              value: withUnit(values[bestIndex]),
              detail: formatShortDate(points[bestIndex].date),
            },
            {
              label: "Change",
              value:
                points.length < 2
                  ? "—"
                  : `${signed(overall.abs, fmt)}${unitLabel ? ` ${unitLabel}` : ""}`,
              detail:
                points.length < 2
                  ? "one session"
                  : overall.pct == null
                    ? `since ${formatShortDate(points[0].date)}`
                    : `${signed(overall.pct, (n) => `${Math.round(n)}%`)} since ${formatShortDate(points[0].date)}`,
            },
            {
              label: "Sessions",
              value: String(points.length),
              detail: rangeMeta.days == null ? "all time" : `last ${rangeMeta.label}`,
            },
          ]}
        />
      </div>

      {rangeRow}
    </div>
  );
}

/**
 * The line itself, in real pixels. Owns nothing but the drawing and the
 * gesture — every figure it shows is derived by the parent so the readout, the
 * table and the plot cannot disagree.
 */
function Plot({
  points,
  values,
  rangeDays,
  shown,
  inspecting,
  bestIndex,
  format,
  label,
  onPick,
}: {
  points: ExerciseSessionPoint[];
  values: number[];
  rangeDays: number | null;
  shown: number;
  inspecting: boolean;
  bestIndex: number;
  format: (v: number) => string;
  label: string;
  onPick: (fn: (prev: number | null) => number | null) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const lastIndex = points.length - 1;
  const plotL = PAD_L;
  const plotR = Math.max(plotL + 1, width - GUTTER);
  const innerR = plotR - PAD_R;

  const { start, end } = useMemo(
    () => timeDomain(points.map((p) => p.date), rangeDays),
    [points, rangeDays],
  );
  const scale = useMemo(
    () => niceScale(Math.min(...values), Math.max(...values)),
    [values],
  );
  const ticks = useMemo(() => timeTicks(start, end), [start, end]);

  const x = (t: number) => plotL + ((t - start) / (end - start)) * (innerR - plotL);
  const y = (v: number) =>
    PAD_TOP + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * (PLOT_H - PAD_TOP);

  const xs = points.map((p) => x(p.date.getTime()));

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  const pickAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    onPick(() => nearestIndex(xs, clientX - rect.left));
  };

  // A drag across the plot scrubs; `touch-action: pan-y` leaves the page's
  // vertical scroll to the browser, which cancels the pointer the moment it
  // decides the gesture was a scroll.
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

  // Keyboard: the same scrub, one session at a time.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : null;
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

  const showDots = points.length <= MAX_DOTTED;
  const best = bestIndex !== shown && points.length >= 2 ? bestIndex : null;
  const bestLabel = best != null ? `Best ${format(values[best])}` : "";
  const bestX = best != null ? Math.min(Math.max(xs[best], plotL + 30), innerR - 30) : 0;
  const bestAbove = best != null && y(values[best]) > PAD_TOP + 12;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${label}. ${points.length} sessions. Use the arrow keys to move between them.`}
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
          <XAxis
            ticks={ticks.map((t) => ({ x: x(t.at), label: t.label }))}
            baseline={PLOT_H}
            x1={plotR}
          />

          {/* Crosshair, only while inspecting: the latest point needs none,
              its readout is the default. */}
          {inspecting && (
            <line
              x1={xs[shown]}
              x2={xs[shown]}
              y1={PAD_TOP - 8}
              y2={PLOT_H}
              className="stroke-hairline-strong"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          )}

          <path
            d={path}
            fill="none"
            className="stroke-volt"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* A small dot per session while there are few enough to read as
              sessions; the selection and the endpoint are the two real
              markers, ringed in the surface colour so they stay legible where
              the line doubles back on itself. */}
          {values.map((v, i) => {
            const isShown = i === shown;
            const isEnd = i === lastIndex;
            if (isShown || isEnd) {
              return (
                <circle
                  key={points[i].workoutId}
                  cx={xs[i]}
                  cy={y(v)}
                  r={isShown ? 5 : 4}
                  className="fill-volt stroke-surface-1 transition-[r] duration-150"
                  strokeWidth={2}
                />
              );
            }
            if (!showDots) return null;
            return (
              <circle
                key={points[i].workoutId}
                cx={xs[i]}
                cy={y(v)}
                r={2.5}
                className="fill-volt"
              />
            );
          })}

          {/* One direct label: the extreme. The endpoint is the readout. */}
          {best != null && (
            <text
              x={bestX}
              y={bestAbove ? y(values[best]) - 11 : y(values[best]) + 18}
              textAnchor="middle"
              className="fill-text-2 num text-[10px] font-semibold"
            >
              {bestLabel}
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
