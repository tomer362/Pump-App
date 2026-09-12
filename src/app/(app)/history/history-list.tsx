"use client";

import Link from "next/link";
import { DayLabel } from "@/components/ui/day-label";
import { ChevronRight, Trophy } from "lucide-react";
import { Card, Badge } from "@/components/ui/primitives";
import { LoadMore } from "@/components/ui/load-more";
import { loadMoreHistory } from "@/lib/actions/paginate";
import { HISTORY_PAGE_SIZE } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { formatDurationLong, formatVolume, formatMonthYear } from "@/lib/utils";

type Workout = {
  id: string;
  name: string;
  startedAt: Date;
  durationSeconds: number;
  totalVolumeKg: number;
  totalSets: number;
  prCount: number;
};

/** JSON has no `Date`; the rows are grouped and labelled by `startedAt`. */
function reviveWorkout(value: unknown): Workout {
  const w = value as Workout;
  return { ...w, startedAt: new Date(w.startedAt) };
}

export function HistoryList({
  initial,
  unit,
}: {
  initial: Workout[];
  unit: "kg" | "lb";
}) {
  // Cached for the session: opening a workout from six months down and coming
  // back must not drop you at this month again.
  const { items, loading, exhausted, more, failed } = usePagedList({
    initial,
    pageSize: HISTORY_PAGE_SIZE,
    name: "history",
    idOf: (w) => w.id,
    revive: reviveWorkout,
    fetchMore: (last) =>
      loadMoreHistory(new Date(last.startedAt).toISOString(), last.id),
  });

  // Group by calendar month so a long history stays scannable. Done here
  // rather than on the server so an appended page merges into the month it
  // belongs to instead of starting a duplicate heading.
  const groups = new Map<string, Workout[]>();
  for (const w of items) {
    // Not `toLocaleDateString`: Node's ICU and the browser's disagree on
    // the odd month name, and a mismatch here discards the whole list.
    const key = formatMonthYear(new Date(w.startedAt));
    const list = groups.get(key) ?? [];
    list.push(w);
    groups.set(key, list);
  }

  return (
    <div className="space-y-6 px-4">
      {[...groups.entries()].map(([month, list]) => (
        <div key={month}>
          <h3 className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {month}
          </h3>
          <Card className="divide-hairline divide-y">
            {list.map((w) => (
              <Link
                key={w.id}
                href={`/history/${w.id}`}
                className="press flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-medium">{w.name}</p>
                    {w.prCount > 0 && (
                      <Badge tone="pr">
                        <Trophy className="size-3" strokeWidth={2.6} />
                        {w.prCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-text-3 num text-[12px]">
                    <DayLabel date={w.startedAt} /> ·{" "}
                    {formatDurationLong(w.durationSeconds)} · {w.totalSets} sets
                  </p>
                </div>
                <p className="num text-text-2 shrink-0 text-[13px] font-semibold">
                  {formatVolume(w.totalVolumeKg, unit)}
                  <span className="text-text-3 ml-0.5 text-[11px]">{unit}</span>
                </p>
                <ChevronRight className="text-text-3 size-4 shrink-0" />
              </Link>
            ))}
          </Card>
        </div>
      ))}

      {!exhausted && (
        <LoadMore
          onClick={more}
          loading={loading}
          label={failed ? "Couldn't load — try again" : "Earlier workouts"}
        />
      )}
    </div>
  );
}
