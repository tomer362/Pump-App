"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Card, EmptyState, Segmented, SectionTitle } from "@/components/ui/primitives";
import { ExerciseAbout, type ExerciseAboutData } from "./exercise-about";
import { ExerciseProgressChart } from "./exercise-progress-chart";
import { RepMaxTable } from "./rep-max-table";
import { RecordsGrid, type RecordRow } from "./records-grid";
import type {
  ExerciseHistoryPoint,
  ExerciseSessionPoint,
  ExerciseSummary,
  RepMax,
} from "@/lib/queries/exercise";
import { useRouteMemory } from "@/hooks/use-route-memory";
import { cn, formatDayLabel, formatVolume, formatWeight } from "@/lib/utils";
import { isAssistedTracking } from "@/lib/tracking";

type Tab = "about" | "history" | "charts" | "records";

const TABS = [
  { value: "about" as const, label: "About" },
  { value: "history" as const, label: "History" },
  { value: "charts" as const, label: "Charts" },
  { value: "records" as const, label: "Records" },
];

function reviveTab(value: unknown): Tab | null {
  return TABS.some((t) => t.value === value) ? (value as Tab) : null;
}

/**
 * The About half is its own type because the routine builder shows that panel
 * alone, in a sheet, with none of the aggregates below it. Composed rather than
 * restated so the two can't drift.
 */
export type ExerciseDetailData = ExerciseAboutData & {
  /**
   * Carried down because `assist_reps` reverses what these panels mean: the
   * weight column is the machine's counterweight, so the best session is the
   * one that needed the least, there is no estimated 1RM, and none of it is
   * tonnage. The queries already return the flipped figures — this is what lets
   * the labels say so.
   */
  trackingType: string;
  summary: ExerciseSummary;
  series: ExerciseSessionPoint[];
  history: ExerciseHistoryPoint[];
  repMaxes: RepMax[];
  records: RecordRow[];
};

/**
 * The four faces of an exercise: what it is, what you did, how it's trending,
 * and your bests. Splitting them keeps each screen a single idea — the whole
 * thing on one scroll was a wall you had to read past to reach the numbers.
 *
 * Every series is passed down whole and filtered client-side, so switching a
 * tab or a range is instant and costs no round trip.
 */
export function ExerciseDetailTabs({
  data,
  unit,
  className,
}: {
  data: ExerciseDetailData;
  unit: "kg" | "lb";
  className?: string;
}) {
  // Remembered per exercise: opening a session from the History tab and
  // pressing back has to come back to History. The panels are `&&`-mounted, so
  // landing on the wrong one also means landing on a page of a different
  // height, with nowhere for the restored scroll offset to go.
  const [tab, setTab] = useRouteMemory<Tab>(
    "exercise-tab",
    data.summary.sessions > 0 ? "charts" : "about",
    reviveTab,
  );

  return (
    <div className={cn("space-y-5", className)}>
      <Segmented value={tab} onChange={setTab} options={TABS} />

      {tab === "about" && <ExerciseAbout data={data} />}
      {tab === "history" && <History data={data} unit={unit} />}
      {tab === "charts" && <Charts data={data} unit={unit} />}
      {tab === "records" && <Records data={data} unit={unit} />}
    </div>
  );
}

function NotLoggedYet() {
  return (
    <EmptyState
      icon={Dumbbell}
      title="Not logged yet"
      body="Once you complete a few sets of this exercise, its history, charts and records appear here."
    />
  );
}

function Charts({
  data,
  unit,
}: {
  data: ExerciseDetailData;
  unit: "kg" | "lb";
}) {
  if (data.series.length === 0) return <NotLoggedYet />;
  const s = data.summary;
  const assisted = isAssistedTracking(data.trackingType);
  // The lightest counterweight ever needed — the figure an assisted machine has
  // instead of a volume total, and the one the whole exercise is aimed at.
  const leastAssist = assisted
    ? data.series.reduce<number | null>(
        (best, p) =>
          p.topWeightKg != null && (best == null || p.topWeightKg < best)
            ? p.topWeightKg
            : best,
        null,
      )
    : null;

  return (
    <div className="space-y-6">
      <Card className="px-4 py-4">
        <ExerciseProgressChart
          data={data.series}
          unit={unit}
          assisted={assisted}
        />
      </Card>

      <div>
        <SectionTitle>All time</SectionTitle>
        <Card className="grid grid-cols-2 gap-x-3 gap-y-4 px-4 py-4">
          <Figure label="Sessions" value={String(s.sessions)} />
          <Figure label="Working sets" value={String(s.sets)} />
          <Figure label="Reps" value={String(s.reps)} />
          {/* Assistance is not tonnage, so there is no volume to total — and a
              "0 kg" tile would read as a bug rather than as a category error.
              Least assistance is the figure that belongs in its place. */}
          {assisted ? (
            <Figure
              label="Least assist"
              value={
                leastAssist == null
                  ? "—"
                  : `−${formatWeight(leastAssist, unit)} ${unit}`
              }
            />
          ) : (
            <Figure
              label="Volume"
              value={`${formatVolume(s.volumeKg, unit)} ${unit}`}
            />
          )}
        </Card>
        {s.firstPerformedAt && (
          <p className="text-text-3 mt-2 text-[12px]">
            First logged {formatDayLabel(s.firstPerformedAt)}
            {s.lastPerformedAt
              ? ` · last ${formatDayLabel(s.lastPerformedAt)}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function Records({
  data,
  unit,
}: {
  data: ExerciseDetailData;
  unit: "kg" | "lb";
}) {
  if (data.series.length === 0) return <NotLoggedYet />;

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Your records</SectionTitle>
        <RecordsGrid records={data.records} unit={unit} />
      </div>

      <div>
        <SectionTitle>Best at each rep count</SectionTitle>
        <Card className="px-4 py-3">
          <RepMaxTable
            rows={data.repMaxes}
            unit={unit}
            assisted={isAssistedTracking(data.trackingType)}
          />
        </Card>
      </div>
    </div>
  );
}

function History({
  data,
  unit,
}: {
  data: ExerciseDetailData;
  unit: "kg" | "lb";
}) {
  if (data.history.length === 0) return <NotLoggedYet />;
  const assisted = isAssistedTracking(data.trackingType);

  return (
    <div className="space-y-3">
      {data.history.map((h) => (
        <Link key={h.workoutId} href={`/history/${h.workoutId}`}>
          <Card className="press px-4 py-3">
            <div className="mb-1.5 flex items-baseline gap-2">
              <p className="text-text-3 flex-1 text-[12px]">
                {formatDayLabel(new Date(h.date))}
              </p>
              {/* Assistance sums to nothing, so the session line carries the
                  count of sets it did instead of a 0 kg total. */}
              <p className="text-text-3 num text-[12px]">
                {assisted
                  ? `${h.sets.filter((s) => s.setType !== "warmup").length} sets`
                  : `${formatVolume(h.totalVolumeKg, unit)} ${unit}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {h.sets.map((s, i) => (
                <span key={i} className="num text-[14px]">
                  <span className="text-text-3">
                    {s.setType === "warmup" ? "W" : i + 1}
                  </span>{" "}
                  <span className="font-semibold">
                    {s.weightKg != null
                      ? `${assisted ? "−" : ""}${formatWeight(s.weightKg, unit)}`
                      : "—"}
                  </span>
                  <span className="text-text-3">×{s.reps ?? "—"}</span>
                </span>
              ))}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="num-prop text-[22px] leading-none font-bold">{value}</p>
      <p className="text-text-3 mt-1 truncate text-[11px]">{label}</p>
    </div>
  );
}
