import Link from "next/link";
import { CalendarDays, ChevronRight, Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Card, EmptyState, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { getWorkoutHistory } from "@/lib/queries/workout";
import {
  formatDayLabel,
  formatDurationLong,
  formatVolume,
} from "@/lib/utils";

export default async function HistoryPage() {
  const me = await requireUser();
  const workouts = await getWorkoutHistory(me.id, { limit: 60 });

  // Group by calendar month so a long history stays scannable.
  const groups = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const key = new Date(w.startedAt).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    const list = groups.get(key) ?? [];
    list.push(w);
    groups.set(key, list);
  }

  return (
    <div className="pb-8">
      <NavBar title="History" back="/stats" />

      {workouts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No workouts logged"
          body="Every session you finish is saved here with its sets, volume and records."
          action={
            <Link href="/start">
              <Button variant="volt">Start a workout</Button>
            </Link>
          }
        />
      ) : (
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
                        <p className="truncate text-[15px] font-medium">
                          {w.name}
                        </p>
                        {w.prCount > 0 && (
                          <Badge tone="pr">
                            <Trophy className="size-3" strokeWidth={2.6} />
                            {w.prCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-text-3 num text-[12px]">
                        {formatDayLabel(new Date(w.startedAt))} ·{" "}
                        {formatDurationLong(w.durationSeconds)} · {w.totalSets}{" "}
                        sets
                      </p>
                    </div>
                    <p className="num text-text-2 shrink-0 text-[13px] font-semibold">
                      {formatVolume(w.totalVolumeKg, me.unit)}
                      <span className="text-text-3 ml-0.5 text-[11px]">
                        {me.unit}
                      </span>
                    </p>
                    <ChevronRight className="text-text-3 size-4 shrink-0" />
                  </Link>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
