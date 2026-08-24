import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/ui/nav-bar";
import { Skeleton, SkeletonSegmented } from "@/components/ui/skeleton";
import { ExerciseDetailTabs } from "@/components/exercise/exercise-detail-tabs";
import type { ExerciseDetailData } from "@/components/exercise/exercise-detail-tabs";
import { QuickLogDock } from "@/components/exercise/quick-log-dock";
import { ManageExercise } from "./manage-exercise";
import { ExerciseStateStrips } from "@/components/exercise/exercise-state-strips";
import { requireUser } from "@/lib/session";
import {
  getExercise,
  getExerciseAlternatives,
  getExerciseHistory,
  getExerciseRecords,
  getExerciseRepMaxes,
  getExerciseSessionSeries,
  getExerciseSummary,
  getLastLoggedSet,
} from "@/lib/queries/exercise";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
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
        // Edit and archive ride in the sticky bar, so they are reachable at
        // every scroll position rather than below a tab panel that can be
        // thirty history rows tall. Absent for a built-in: the seeded library
        // is read-only by construction.
        right={
          mine ? (
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
          ) : null
        }
      />

      <div className="space-y-6 px-4">
        <ExerciseStateStrips
          exerciseId={exercise.id}
          archived={archived}
          imported={imported}
        />

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
            trackingType={exercise.trackingType}
            about={{
              bodyEffect: exercise.bodyEffect,
              instructions: exercise.instructions,
              secondaryMuscles: exercise.secondaryMuscles,
              video: exerciseVideoLink(exercise),
            }}
          />
        </Suspense>

      </div>

      {/* No dock on an archived exercise — it is hidden from every picker, so
          offering to log against it would contradict that. */}
      {!archived && (
        <Suspense fallback={null}>
          <QuickLogDockPanel
            userId={me.id}
            unit={me.unit}
            exerciseId={exercise.id}
            exerciseName={exercise.name}
            trackingType={exercise.trackingType}
          />
        </Suspense>
      )}
    </div>
  );
}

/**
 * The docked control streams in behind its two cheap indexed lookups rather
 * than holding up the page — it is chrome, and the numbers above it are what
 * the user came for.
 */
async function QuickLogDockPanel({
  userId,
  unit,
  exerciseId,
  exerciseName,
  trackingType,
}: {
  userId: string;
  unit: "kg" | "lb";
  exerciseId: string;
  exerciseName: string;
  trackingType: string;
}) {
  const [last, active] = await Promise.all([
    getLastLoggedSet(userId, exerciseId),
    getActiveWorkoutSummary(userId),
  ]);

  return (
    <QuickLogDock
      exerciseId={exerciseId}
      exerciseName={exerciseName}
      trackingType={trackingType}
      unit={unit}
      prefill={last}
      activeWorkoutId={active?.id ?? null}
    />
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
  trackingType,
  about,
}: {
  userId: string;
  unit: "kg" | "lb";
  exerciseId: string;
  trackingType: string;
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
    // Rises in as the aggregates land, so streamed content reads as arriving
    // rather than popping. A CSS animation, so the reduced-motion override in
    // globals.css already covers it.
    <ExerciseDetailTabs
      className="animate-rise-in"
      unit={unit}
      data={{
        ...about,
        trackingType,
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
