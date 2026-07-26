import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getFullWorkout } from "@/lib/queries/workout";
import { getCurrent1rmRecords } from "@/lib/queries/exercise";
import { WorkoutScreen } from "@/components/workout/workout-screen";
import { uploadsEnabled } from "@/lib/blob";

export default async function WorkoutPage(props: PageProps<"/workout/[id]">) {
  const { id } = await props.params;
  const me = await requireUser();

  const workout = await getFullWorkout(id);
  if (!workout || workout.userId !== me.id) notFound();
  // Finished workouts are read-only; send them to the history view.
  if (workout.endedAt) redirect(`/history/${workout.id}`);

  const current1rm = await getCurrent1rmRecords(
    me.id,
    workout.exercises.map((e) => e.exerciseId),
  );

  return (
    <WorkoutScreen
      workout={workout}
      unit={me.unit}
      defaultRestSeconds={me.defaultRestSeconds}
      current1rm={current1rm}
      uploadsEnabled={uploadsEnabled()}
    />
  );
}
