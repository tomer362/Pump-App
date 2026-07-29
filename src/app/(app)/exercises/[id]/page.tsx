import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/ui/nav-bar";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { ExerciseProgressChart } from "@/components/exercise/exercise-progress-chart";
import { DeleteExercise } from "./delete-exercise";
import { requireUser } from "@/lib/session";
import {
  getExercise,
  getExerciseAlternatives,
  getExerciseHistory,
  getExerciseRecords,
} from "@/lib/queries/exercise";
import { exerciseVideoLink } from "@/lib/exercise-video";
import { formatDayLabel, formatWeight, labelize } from "@/lib/utils";
import { ChevronRight, Dumbbell, ExternalLink, Play } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  "1rm": "Est. 1RM",
  weight: "Heaviest",
  volume: "Best set volume",
  reps: "Most reps",
};

export default async function ExerciseDetailPage(
  props: PageProps<"/exercises/[id]">,
) {
  const { id } = await props.params;
  const me = await requireUser();

  const exercise = await getExercise(id);
  if (!exercise) notFound();
  // Custom exercises belong to one user.
  if (exercise.ownerId && exercise.ownerId !== me.id) notFound();

  const [history, records, alternatives] = await Promise.all([
    getExerciseHistory(me.id, id, 30),
    getExerciseRecords(me.id, id),
    getExerciseAlternatives(id),
  ]);
  const video = exerciseVideoLink(exercise);

  return (
    <div className="pb-8">
      <NavBar
        title={exercise.name}
        back
        subtitle={`${labelize(exercise.primaryMuscle)} · ${labelize(exercise.equipment)}`}
      />

      <div className="space-y-6 px-4">
        {exercise.secondaryMuscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {exercise.secondaryMuscles.map((m) => (
              <Badge key={m}>{labelize(m)}</Badge>
            ))}
          </div>
        )}

        {/* Why before how: what the movement does to you, then how to do it. */}
        {exercise.bodyEffect && (
          <div>
            <SectionTitle>What it trains</SectionTitle>
            <Card className="px-4 py-3.5">
              <p className="text-text-2 text-[14px] leading-relaxed whitespace-pre-line">
                {exercise.bodyEffect}
              </p>
            </Card>
          </div>
        )}

        {exercise.instructions && (
          <div>
            <SectionTitle>How to do it</SectionTitle>
            <Card className="px-4 py-3.5">
              <p className="text-text-2 text-[14px] leading-relaxed whitespace-pre-line">
                {exercise.instructions}
              </p>
            </Card>
          </div>
        )}

        {/* Grayscale, not volt: a link out isn't state that matters. The label
            never calls a search a demonstration — see lib/exercise-video.ts. */}
        <div>
          <SectionTitle>Form</SectionTitle>
          <Card className="overflow-hidden">
            <a
              href={video.href}
              target="_blank"
              rel="noreferrer noopener"
              className="press flex items-center gap-3 px-4 py-3"
            >
              <span className="bg-surface-3 grid size-11 shrink-0 place-items-center rounded-lg">
                <Play className="text-text-2 size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">
                  {video.curated ? "Watch the form" : "Find a form demo"}
                </span>
                <span className="text-text-3 block text-[12px]">
                  {video.curated
                    ? "Opens YouTube"
                    : "Searches YouTube for this exercise"}
                </span>
              </span>
              <ExternalLink className="text-text-3 size-4 shrink-0" />
            </a>
          </Card>
        </div>

        {alternatives.length > 0 && (
          <div>
            <SectionTitle>Alternatives</SectionTitle>
            <Card className="divide-hairline divide-y overflow-hidden">
              {alternatives.map((a) => (
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

        {records.length > 0 && (
          <div>
            <SectionTitle>Your records</SectionTitle>
            <Card className="divide-hairline divide-y overflow-hidden">
              {records.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-text-3 flex-1 text-[13px]">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  <span className="num text-[15px] font-bold">
                    {r.kind === "reps"
                      ? `${Math.round(r.value)} reps`
                      : `${formatWeight(r.value, me.unit)} ${me.unit}`}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {history.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Not logged yet"
            body="Once you complete a few sets of this exercise, its progress chart and full log appear here."
          />
        ) : (
          <>
            <div>
              <SectionTitle>Progress</SectionTitle>
              <Card className="px-4 py-4">
                <ExerciseProgressChart data={history} unit={me.unit} />
              </Card>
            </div>

            <div>
              <SectionTitle>Log</SectionTitle>
              <div className="space-y-3">
                {history.map((h) => (
                  <Card key={h.workoutId} className="px-4 py-3">
                    <p className="text-text-3 mb-1.5 text-[12px]">
                      {formatDayLabel(new Date(h.date))}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {h.sets.map((s, i) => (
                        <span key={i} className="num text-[14px]">
                          <span className="text-text-3">
                            {s.setType === "warmup" ? "W" : i + 1}
                          </span>{" "}
                          <span className="font-semibold">
                            {s.weightKg != null
                              ? formatWeight(s.weightKg, me.unit)
                              : "—"}
                          </span>
                          <span className="text-text-3">×{s.reps ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {exercise.ownerId === me.id && (
          <DeleteExercise exerciseId={exercise.id} name={exercise.name} />
        )}
      </div>
    </div>
  );
}
