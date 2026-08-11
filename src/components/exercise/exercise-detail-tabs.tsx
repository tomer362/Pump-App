"use client";

import { useState } from "react";
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
import { cn, formatDayLabel, formatVolume, formatWeight } from "@/lib/utils";

type Tab = "about" | "history" | "charts" | "records";

const TABS = [
  { value: "about" as const, label: "About" },
  { value: "history" as const, label: "History" },
  { value: "charts" as const, label: "Charts" },
  { value: "records" as const, label: "Records" },
];

/**
 * The About half is its own type because the routine builder shows that panel
 * alone, in a sheet, with none of the aggregates below it. Composed rather than
 * restated so the two can't drift.
 */
export type ExerciseDetailData = ExerciseAboutData & {
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
  const [tab, setTab] = useState<Tab>(
    data.summary.sessions > 0 ? "charts" : "about",
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

  return (
    <div className="space-y-6">
      <Card className="px-4 py-4">
        <ExerciseProgressChart data={data.series} unit={unit} />
      </Card>

      <div>
        <SectionTitle>All time</SectionTitle>
        <Card className="grid grid-cols-2 gap-x-3 gap-y-4 px-4 py-4">
          <Figure label="Sessions" value={String(s.sessions)} />
          <Figure label="Working sets" value={String(s.sets)} />
          <Figure label="Reps" value={String(s.reps)} />
          <Figure
            label="Volume"
            value={`${formatVolume(s.volumeKg, unit)} ${unit}`}
          />
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
          <RepMaxTable rows={data.repMaxes} unit={unit} />
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

  return (
    <div className="space-y-3">
      {data.history.map((h) => (
        <Link key={h.workoutId} href={`/history/${h.workoutId}`}>
          <Card className="press px-4 py-3">
            <div className="mb-1.5 flex items-baseline gap-2">
              <p className="text-text-3 flex-1 text-[12px]">
                {formatDayLabel(new Date(h.date))}
              </p>
              <p className="text-text-3 num text-[12px]">
                {formatVolume(h.totalVolumeKg, unit)} {unit}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {h.sets.map((s, i) => (
                <span key={i} className="num text-[14px]">
                  <span className="text-text-3">
                    {s.setType === "warmup" ? "W" : i + 1}
                  </span>{" "}
                  <span className="font-semibold">
                    {s.weightKg != null ? formatWeight(s.weightKg, unit) : "—"}
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
