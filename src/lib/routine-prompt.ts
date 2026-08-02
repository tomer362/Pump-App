import { EQUIPMENT, MUSCLES, SET_TYPES, TRACKING_TYPES } from "@/lib/db/schema";
import {
  ROUTINE_FORMAT,
  ROUTINE_FORMAT_VERSION,
  serializeRoutineExport,
  type RoutineDocument,
} from "@/lib/routine-transfer";

/**
 * The prompt behind "Copy AI prompt" on the import sheet.
 *
 * Importing a file only helps someone who was handed one. The other way to get
 * a routine in is to have a model write the document — but every object in
 * `routine-transfer.ts` is `.strict()`, every nullable field is
 * required-but-nullable rather than optional, and four of the value sets are
 * database enums. Nobody guesses that, and a model that guesses produces a file
 * the parser rejects with one terse sentence.
 *
 * So the prompt is *generated*, never transcribed: the enums come from the
 * schema and the example is a real `RoutineDocument` run through the same
 * serialiser the exporter uses. The day someone adds a muscle or a set type,
 * this text follows — and `tests/routine-prompt.test.ts` fails if the example
 * ever stops parsing.
 */

/**
 * A complete, valid document. Shown instead of described, because the shape is
 * the hard part: which keys are required, that unused targets are `null` rather
 * than absent, and what a superset pair looks like.
 */
export const PROMPT_EXAMPLE: RoutineDocument = {
  format: ROUTINE_FORMAT,
  formatVersion: ROUTINE_FORMAT_VERSION,
  exportedAt: "2026-01-01T00:00:00.000Z",
  routine: {
    name: "Upper A",
    notes: "Two hard sets per movement, leave one rep in reserve.",
    exercises: [
      {
        exercise: {
          slug: null,
          name: "Barbell Bench Press",
          primaryMuscle: "chest",
          secondaryMuscles: ["triceps", "shoulders"],
          equipment: "barbell",
          trackingType: "weight_reps",
          instructions: null,
        },
        notes: "Pause on the chest.",
        restSeconds: 180,
        supersetGroup: null,
        intervalWorkSeconds: null,
        intervalRestSeconds: null,
        sets: [
          {
            setType: "warmup",
            targetWeightKg: 40,
            targetReps: 8,
            targetSeconds: null,
            targetDistanceM: null,
            targetRpe: null,
          },
          {
            setType: "normal",
            targetWeightKg: 80,
            targetReps: 5,
            targetSeconds: null,
            targetDistanceM: null,
            targetRpe: 8,
          },
        ],
      },
      {
        exercise: {
          slug: null,
          name: "Pull-Up",
          primaryMuscle: "lats",
          secondaryMuscles: ["biceps"],
          equipment: "bodyweight",
          trackingType: "reps",
          instructions: null,
        },
        notes: null,
        restSeconds: 90,
        supersetGroup: "A",
        intervalWorkSeconds: null,
        intervalRestSeconds: null,
        sets: [
          {
            setType: "normal",
            targetWeightKg: null,
            targetReps: 8,
            targetSeconds: null,
            targetDistanceM: null,
            targetRpe: 9,
          },
        ],
      },
      {
        exercise: {
          slug: null,
          name: "Plank",
          primaryMuscle: "abs",
          secondaryMuscles: [],
          equipment: "bodyweight",
          trackingType: "time",
          instructions: null,
        },
        notes: null,
        restSeconds: 60,
        supersetGroup: "A",
        intervalWorkSeconds: null,
        intervalRestSeconds: null,
        sets: [
          {
            setType: "normal",
            targetWeightKg: null,
            targetReps: null,
            targetSeconds: 45,
            targetDistanceM: null,
            targetRpe: null,
          },
        ],
      },
    ],
  },
};

const list = (values: readonly string[]) => values.join(" | ");

export function buildRoutinePrompt(): string {
  return `You are writing a strength-training routine for Pump, a gym tracker that imports a routine as one JSON document.

Reply with the JSON document and nothing else — no explanation, no markdown code fence.

This is a complete valid document. Copy its shape exactly:

${serializeRoutineExport(PROMPT_EXAMPLE)}

Rules
- Output exactly the keys shown. Any key that isn't in the example makes the whole document invalid.
- Every key is required. Where a value doesn't apply write null — never omit the key. The one exception is "secondaryMuscles", which may be [].
- "format" and "formatVersion" must be exactly ${JSON.stringify(ROUTINE_FORMAT)} and ${ROUTINE_FORMAT_VERSION}. "exportedAt" is any ISO-8601 UTC timestamp.
- "slug" must be null on every exercise. Pump matches an exercise to its own library by name and creates the rest as custom exercises, so an invented slug only does harm.
- Weights are kilograms, in "targetWeightKg". There is no unit field — never write pounds.
- Fill only the targets the exercise's "trackingType" uses and null the others:
    weight_reps    targetWeightKg + targetReps
    reps           targetReps
    time           targetSeconds
    distance_time  targetDistanceM + targetSeconds
    weight_time    targetWeightKg + targetSeconds
- "setType": "warmup" for warm-up sets (Pump excludes them from volume and records), "normal" for working sets, "drop" and "failure" where they apply.
- "supersetGroup": exercises sharing a letter ("A", "B", …) are performed back to back as a superset; keep them next to each other in the list and give everything else null.
- "restSeconds" is 0–1800 or null. "targetRpe" is 1–10 or null.
- "intervalWorkSeconds" and "intervalRestSeconds" are for timed interval work only; null everywhere else.
- Limits: at most 50 exercises and at most 30 sets per exercise. Routine name at most 80 characters, routine notes 1000, exercise notes 500, instructions 1000.

Allowed values — use these strings exactly, nothing else
- primaryMuscle and each of secondaryMuscles (at most 6): ${list(MUSCLES)}
- equipment: ${list(EQUIPMENT)}
- trackingType: ${list(TRACKING_TYPES)}
- setType: ${list(SET_TYPES)}

The routine I want: <replace this line with your goal, how many days a week you train, the equipment you have, and anything to avoid>`;
}
