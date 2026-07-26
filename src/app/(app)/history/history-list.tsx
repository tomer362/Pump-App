"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { Card, Badge } from "@/components/ui/primitives";
import { LoadMore } from "@/components/ui/load-more";
import { loadMoreHistory } from "@/lib/actions/paginate";
import { HISTORY_PAGE_SIZE } from "@/lib/pagination";
import {
  formatDayLabel,
  formatDurationLong,
  formatVolume,
} from "@/lib/utils";

type Workout = {
  id: string;
  name: string;
  startedAt: Date;
  durationSeconds: number;
  totalVolumeKg: number;
  totalSets: number;
  prCount: number;
};

export function HistoryList({
  initial,
  unit,
}: {
  initial: Workout[];
  unit: "kg" | "lb";
}) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(
    initial.length < HISTORY_PAGE_SIZE,
  );

  async function more() {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    const next = await loadMoreHistory(new Date(last.startedAt).toISOString());
    setLoading(false);
    if (next.length < HISTORY_PAGE_SIZE) setExhausted(true);
    if (!next.length) return;
    setItems((prev) => {
      const seen = new Set(prev.map((w) => w.id));
      return [...prev, ...next.filter((w) => !seen.has(w.id))];
    });
  }

  // Group by calendar month so a long history stays scannable. Done here
  // rather than on the server so an appended page merges into the month it
  // belongs to instead of starting a duplicate heading.
  const groups = new Map<string, Workout[]>();
  for (const w of items) {
    const key = new Date(w.startedAt).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
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
                    {formatDayLabel(new Date(w.startedAt))} ·{" "}
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
        <LoadMore onClick={more} loading={loading} label="Earlier workouts" />
      )}
    </div>
  );
}
