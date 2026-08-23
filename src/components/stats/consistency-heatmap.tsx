"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { TrainingDay } from "@/lib/queries/stats";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { cn, formatDayLabel } from "@/lib/utils";

const WEEKS = 26;
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Half a year is wider than a phone and the newest week is the right-hand
 * edge, so at the browser's default `scrollLeft: 0` the screen opened on
 * February with `scrollbar-none` leaving nothing on screen to say the grid
 * scrolled at all. Over-assigning is clamped to the maximum offset, so on a
 * card wide enough to fit the whole grid this is a no-op — and never
 * `scrollIntoView`, which would also scroll the one root scroller the document
 * has and drag the page itself.
 */
function pinToThisWeek(el: HTMLElement) {
  el.scrollLeft = el.scrollWidth;
}

/**
 * Half a year of training days, one column per week.
 *
 * A sequential ramp of the single accent — this is the one place shading by
 * magnitude is honest, because the measure is quantitative and the cell has no
 * length to encode it with. Four steps, not a continuous gradient: nobody
 * reads a 40 % difference in opacity, and the question is "did I train, and
 * was it a big day".
 *
 * The date grid is built from a client-side "today" and the component only
 * renders after hydration, because a server-rendered grid would key off a
 * different instant and React would discard the subtree.
 */
export function ConsistencyHeatmap({ days }: { days: TrainingDay[] }) {
  const [active, setActive] = useState<string | null>(null);
  // The grid is anchored on "today", which the server and the client resolve
  // at different instants — and a text mismatch makes React discard the
  // subtree. Reading it through a store with a null server snapshot renders
  // the placeholder on the server and the real grid after hydration, the same
  // shape the rest timer uses for sessionStorage. The snapshot is a date key
  // rather than a Date so it stays referentially stable across renders.
  const todayKey = useSyncExternalStore(subscribeNever, snapshotToday, () => null);
  const today = useMemo(
    () => (todayKey ? new Date(`${todayKey}T00:00:00`) : null),
    [todayKey],
  );

  const { columns, monthLabels, total } = useMemo(() => {
    const empty = { columns: [], monthLabels: [], total: 0 } as {
      columns: { key: string; cells: (TrainingDay & { future: boolean })[] }[];
      monthLabels: { index: number; label: string }[];
      total: number;
    };
    if (!today) return empty;

    const byDay = new Map(days.map((d) => [d.day, d]));

    // Anchor on the coming Saturday so every column is a full week.
    const end = new Date(today.getTime() + (6 - today.getDay()) * DAY_MS);
    const start = new Date(end.getTime() - (WEEKS * 7 - 1) * DAY_MS);

    const cols: { key: string; cells: (TrainingDay & { future: boolean })[] }[] =
      [];
    const labels: { index: number; label: string }[] = [];
    let seenMonth = -1;
    let count = 0;

    for (let w = 0; w < WEEKS; w++) {
      const cells: (TrainingDay & { future: boolean })[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
        const key = toKey(date);
        const hit = byDay.get(key);
        if (hit) count += hit.workouts;
        cells.push({
          day: key,
          workouts: hit?.workouts ?? 0,
          volumeKg: hit?.volumeKg ?? 0,
          future: date.getTime() > today.getTime(),
        });
        if (d === 0 && date.getMonth() !== seenMonth) {
          seenMonth = date.getMonth();
          labels.push({ index: w, label: MONTHS[seenMonth] });
        }
      }
      cols.push({ key: cells[0].day, cells });
    }

    return { columns: cols, monthLabels: labels, total: count };
  }, [days, today]);

  const activeDay = active
    ? columns.flatMap((c) => c.cells).find((c) => c.day === active)
    : null;

  // Where you last had this grid, or this week on a first visit. The ref
  // callback fires when the grid mounts, which is later than mount: the
  // placeholder below renders until the store supplies a client-side date.
  const scroller = useScrollMemory("heatmap", pinToThisWeek);

  // Same height as the grid below, so nothing jumps when it fills in.
  if (!today) return <div aria-hidden className="h-[116px]" />;

  return (
    <div>
      <div ref={scroller} className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <div className="min-w-max">
          <div className="text-text-3 relative mb-1 h-3 text-[10px]">
            {monthLabels.map((m) => (
              <span
                key={`${m.index}-${m.label}`}
                className="absolute top-0"
                style={{ left: m.index * 14 }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((col) => (
              <div key={col.key} className="flex flex-col gap-[3px]">
                {col.cells.map((cell) => (
                  <button
                    key={cell.day}
                    onClick={() =>
                      setActive(active === cell.day ? null : cell.day)
                    }
                    disabled={cell.future}
                    aria-label={`${cell.day}: ${cell.workouts} workout${cell.workouts === 1 ? "" : "s"}`}
                    className={cn(
                      "size-[11px] rounded-[2px] transition-colors",
                      cell.future
                        ? "bg-transparent"
                        : cell.workouts === 0
                          ? "bg-surface-2"
                          : cell.workouts === 1
                            ? "bg-volt/45"
                            : "bg-volt",
                      active === cell.day && "ring-text-1 ring-1",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-text-3 num text-[12px]">
          {activeDay
            ? `${formatDayLabel(new Date(activeDay.day + "T00:00:00"))} · ${activeDay.workouts} workout${activeDay.workouts === 1 ? "" : "s"}`
            : `${total} sessions in the last ${WEEKS} weeks`}
        </p>
        <div className="text-text-3 flex shrink-0 items-center gap-1 text-[10px]">
          <span>Less</span>
          <span className="bg-surface-2 size-[9px] rounded-[2px]" />
          <span className="bg-volt/45 size-[9px] rounded-[2px]" />
          <span className="bg-volt size-[9px] rounded-[2px]" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

/** Today never changes underneath us within a session, so there is nothing to
 *  subscribe to — the store exists only to split the server and client render. */
const subscribeNever = () => () => {};
const snapshotToday = () => toKey(new Date());

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
