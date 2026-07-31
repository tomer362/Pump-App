"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Info,
  Play,
} from "lucide-react";
import { Card, EmptyState, Segmented, SectionTitle } from "@/components/ui/primitives";
import { ExerciseProgressChart } from "./exercise-progress-chart";
import { RepMaxTable } from "./rep-max-table";
import { RecordsGrid, type RecordRow } from "./records-grid";
import type {
  ExerciseAlternativeItem,
  ExerciseHistoryPoint,
  ExerciseSessionPoint,
  ExerciseSummary,
  RepMax,
} from "@/lib/queries/exercise";
import { formatDayLabel, formatVolume, formatWeight, labelize } from "@/lib/utils";

type Tab = "about" | "history" | "charts" | "records";

const TABS = [
  { value: "about" as const, label: "About" },
  { value: "history" as const, label: "History" },
  { value: "charts" as const, label: "Charts" },
  { value: "records" as const, label: "Records" },
];

export type ExerciseDetailData = {
  bodyEffect: string | null;
  instructions: string | null;
  secondaryMuscles: string[];
  video: { href: string; curated: boolean };
  alternatives: ExerciseAlternativeItem[];
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
}: {
  data: ExerciseDetailData;
  unit: "kg" | "lb";
}) {
  const [tab, setTab] = useState<Tab>(
    data.summary.sessions > 0 ? "charts" : "about",
  );

  return (
    <div className="space-y-5">
      <Segmented value={tab} onChange={setTab} options={TABS} />

      {tab === "about" && <About data={data} />}
      {tab === "history" && <History data={data} unit={unit} />}
      {tab === "charts" && <Charts data={data} unit={unit} />}
      {tab === "records" && <Records data={data} unit={unit} />}
    </div>
  );
}

function About({ data }: { data: ExerciseDetailData }) {
  return (
    <div className="space-y-6">
      {/* Why before how: what the movement does to you, then how to do it. */}
      {data.bodyEffect && (
        <div>
          <SectionTitle>What it trains</SectionTitle>
          <Card className="px-4 py-3.5">
            <p className="text-text-2 text-[14px] leading-relaxed whitespace-pre-line">
              {data.bodyEffect}
            </p>
          </Card>
        </div>
      )}

      {data.secondaryMuscles.length > 0 && (
        <div>
          <SectionTitle>Also works</SectionTitle>
          <Card className="px-4 py-3">
            <p className="text-text-2 text-[14px]">
              {data.secondaryMuscles.map(labelize).join(" · ")}
            </p>
          </Card>
        </div>
      )}

      {data.instructions && (
        <div>
          <SectionTitle>How to do it</SectionTitle>
          <Card className="px-4 py-3.5">
            <p className="text-text-2 text-[14px] leading-relaxed whitespace-pre-line">
              {data.instructions}
            </p>
          </Card>
        </div>
      )}

      {!data.bodyEffect && !data.instructions && (
        <EmptyState
          icon={Info}
          title="No notes yet"
          body="Custom exercises start blank — edit it to add your own setup and cues."
        />
      )}

      {/* Grayscale, not volt: a link out isn't state that matters. The label
          never calls a search a demonstration — see lib/exercise-video.ts. */}
      <div>
        <SectionTitle>Form</SectionTitle>
        <Card className="overflow-hidden">
          <a
            href={data.video.href}
            target="_blank"
            rel="noreferrer noopener"
            className="press flex items-center gap-3 px-4 py-3"
          >
            <span className="bg-surface-3 grid size-11 shrink-0 place-items-center rounded-lg">
              <Play className="text-text-2 size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {data.video.curated ? "Watch the form" : "Find a form demo"}
              </span>
              <span className="text-text-3 block text-[12px]">
                {data.video.curated
                  ? "Opens YouTube"
                  : "Searches YouTube for this exercise"}
              </span>
            </span>
            <ExternalLink className="text-text-3 size-4 shrink-0" />
          </a>
        </Card>
      </div>

      {data.alternatives.length > 0 && (
        <div>
          <SectionTitle>Alternatives</SectionTitle>
          <Card className="divide-hairline divide-y overflow-hidden">
            {data.alternatives.map((a) => (
              <Link
                key={a.id}
                href={`/exercises/${a.id}`}
                // items-start, not items-center: the note makes these rows
                // three lines tall and a centred chevron reads as misaligned.
                className="press flex items-start gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{a.name}</p>
                  <p className="text-text-3 truncate text-[12px]">
                    {labelize(a.primaryMuscle)} · {labelize(a.equipment)}
                  </p>
                  <p className="text-text-2 mt-1.5 text-[13px] leading-relaxed">
                    {a.note}
                  </p>
                </div>
                <ChevronRight className="text-text-3 mt-0.5 size-4 shrink-0" />
              </Link>
            ))}
          </Card>
        </div>
      )}
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
