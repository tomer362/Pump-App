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

/** The shape of a set that counting cares about. */
export type ScorableSet = {
  setType: string;
  weightKg: number | null;
  reps: number | null;
  completedAt: Date | null;
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
      (sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0),
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
