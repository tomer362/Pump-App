import { notFound } from "next/navigation";
import { Archive } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { ExerciseDetailTabs } from "@/components/exercise/exercise-detail-tabs";
import { ManageExercise } from "./manage-exercise";
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

  const [history, records, alternatives, series, repMaxes, summary] =
    await Promise.all([
      getExerciseHistory(me.id, id, 30),
      getExerciseRecords(me.id, id),
      getExerciseAlternatives(id),
      getExerciseSessionSeries(me.id, id),
      getExerciseRepMaxes(me.id, id),
      getExerciseSummary(me.id, id),
    ]);

  const mine = exercise.ownerId === me.id;
  const archived = exercise.archivedAt != null;

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

        <ExerciseDetailTabs
          unit={me.unit}
          data={{
            bodyEffect: exercise.bodyEffect,
            instructions: exercise.instructions,
            secondaryMuscles: exercise.secondaryMuscles,
            video: exerciseVideoLink(exercise),
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
