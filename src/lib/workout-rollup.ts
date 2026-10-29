import "server-only";
import { eq } from "drizzle-orm";
import { exercise, workout, workoutExercise, workoutSet } from "@/lib/db/schema";
import type { Tx } from "@/lib/records";
import { sumSetTotals, type WorkoutTotals } from "@/lib/workout-totals";

/**
 * Rewrite a finished workout's denormalised counters from the sets it has now.
 *
 * Quick-log writes into a workout that is already ended, and the history editor
 * corrects one after the fact, so both need what `finishWorkout` does once at
 * finish — run again whenever the rows change. Not in a `"use server"` module:
 * it takes no viewer and authorises nothing, so it must not be an endpoint.
 */
export async function rollUpWorkout(
  tx: Tx,
  workoutId: string,
): Promise<WorkoutTotals> {
  const sets = await tx
    .select({
      setType: workoutSet.setType,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      completedAt: workoutSet.completedAt,
      // Volume has to know which weight columns are assistance rather than load.
      trackingType: exercise.trackingType,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(eq(workoutExercise.workoutId, workoutId));

  const totals = sumSetTotals(sets);
  await tx.update(workout).set(totals).where(eq(workout.id, workoutId));
  return totals;
}
