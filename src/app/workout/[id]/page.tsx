import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getFullWorkout } from "@/lib/queries/workout";
import { getCurrent1rmRecords } from "@/lib/queries/exercise";
import { getMuscleVolume } from "@/lib/queries/stats";
import { getCoopSnapshot } from "@/lib/actions/coop";
import { WorkoutScreen } from "@/components/workout/workout-screen";
import { uploadsEnabled } from "@/lib/blob";

export default async function WorkoutPage(props: PageProps<"/workout/[id]">) {
  const { id } = await props.params;
  const me = await requireUser();

  const workout = await getFullWorkout(id);
  if (!workout || workout.userId !== me.id) notFound();
  // Finished workouts are read-only; send them to the history view.
  if (workout.endedAt) redirect(`/history/${workout.id}`);

  // Three reads in parallel rather than in sequence: on a scale-to-zero
  // database the round-trips, not the queries, are what this page waits on.
  const [current1rm, muscleWeek, coop] = await Promise.all([
    getCurrent1rmRecords(
      me.id,
      workout.exercises.map((e) => e.exerciseId),
    ),
    getMuscleVolume(me.id, 7),
    // Only in a co-op session, and `getCoopSnapshot` checks membership itself.
    workout.coopSessionId ? getCoopSnapshot(workout.coopSessionId) : null,
  ]);

  return (
    <WorkoutScreen
      workout={workout}
      unit={me.unit}
      currentUserId={me.id}
      defaultRestSeconds={me.defaultRestSeconds}
      current1rm={current1rm}
      // Sets per muscle over the last 7 days, from *finished* workouts only —
      // the sets logged in this session are added live on the client.
      muscleWeekSets={Object.fromEntries(
        muscleWeek.map((m) => [m.muscle, m.sets]),
      )}
      coop={coop}
      uploadsEnabled={uploadsEnabled()}
    />
  );
}
