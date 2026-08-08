import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Archive } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Skeleton, SkeletonSegmented } from "@/components/ui/skeleton";
import { ExerciseDetailTabs } from "@/components/exercise/exercise-detail-tabs";
import type { ExerciseDetailData } from "@/components/exercise/exercise-detail-tabs";
import { ManageExercise } from "./manage-exercise";
import { AdoptImported } from "./adopt-imported";
import { requireUser } from "@/lib/session";
import {
  getExercise,
  getExerciseAlternatives,
  getExerciseHistory,
  getExerciseRecords,
  getExerciseRepMaxes,
  getExerciseSessionSeries,
  getExerciseSummary,
} from "@/lib/queries/exercise";
import { exerciseVideoLink } from "@/lib/exercise-video";
import { labelize } from "@/lib/utils";

export default async function ExerciseDetailPage(
  props: PageProps<"/exercises/[id]">,
) {
  const { id } = await props.params;
  const me = await requireUser();

  const exercise = await getExercise(id);
  if (!exercise) notFound();
  // Custom exercises belong to one user.
  if (exercise.ownerId && exercise.ownerId !== me.id) notFound();

  const mine = exercise.ownerId === me.id;
  const archived = exercise.archivedAt != null;
  // Archived says the same thing more strongly, so only one strip shows.
  const imported = mine && !archived && exercise.importedAt != null;

  return (
    <div className="pb-8">
      <NavBar
        title={exercise.name}
        back
        subtitle={`${labelize(exercise.primaryMuscle)} · ${labelize(exercise.equipment)}`}
      />

      <div className="space-y-6 px-4">
        {archived && (
          <div className="bg-surface-2 text-text-2 flex items-start gap-2.5 rounded-[var(--radius-card)] px-4 py-3 text-[13px] leading-relaxed">
            <Archive className="mt-0.5 size-4 shrink-0" />
            <p>
              Archived — hidden from search and the exercise picker. Everything
              below is still yours.
            </p>
          </div>
        )}

        {imported && <AdoptImported exerciseId={exercise.id} />}

        {/* Only the exercise row blocks — it names the page and decides the
            404. The six history/records aggregates stream in behind it, which
            on a cold Neon is most of this route's time to first paint. One
            boundary, not six: the tabs pick their initial tab from `summary`,
            so a half-populated panel would flip tabs under the user. */}
        <Suspense fallback={<DetailFallback />}>
          <DetailPanels
            userId={me.id}
            unit={me.unit}
            exerciseId={exercise.id}
            about={{
              bodyEffect: exercise.bodyEffect,
              instructions: exercise.instructions,
              secondaryMuscles: exercise.secondaryMuscles,
              video: exerciseVideoLink(exercise),
            }}
          />
        </Suspense>

        {mine && (
          <ManageExercise
            exerciseId={exercise.id}
            name={exercise.name}
            archived={archived}
            initial={{
              name: exercise.name,
              primaryMuscle: exercise.primaryMuscle,
              secondaryMuscles: exercise.secondaryMuscles,
              equipment: exercise.equipment,
              trackingType: exercise.trackingType,
              instructions: exercise.instructions ?? "",
            }}
          />
        )}
      </div>
    </div>
  );
}

function DetailFallback() {
  return (
    <div className="space-y-5">
      <SkeletonSegmented />
      <Skeleton className="h-40 rounded-[12px]" />
      <Skeleton className="h-24 rounded-[12px]" />
    </div>
  );
}

async function DetailPanels({
  userId,
  unit,
  exerciseId,
  about,
}: {
  userId: string;
  unit: "kg" | "lb";
  exerciseId: string;
  about: Pick<
    ExerciseDetailData,
    "bodyEffect" | "instructions" | "secondaryMuscles" | "video"
  >;
}) {
  const [history, records, alternatives, series, repMaxes, summary] =
    await Promise.all([
      getExerciseHistory(userId, exerciseId, 30),
      getExerciseRecords(userId, exerciseId),
      getExerciseAlternatives(exerciseId),
      getExerciseSessionSeries(userId, exerciseId),
      getExerciseRepMaxes(userId, exerciseId),
      getExerciseSummary(userId, exerciseId),
    ]);

  return (
    <ExerciseDetailTabs
      unit={unit}
      data={{
        ...about,
        alternatives,
        summary,
        series,
        history,
        repMaxes,
        records: records.map((r) => ({
          id: r.id,
          kind: r.kind,
          value: r.value,
          weightKg: r.weightKg,
          reps: r.reps,
          achievedAt: r.achievedAt,
        })),
      }}
    />
  );
}
