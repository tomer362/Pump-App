import Link from "next/link";
import { Calendar, ChevronRight, Flame, Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { MuscleVolumeChart } from "@/components/stats/muscle-volume-chart";
import { WeeklyTrendChart } from "@/components/stats/weekly-trend-chart";
import { requireUser } from "@/lib/session";
import {
  getLifetimeStats,
  getMuscleVolume,
  getWeeklyTrend,
} from "@/lib/queries/stats";
import { getPersonalRecords } from "@/lib/queries/workout";
import { formatDurationLong, formatVolume, formatWeight } from "@/lib/utils";

export default async function StatsPage() {
  const me = await requireUser();

  const [lifetime, muscles, trend, prs] = await Promise.all([
    getLifetimeStats(me.id),
    getMuscleVolume(me.id, 7),
    getWeeklyTrend(me.id, 12),
    getPersonalRecords(me.id),
  ]);

  const oneRepMaxes = prs.filter((p) => p.kind === "1rm").slice(0, 6);

  return (
    <div className="pb-8">
      <NavBar title="Stats" />

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
          <SectionTitle>This week by muscle</SectionTitle>
          <Card className="px-4 py-4">
            <MuscleVolumeChart data={muscles} unit={me.unit} />
          </Card>
        </div>

        <div>
          <SectionTitle>Last 12 weeks</SectionTitle>
          <Card className="px-4 py-4">
            <WeeklyTrendChart data={trend} unit={me.unit} />
          </Card>
        </div>

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

        <Link href="/history">
          <Card className="press flex items-center gap-3 px-4 py-3.5">
            <Calendar className="text-text-3 size-5 shrink-0" />
            <p className="flex-1 text-[15px] font-medium">Workout history</p>
            <ChevronRight className="text-text-3 size-4 shrink-0" />
          </Card>
        </Link>
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
