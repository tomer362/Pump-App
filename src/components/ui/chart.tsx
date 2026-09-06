"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Table2, TrendingUp } from "lucide-react";
import { IconButton } from "./button";
import { cn } from "@/lib/utils";

/**
 * The pieces every chart in the app is built from, so the exercise chart and
 * the weekly trend read as one instrument: the same readout above the plot,
 * the same metric tabs, the same tick type, the same summary strip beneath.
 *
 * The plots themselves are drawn in real pixels — each chart measures its
 * container and lays out an SVG in that width — rather than in a stretched
 * `viewBox`. A non-uniform viewBox squashes every circle and every glyph, which
 * is why the old chart had to float its markers in an HTML overlay and could
 * not label an axis at all.
 */

/** The width of a container, kept current by a ResizeObserver. `0` until measured. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ---------------------------------------------------------------- Metric tabs */

/**
 * Which measure the chart shows. Text on a hairline with a volt underline —
 * the accent rule allows the active tab, and it keeps this distinct from the
 * page's own segmented control sitting a few pixels above it. Bleeds to the
 * card edge so the rule runs the full width.
 */
export function MetricTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div
      role="tablist"
      className="border-hairline scrollbar-none -mx-4 -mt-1 flex overflow-x-auto border-b px-2"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-11 shrink-0 px-2.5 text-[14px] font-medium whitespace-nowrap transition-colors",
              active ? "text-text-1" : "text-text-3 hover:text-text-2",
            )}
          >
            {o.label}
            {active && (
              <span
                aria-hidden
                className="bg-volt absolute inset-x-2.5 bottom-0 h-[2px] rounded-t-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- Readout */

/**
 * The number the chart is about, large, with what it is and how it moved. This
 * is the chart's tooltip: scrubbing the plot rewrites it, so a value is never
 * hidden inside a bubble over a 2px line. `label` is the date or the week;
 * `delta` compares to the previous point.
 */
export function ChartReadout({
  value,
  unit,
  label,
  delta,
  isLatest,
  onLatest,
}: {
  value: string;
  unit?: string;
  label: ReactNode;
  delta?: { abs: number; text: string; good: boolean } | null;
  isLatest: boolean;
  onLatest: () => void;
}) {
  return (
    <div className="flex min-h-[58px] items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="num-prop text-[34px] leading-none font-extrabold tracking-tight">
          {value}
          {unit && (
            <span className="text-text-3 ml-1 text-[15px] font-bold">{unit}</span>
          )}
        </p>
        <p className="text-text-3 mt-1.5 flex items-center gap-1.5 text-[12px]">
          <span className="num truncate">{label}</span>
          {delta && (
            <>
              <span aria-hidden>·</span>
              <Delta {...delta} />
            </>
          )}
        </p>
      </div>
      {/* Only offered once you have left the latest point: it is the way
          back, and a control that does nothing should not be drawn. */}
      {!isLatest && (
        <button
          onClick={onLatest}
          className="press bg-surface-2 text-text-2 mt-0.5 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium"
        >
          Latest
        </button>
      )}
    </div>
  );
}

/**
 * A change against the previous point. Grey, not volt — an improvement is not
 * a record, and volt on a figure here would claim one. Direction is carried by
 * the arrow as well as the sign, so it survives any colour.
 */
export function Delta({
  abs,
  text,
  good,
}: {
  abs: number;
  text: string;
  good: boolean;
}) {
  const Icon = abs >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 whitespace-nowrap",
        abs === 0 ? "text-text-3" : good ? "text-text-2" : "text-text-3",
      )}
    >
      {abs !== 0 && <Icon className="size-3" strokeWidth={2.5} />}
      {text}
    </span>
  );
}

/* --------------------------------------------------------------- Figures strip */

/** The three or so numbers that answer the range's questions at a glance. */
export function ChartFigures({
  items,
}: {
  items: { label: string; value: string; detail?: string }[];
}) {
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-text-3 text-[11px]">{f.label}</dt>
          <dd className="num mt-0.5 truncate text-[15px] font-bold">{f.value}</dd>
          {f.detail && (
            <dd className="text-text-3 num truncate text-[11px]">{f.detail}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/* ---------------------------------------------------------------- Table toggle */

export function TableToggle({
  asTable,
  onChange,
}: {
  asTable: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <IconButton
      label={asTable ? "Show chart" : "Show table"}
      aria-pressed={asTable}
      onClick={() => onChange(!asTable)}
      className="text-text-3 shrink-0"
    >
      {asTable ? <TrendingUp className="size-[18px]" /> : <Table2 className="size-[18px]" />}
    </IconButton>
  );
}

/* --------------------------------------------------------------- SVG helpers */

/** Tick labels in the right-hand gutter, one per gridline. */
export function YAxis({
  ticks,
  y,
  x,
  format,
}: {
  ticks: number[];
  y: (v: number) => number;
  /** Right edge of the plot; labels are drawn to its right, anchored there. */
  x: number;
  format: (v: number) => string;
}) {
  return (
    <g className="fill-text-3 num text-[10px]">
      {ticks.map((t) => (
        <text key={t} x={x + 8} y={y(t)} dominantBaseline="middle">
          {format(t)}
        </text>
      ))}
    </g>
  );
}

/** Horizontal hairlines at each tick. Solid, one step off the surface. */
export function GridLines({
  ticks,
  y,
  x0,
  x1,
}: {
  ticks: number[];
  y: (v: number) => number;
  x0: number;
  x1: number;
}) {
  return (
    <g className="stroke-hairline" strokeWidth={1} shapeRendering="crispEdges">
      {ticks.map((t) => (
        <line key={t} x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
      ))}
    </g>
  );
}

/** Labels along the bottom band, each with a 4px tick down from the baseline. */
export function XAxis({
  ticks,
  baseline,
  x1,
}: {
  ticks: { x: number; label: string }[];
  baseline: number;
  /** Right edge of the plot, so a label never runs into the gutter. */
  x1: number;
}) {
  return (
    <g className="fill-text-3 num text-[10px]">
      {ticks.map((t) => {
        // Roughly 5.5px per glyph at this size — enough to keep a label off
        // the gutter without measuring text.
        const w = t.label.length * 5.5;
        if (t.x + w > x1 + 6) return null;
        return (
          <g key={`${t.x}-${t.label}`}>
            <line
              x1={t.x}
              x2={t.x}
              y1={baseline}
              y2={baseline + 4}
              className="stroke-hairline-strong"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text x={t.x} y={baseline + 15}>
              {t.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
