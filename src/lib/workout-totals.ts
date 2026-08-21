/**
 * The denormalised counters on `workout` (`totalVolumeKg`, `totalSets`,
 * `totalReps`) are what the feed, history and co-op poll read instead of
 * re-aggregating over sets. Two places now write them — `finishWorkout` and
 * quick-log — so the arithmetic lives here rather than being inlined twice and
 * drifting.
 *
 * Pure and dependency-free on purpose: no `server-only`, no database handle, so
 * vitest can assert the semantics without a connection.
 */

import { scoringLoadKg } from "@/lib/tracking";

/** The shape of a set that counting cares about. */
export type ScorableSet = {
  setType: string;
  weightKg: number | null;
  reps: number | null;
  completedAt: Date | null;
  /**
   * The tracking type of the exercise this set belongs to. Only `assist_reps`
   * changes the answer — its weight column is the machine's counterweight, so
   * counting it would make the sets you needed most help on your biggest
   * volume day. Optional because most callers already know the set is ordinary;
   * absent reads as `weight_reps`.
   */
  trackingType?: string;
};

export type WorkoutTotals = {
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
};

/**
 * A set counts only if it was ticked and isn't a warm-up. Counting warm-ups
 * inflates every downstream stat, which is why the same filter appears in every
 * read query.
 */
export function isScoring(s: ScorableSet): boolean {
  return s.completedAt != null && s.setType !== "warmup";
}

export function sumSetTotals(sets: ScorableSet[]): WorkoutTotals {
  const scoring = sets.filter(isScoring);
  return {
    totalVolumeKg: scoring.reduce(
      (sum, s) =>
        sum + scoringLoadKg(s.trackingType ?? "weight_reps", s.weightKg) * (s.reps ?? 0),
      0,
    ),
    totalSets: scoring.length,
    totalReps: scoring.reduce((sum, s) => sum + (s.reps ?? 0), 0),
  };
}

/**
 * A planned set only becomes a real one if it actually records something.
 * Promoting an empty row would write a 0×0 set into the log.
 */
export function recordsSomething(s: {
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
}): boolean {
  return (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0 || (s.distanceM ?? 0) > 0;
}
