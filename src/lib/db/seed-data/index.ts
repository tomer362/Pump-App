import type { SeedExercise } from "./types";
import { CHEST } from "./exercises/chest";
import { BACK } from "./exercises/back";
import { SHOULDERS } from "./exercises/shoulders";
import { ARMS } from "./exercises/arms";
import { LEGS_QUADS } from "./exercises/legs-quads";
import { LEGS_POSTERIOR } from "./exercises/legs-posterior";
import { CORE } from "./exercises/core";
import { OLYMPIC } from "./exercises/olympic";
import { CARDIO } from "./exercises/cardio";
import { NECK_AND_REHAB } from "./exercises/neck-and-rehab";

export type {
  SeedAchievement,
  SeedAlternative,
  SeedExercise,
} from "./types";
export { SEED_ACHIEVEMENTS } from "./achievements";
export { LEGACY_NAME_TO_SLUG } from "./legacy-slugs";

/**
 * Built-in exercise library (ownerId = null). Grouped by muscle region rather
 * than by equipment, because alternatives cluster inside a region — a chest
 * press's alternatives are nearly always other chest presses — so cross-file
 * references stay rare and review stays local.
 *
 * Every entry is enriched: `bodyEffect` explains what the movement does to
 * the body, `alternatives` say how a substitute differs. `videoId` is curated
 * selectively; see lib/exercise-video.ts for why the rest fall back to search.
 *
 * The invariants that keep this maintainable — unique slugs, resolvable
 * alternative references, prose within readable bounds — are asserted in
 * tests/seed-data.test.ts, which runs without a database.
 */
export const SEED_EXERCISES: SeedExercise[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...ARMS,
  ...LEGS_QUADS,
  ...LEGS_POSTERIOR,
  ...CORE,
  ...OLYMPIC,
  ...CARDIO,
  ...NECK_AND_REHAB,
];
