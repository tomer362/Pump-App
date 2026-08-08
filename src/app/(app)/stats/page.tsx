import Link from "next/link";
import { Calendar, ChevronRight, Flame, Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { MuscleVolumePanel } from "@/components/stats/muscle-volume-panel";
import { WeeklyTrendChart } from "@/components/stats/weekly-trend-chart";
import { ConsistencyHeatmap } from "@/components/stats/consistency-heatmap";
import { PrTimeline } from "@/components/stats/pr-timeline";
import { requireUser } from "@/lib/session";
import {
  getLifetimeStats,
  getMuscleVolume,
  getRecentRecords,
  getTrainingCalendar,
  getWeeklyTrend,
} from "@/lib/queries/stats";
import { getPersonalRecords } from "@/lib/queries/workout";
import { formatDurationLong, formatVolume, formatWeight } from "@/lib/utils";

export default async function StatsPage() {
  const me = await requireUser();

  const [lifetime, muscles, trend, prs, calendar, recentRecords] =
    await Promise.all([
      getLifetimeStats(me.id),
      getMuscleVolume(me.id, 7),
      getWeeklyTrend(me.id, 12),
      getPersonalRecords(me.id),
      getTrainingCalendar(me.id, 200),
      getRecentRecords(me.id, 6),
    ]);

  const oneRepMaxes = prs.filter((p) => p.kind === "1rm").slice(0, 6);

  return (
    <div className="pb-8">
      {/* Reached from the Exercises tab rather than owning a tab itself, so it
          needs a way back. */}
      <NavBar title="Stats" back="/exercises" />

      <div className="space-y-6 px-4">
        {/* Hero figure: exactly one per view. */}
        <Card className="px-4 py-5">
          <p className="text-text-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Lifetime volume
          </p>
          <p className="num-prop text-volt mt-1 text-[48px] leading-none font-extrabold">
            {formatVolume(lifetime.totalVolumeKg, me.unit)}
            <span className="text-text-3 ml-1.5 text-[18px] font-bold">
              {me.unit}
            </span>
          </p>
          <div className="text-text-3 mt-4 grid grid-cols-3 gap-3 text-[12px]">
            <Metric label="Workouts" value={String(lifetime.workouts)} />
            <Metric label="Sets" value={String(lifetime.totalSets)} />
            <Metric
              label="Time"
              value={formatDurationLong(lifetime.totalSeconds)}
            />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center gap-3 px-4 py-3.5">
            <span className="bg-volt-fade text-volt grid size-9 shrink-0 place-items-center rounded-full">
              <Flame className="size-[18px]" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="num-prop text-[22px] leading-none font-bold">
                {lifetime.currentStreak}
              </p>
              <p className="text-text-3 text-[11px]">
                day streak · best {lifetime.longestStreak}
              </p>
            </div>
          </Card>
          <Link href="/records">
            <Card className="press flex items-center gap-3 px-4 py-3.5">
              <span className="bg-pr-fade text-pr grid size-9 shrink-0 place-items-center rounded-full">
                <Trophy className="size-[18px]" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="num-prop text-[22px] leading-none font-bold">
                  {lifetime.prCount}
                </p>
                <p className="text-text-3 text-[11px]">records</p>
              </div>
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Card>
          </Link>
        </div>

        <div>
          <SectionTitle>By muscle</SectionTitle>
          <Card className="px-4 py-4">
            <MuscleVolumePanel initial={muscles} unit={me.unit} />
          </Card>
        </div>

        <div>
          <SectionTitle>Consistency</SectionTitle>
          <Card className="px-4 py-4">
            <ConsistencyHeatmap days={calendar} />
          </Card>
        </div>

        <div>
          <SectionTitle>Last 12 weeks</SectionTitle>
          <Card className="px-4 py-4">
            <WeeklyTrendChart data={trend} unit={me.unit} />
          </Card>
        </div>

        {recentRecords.length > 0 && (
          <div>
            <SectionTitle
              action={
                <Link
                  href="/records"
                  className="text-volt text-[13px] font-semibold"
                >
                  All
                </Link>
              }
            >
              Recent records
            </SectionTitle>
            <Card className="overflow-hidden">
              <PrTimeline records={recentRecords} unit={me.unit} />
            </Card>
          </div>
        )}

        {oneRepMaxes.length > 0 && (
          <div>
            <SectionTitle
              action={
                <Link
                  href="/records"
                  className="text-volt text-[13px] font-semibold"
                >
                  All
                </Link>
              }
            >
              Best estimated 1RM
            </SectionTitle>
            <Card className="divide-hairline divide-y">
              {oneRepMaxes.map((pr) => (
                <Link
                  key={pr.id}
                  href={`/exercises/${pr.exerciseId}`}
                  className="press flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {pr.exerciseName}
                    </p>
                    <p className="text-text-3 num text-[12px]">
                      {pr.weightKg != null && pr.reps != null
                        ? `${formatWeight(pr.weightKg, me.unit)} ${me.unit} × ${pr.reps}`
                        : "—"}
                    </p>
                  </div>
                  <p className="num text-text-1 shrink-0 text-[15px] font-bold">
                    {formatWeight(pr.value, me.unit)}
                    <span className="text-text-3 ml-0.5 text-[12px]">
                      {me.unit}
                    </span>
                  </p>
                </Link>
              ))}
            </Card>
          </div>
        )}

        {/* No "Exercises" card any more — this page is reached *from* the
            Exercises tab, so it would only point back at its own parent. */}
        <div className="space-y-3">
          <Link href="/history">
            <Card className="press flex items-center gap-3 px-4 py-3.5">
              <Calendar className="text-text-3 size-5 shrink-0" />
              <p className="flex-1 text-[15px] font-medium">Workout history</p>
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="num-prop text-text-1 text-[18px] leading-none font-bold">
        {value}
      </p>
      <p className="text-text-3 mt-0.5 truncate text-[11px]">{label}</p>
    </div>
  );
}
