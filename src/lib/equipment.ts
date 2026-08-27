/**
 * What an exercise's equipment means to the UI.
 *
 * Pure and dependency-free, like `lib/tracking.ts` and `lib/rest.ts`: the
 * workout screen needs this answer at render time, and the module that owns the
 * plate calculator is behind a `dynamic()` import precisely so it isn't in the
 * first paint of the one screen that is a sweaty thumb waiting.
 */

/**
 * Whether this equipment is a bar somebody loads with plates.
 *
 * The plate calculator's whole arithmetic is `(target − bar) / 2`, so on
 * anything else it is answering a question the exercise never asked: a dumbbell
 * incline press and a dumbbell curl were both offering to work out plates for a
 * bar they don't have, and a selectorised stack has no plates at all.
 *
 * `plate` is excluded for the opposite reason — in this library it means an
 * exercise performed *holding* a plate (Plate Pinch, Svend Press, Russian
 * Twist, Plate Front Raise), not a plate-loaded machine. `machine` is excluded
 * because it covers both, and nothing on the row can tell a leg press from a
 * pulldown.
 */
export function hasLoadablePlates(equipment: string): boolean {
  return equipment === "barbell" || equipment === "smith";
}
