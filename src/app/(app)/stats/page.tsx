import { Suspense } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, Flame, Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Card, SectionTitle } from "@/components/ui/primitives";
import {
  Skeleton,
  SkeletonChartCard,
  SkeletonStatHero,
} from "@/components/ui/skeleton";
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

type Unit = "kg" | "lb";

/**
 * Six queries used to be awaited together before a single byte was sent, so
 * the page was as slow as its slowest aggregate — and on a cold Neon that is
 * the 200-day training calendar. Each block now streams on its own.
 */
export default async function StatsPage() {
  const me = await requireUser();

  return (
    <div className="pb-8">
      {/* Reached from the Exercises tab rather than owning a tab itself, so it
          needs a way back. */}
      <NavBar title="Stats" back="/exercises" />

      <div className="space-y-6 px-4">
        <Suspense fallback={<HeroFallback />}>
          <HeroPanel userId={me.id} unit={me.unit} />
        </Suspense>

        <Suspense fallback={<SkeletonChartCard height="9rem" />}>
          <MusclePanel userId={me.id} unit={me.unit} />
        </Suspense>

        <Suspense fallback={<SkeletonChartCard height="7rem" />}>
          <ConsistencyPanel userId={me.id} />
        </Suspense>

        <Suspense fallback={<SkeletonChartCard height="10rem" />}>
          <TrendPanel userId={me.id} unit={me.unit} />
        </Suspense>

        <Suspense fallback={null}>
          <RecordsPanels userId={me.id} unit={me.unit} />
        </Suspense>

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

function HeroFallback() {
  return (
    <>
      <SkeletonStatHero />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="rounded-card h-[62px]" />
        <Skeleton className="rounded-card h-[62px]" />
      </div>
    </>
  );
}

async function HeroPanel({ userId, unit }: { userId: string; unit: Unit }) {
  const lifetime = await getLifetimeStats(userId);

  return (
    <>
      {/* Hero figure: exactly one per view. */}
      <Card className="px-4 py-5">
        <p className="text-text-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
          Lifetime volume
        </p>
        {/* Deliberately not counted up. This is server-rendered, so an entry
            animation would have to paint the real figure and then jump back to
            zero — the one number on the page briefly lying. Count-up belongs to
            moments that mount client-side, like the finish celebration. */}
        <p className="num-prop text-volt mt-1 text-[48px] leading-none font-extrabold">
          {formatVolume(lifetime.totalVolumeKg, unit)}
          <span className="text-text-3 ml-1.5 text-[18px] font-bold">
            {unit}
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
    </>
  );
}

async function MusclePanel({ userId, unit }: { userId: string; unit: Unit }) {
  const muscles = await getMuscleVolume(userId, 7);
  return (
    <div>
      <SectionTitle>By muscle</SectionTitle>
      <Card className="px-4 py-4">
        <MuscleVolumePanel initial={muscles} unit={unit} />
      </Card>
    </div>
  );
}

async function ConsistencyPanel({ userId }: { userId: string }) {
  const calendar = await getTrainingCalendar(userId, 200);
  return (
    <div>
      <SectionTitle>Consistency</SectionTitle>
      <Card className="px-4 py-4">
        <ConsistencyHeatmap days={calendar} />
      </Card>
    </div>
  );
}

async function TrendPanel({ userId, unit }: { userId: string; unit: Unit }) {
  const trend = await getWeeklyTrend(userId, 12);
  return (
    <div>
      <SectionTitle>Last 12 weeks</SectionTitle>
      <Card className="px-4 py-4">
        <WeeklyTrendChart data={trend} unit={unit} />
      </Card>
    </div>
  );
}

/**
 * One boundary for both record blocks: they are adjacent, both hide themselves
 * when empty, and two separate fallbacks would make the tail of the page
 * jitter twice.
 */
async function RecordsPanels({ userId, unit }: { userId: string; unit: Unit }) {
  const [recentRecords, prs] = await Promise.all([
    getRecentRecords(userId, 6),
    getPersonalRecords(userId),
  ]);
  const oneRepMaxes = prs.filter((p) => p.kind === "1rm").slice(0, 6);

  return (
    <>
      {recentRecords.length > 0 && (
        <div>
          <SectionTitle action={<AllRecordsLink />}>
            Recent records
          </SectionTitle>
          <Card className="overflow-hidden">
            <PrTimeline records={recentRecords} unit={unit} />
          </Card>
        </div>
      )}

      {oneRepMaxes.length > 0 && (
        <div>
          <SectionTitle action={<AllRecordsLink />}>
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
                      ? `${formatWeight(pr.weightKg, unit)} ${unit} × ${pr.reps}`
                      : "—"}
                  </p>
                </div>
                <p className="num text-text-1 shrink-0 text-[15px] font-bold">
                  {formatWeight(pr.value, unit)}
                  <span className="text-text-3 ml-0.5 text-[12px]">{unit}</span>
                </p>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}

function AllRecordsLink() {
  return (
    <Link href="/records" className="text-volt text-[13px] font-semibold">
      All
    </Link>
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
