/**
 * How commonly each built-in movement is actually trained, most popular first.
 *
 * This is the default order of every exercise picker. Alphabetical order put
 * "Ab Wheel Rollout" above "Bench Press (Barbell)", which is the wrong first
 * screen for a gym app: the list should open on the lifts almost everyone does
 * and search for "bench" should lead with the barbell bench press rather than
 * whichever variant sorts first.
 *
 * **One global ranking, not one per muscle group.** A dumbbell curl outranks a
 * belt squat outright — the picker is a single list, and interleaving by
 * category would only reproduce the alphabetical problem inside each region.
 *
 * The order is authored from public signals, cross-checked rather than taken
 * from any single source:
 *   - lift-submission counts on strength-standard sites (StrengthLevel et al),
 *     which is the closest thing to a census of what people log;
 *   - relative search interest for the exercise names;
 *   - how often the movement appears in mainstream programmes and in the
 *     default templates of the established logging apps.
 * It is a judgement call at the margins and is meant to be edited — moving a
 * slug up or down here is the whole change, and the next deploy's seed applies
 * it.
 *
 * Slugs, never names: this has to survive a rename, exactly like
 * `alternatives` and `legacy-slugs.ts`. Anything absent scores 0 and sorts
 * alphabetically after everything listed, so the tail needs no maintenance.
 * `tests/seed-data.test.ts` asserts every entry resolves and none repeats.
 */
export const POPULAR_SLUGS: string[] = [
  /* The barbell lifts and the machine staples that anchor nearly every
     programme — the rows that should be on screen when the sheet opens. */
  "bench-press-barbell",
  "squat-barbell",
  "deadlift-barbell",
  "lat-pulldown-cable",
  "bench-press-dumbbell",
  "overhead-press-barbell",
  "leg-press",
  "bicep-curl-dumbbell",
  "incline-bench-press-barbell",
  "lateral-raise-dumbbell",
  "pull-up",
  "bent-over-row-barbell",
  "romanian-deadlift-barbell",
  "leg-extension",
  "seated-row-cable",
  "tricep-pushdown-cable",
  "incline-bench-press-dumbbell",
  "leg-curl-lying",
  "push-up",
  "hip-thrust-barbell",

  /* Second tier: still everyday choices, just behind the ones above. */
  "overhead-press-dumbbell",
  "single-arm-row-dumbbell",
  "chest-press-machine",
  "hammer-curl-dumbbell",
  "leg-curl-seated",
  "dip-triceps",
  "front-squat-barbell",
  "bicep-curl-barbell",
  "calf-raise-standing",
  "face-pull",
  "cable-fly",
  "plank",
  "chin-up",
  "shoulder-press-machine",
  "bulgarian-split-squat",
  "seated-overhead-press-dumbbell",
  "tricep-pushdown-rope",
  "skull-crusher-barbell",
  "goblet-squat",
  "shrug-barbell",
  "pec-deck",
  "seated-row-machine",
  "lunge-dumbbell",
  "t-bar-row",
  "hack-squat",
  "close-grip-bench-press",
  "chest-fly-dumbbell",
  "lat-pulldown-underhand",
  "rear-delt-fly-dumbbell",
  "arnold-press",

  /* Common accessories and the cardio machines people actually log. */
  "preacher-curl",
  "cable-curl",
  "bicep-curl-ez-bar",
  "bent-over-row-dumbbell",
  "calf-raise-seated",
  "overhead-tricep-extension-dumbbell",
  "overhead-tricep-extension-cable",
  "lateral-raise-cable",
  "crunch",
  "hanging-leg-raise",
  "sit-up",
  "cable-crunch",
  "russian-twist",
  "treadmill-run",
  "rowing-machine",
  "cycling",
  "kettlebell-swing",
  "trap-bar-deadlift",
  "squat-smith-machine",
  "chest-press-smith",
  "incline-chest-press-machine",
  "chest-supported-row-machine",
  "chest-supported-row-dumbbell",
  "incline-fly-dumbbell",
  "seated-overhead-press-barbell",
  "front-raise-dumbbell",
  "upright-row-barbell",
  "romanian-deadlift-dumbbell",
  "stiff-leg-deadlift",
  "good-morning",
  "back-extension",
  "glute-bridge",
  "cable-pull-through",
  "hip-abduction-machine",
  "hip-adduction-machine",
  "cable-kickback",
  "reverse-lunge",
  "walking-lunge",
  "step-up",
  "split-squat",
  "dip-chest",
  "dip-weighted",
  "pull-up-weighted",
  "assisted-pull-up-machine",
  "assisted-chin-up-machine",
  "inverted-row",
  "straight-arm-pulldown",
  "pendlay-row",
  "rack-pull",
  "push-press",
  "power-clean",
  "thruster",
  "burpee",
  "mountain-climbers",
  "jump-rope",
  "box-jump",
  "farmers-walk",

  /* Reached for regularly, but by a narrower crowd. */
  "skull-crusher-dumbbell",
  "tricep-kickback",
  "bench-dip",
  "dip-machine",
  "close-grip-push-up",
  "tricep-extension-machine",
  "rope-hammer-curl",
  "incline-curl-dumbbell",
  "concentration-curl",
  "spider-curl",
  "reverse-curl",
  "lateral-raise-machine",
  "rear-delt-fly-machine",
  "rear-delt-fly-cable",
  "band-pull-apart",
  "shrug-dumbbell",
  "cable-shrug",
  "neutral-grip-pull-up",
  "lat-pulldown-neutral",
  "single-arm-lat-pulldown",
  "single-arm-cable-row",
  "dumbbell-pullover",
  "decline-bench-press-barbell",
  "floor-press-dumbbell",
  "high-to-low-cable-fly",
  "low-to-high-cable-fly",
  "incline-push-up",
  "decline-push-up",
  "push-up-weighted",
  "inverted-row-weighted",
  "back-extension-weighted",
  "side-plank",
  "dead-bug",
  "ab-wheel-rollout",
  "reverse-crunch",
  "decline-sit-up",
  "decline-sit-up-weighted",
  "hanging-leg-raise-weighted",
  "machine-crunch",
  "pallof-press",
  "woodchopper-cable",
  "hollow-body-hold",
  "toes-to-bar",
  "dead-hang",
  "wrist-curl",
  "single-leg-romanian-deadlift",
  "single-leg-hip-thrust",
  "single-leg-glute-bridge",
  "band-lateral-walk",
  "calf-press-leg-press",
  "single-leg-calf-raise",
  "nordic-curl",
  "glute-ham-raise",
  "pistol-squat",
  "jump-squat",
  "box-squat",
  "pause-squat",
  "belt-squat",
  "pendulum-squat",
  "landmine-press-shoulder",
  "pike-push-up",
  "handstand-push-up",
  "chin-up-weighted",
  "meadows-row",
  "seal-row",
  "chest-supported-t-bar-row",
  "clean-and-jerk",
  "hang-clean",
  "snatch",
  "turkish-get-up",
  "wall-ball",
  "medicine-ball-slam",
  "sled-push",
  "battle-ropes",
  "stair-climber",
  "elliptical",
  "assault-bike",
  "treadmill-incline-walk",
  "swimming",
];

/**
 * Score for the seed to write. Descending from the length of the list so the
 * order above reads top-down, and everything unlisted keeps the column
 * default of 0.
 */
export function popularityOf(slug: string, index = POPULAR_SLUGS.indexOf(slug)) {
  return index < 0 ? 0 : POPULAR_SLUGS.length - index;
}
