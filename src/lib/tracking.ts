/**
 * What an exercise's tracking type means to the arithmetic.
 *
 * Pure and dependency-free, like `lib/rest.ts` and `lib/rpe.ts`: server actions,
 * read queries, client components and vitest all need the same answer, and a
 * `"use client"` or `server-only` module can't be imported by all three.
 *
 * The one rule here is `assist_reps`. Those sets record the counterweight a
 * machine gave you, so the number in the weight column is help received rather
 * than load lifted — and every scoring path in this app (volume, estimated 1RM,
 * the `weight`/`volume`/`1rm` record kinds, weekly muscle volume) is a sum or a
 * maximum over `weight_kg × reps`. Feeding assistance into any of them inverts
 * it: the day you needed 45 kg of help would outrank the day you needed 20, and
 * an assisted pull-up would quietly out-volume the real one it is a scaffold
 * toward.
 *
 * So assistance is stored, shown and compared *only* against itself. It never
 * scores. Reps still do — "more reps at the same assistance" is a real result,
 * and it's the record kind that survives here.
 */

/** Exercises whose weight column is assistance, not load. */
export function isAssistedTracking(trackingType: string): boolean {
  return trackingType === "assist_reps";
}

/**
 * The load a set contributes to volume, estimated 1RM and every weight-based
 * record. Zero for assistance — see above.
 */
export function scoringLoadKg(
  trackingType: string,
  weightKg: number | null,
): number {
  return isAssistedTracking(trackingType) ? 0 : (weightKg ?? 0);
}

/**
 * The same rule as SQL, for the aggregates that can't come through
 * `scoringLoadKg` because they never leave Postgres.
 *
 * Written as a string rather than a drizzle `sql` fragment so it can be dropped
 * into `db.execute` template literals without turning a static query into a
 * parameterised one; `exerciseAlias` is a table alias this module chooses, never
 * user input.
 */
export function scoringLoadSql(exerciseAlias: string, setAlias: string) {
  return `CASE WHEN ${exerciseAlias}.tracking_type = 'assist_reps' THEN 0
               ELSE COALESCE(${setAlias}.weight_kg, 0) END`;
}
