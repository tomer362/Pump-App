import type { Equipment, Muscle, TrackingType } from "../schema";

export type SeedAlternative = {
  /** Must resolve to another entry's `slug`. Asserted in tests/seed-data.test.ts. */
  slug: string;
  /**
   * How the muscle effect differs, written from *this* exercise's point of
   * view ("compared with this one, that one …"). Pairs that should read both
   * ways are authored twice, with two different sentences.
   */
  note: string;
};

export type SeedExercise = {
  /**
   * Stable forever. Renaming `name` must not change this — the slug is the
   * upsert key and the reference key for alternatives, and a rename that
   * changed it would orphan every deployed row.
   */
  slug: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles?: Muscle[];
  equipment: Equipment;
  trackingType?: TrackingType;
  /** Execution cues. Rendered under "How to do it". */
  instructions?: string;
  /**
   * Rendered under "What it trains". Exactly three `\n\n`-separated
   * paragraphs, 400–1200 characters, enforced by test:
   *   1. the joint action — what moves, around what, against what,
   *   2. which tissue does the work and why,
   *   3. which quality it builds and where it belongs in a programme.
   */
  bodyEffect?: string;
  /**
   * 11-character YouTube video id, not a URL. Curated only where we are
   * confident in the video; everything else falls back to a labelled search
   * (see lib/exercise-video.ts) rather than shipping a link that can rot.
   */
  videoId?: string;
  alternatives?: SeedAlternative[];
};

export type SeedAchievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: number;
};
