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
 * Importing a file only helps someone who was handed one. The other way a
 * routine gets written is that someone plans their training with a model —
 * arguing about the split, the volume, what to do about a bad shoulder — and
 * ends up with a week of workouts sitting in a chat transcript. So this prompt
 * is a **converter**, not an author: it is pasted into that same conversation
 * and turns the plan already there into documents. It deliberately does not
 * offer to design anything, because the good version of the plan is the one the
 * person argued their way to.
 *
 * That framing is what forces the multi-document rule. A week is several
 * routines and Pump imports one document at a time, so the prompt asks for one
 * fenced block per training day — a fence is what gives ChatGPT and Claude
 * their per-block copy button, which is the whole ergonomic point when there
 * are four of them. `stripCodeFence` in `routine-transfer.ts` is the other half
 * of that decision.
 *
 * The mechanical half is unforgiving: every object in `routine-transfer.ts` is
 * `.strict()`, every nullable field is required-but-nullable rather than
 * optional, and four of the value sets are database enums. Nobody guesses that,
 * and a model that guesses produces a document the parser rejects with one
 * terse sentence.
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
  return `Take the training plan you have already given me in this conversation and convert it into routines for Pump, the gym tracker I log my workouts in. Do not design a new plan, do not change the one above, and do not ask me anything first — the plan in this chat is the input.

One document per routine
- Pump imports a routine as one JSON document, one at a time. A training week is several routines, so a four-day plan is four separate documents.
- Never merge two days into one document, and never wrap the documents in a JSON array. Either one is rejected.
- Emit one document per training day, in the order they appear in your plan, each inside its own \`\`\`json code block. Put a single short line naming the day immediately before each block — for example "Day 1 — Upper A". Nothing else: no commentary before the first block, none after the last.

Turning prose into a document
- "routine.name" is the day's own label from the plan: "Upper A", "Push", "Legs — Day 3". That is what I will see in my routine list.
- Everything about the day that isn't an exercise, a set or a target — the rationale, the progression scheme, how to warm up, when to deload — goes in that day's "routine.notes". Cues for one movement go in that exercise's "notes".
- Every set gets its own object in "sets": "3×8" is three objects, not one. Every exercise needs at least one set.
- For a rep range ("3×8–10"), write the top of the range in "targetReps" and say the range in that exercise's notes.
- If the plan gave a percentage of 1RM or an RPE instead of a weight, leave "targetWeightKg" null and put the RPE in "targetRpe". If the plan gave no weights at all, leave every "targetWeightKg" null — do not invent numbers I did not agree to.
- Days the plan describes with no exercises — rest days, "walk for 30 minutes" — get no document at all.
- Don't add exercises, sets or days that aren't in the plan, and don't quietly drop any that are. If something in the plan genuinely cannot be expressed in the format, say so in one line after the last block.

This is a complete valid document. Copy its shape exactly:

${serializeRoutineExport(PROMPT_EXAMPLE)}

Rules
- Output exactly the keys shown. Any key that isn't in the example makes the whole document invalid.
- Every key is required. Where a value doesn't apply write null — never omit the key. "secondaryMuscles" is the only key that may be left out entirely; write [] when an exercise has none.
- "format" and "formatVersion" must be exactly ${JSON.stringify(ROUTINE_FORMAT)} and ${ROUTINE_FORMAT_VERSION}. "exportedAt" is any ISO-8601 UTC timestamp.
- "slug" must be null on every exercise. Pump matches an exercise to its own library by name and creates the rest as custom exercises, so an invented slug only does harm.
- Weights are kilograms, in "targetWeightKg". There is no unit field — never write pounds.
- Fill only the targets the exercise's "trackingType" uses and null the others:
    weight_reps    targetWeightKg + targetReps
    reps           targetReps
    time           targetSeconds
    distance_time  targetDistanceM + targetSeconds
    weight_time    targetWeightKg + targetSeconds
    assist_reps    targetWeightKg + targetReps
- "assist_reps" is for machines that cancel part of your bodyweight (assisted pull-up and dip stations). Its "targetWeightKg" is the assistance the machine gives, so less is harder — Pump records it but never counts it as volume or turns it into a 1RM. Use "weight_reps" for anything you add load to.
- "setType": "warmup" for warm-up sets (Pump excludes them from volume and records), "normal" for working sets, "drop" and "failure" where they apply.
- "supersetGroup": exercises sharing a letter ("A", "B", …) are performed back to back as a superset; keep them next to each other in the list and give everything else null.
- "restSeconds" is 0–1800 or null. "targetRpe" is a half point from 6 to 10 (6, 6.5, … 10) or null — Pump snaps anything else to the nearest half point and drops anything under 6.
- "intervalWorkSeconds" and "intervalRestSeconds" are for timed interval work only; null everywhere else.
- Limits: at most 50 exercises and at most 30 sets per exercise. Routine name at most 80 characters, routine notes 1000, exercise notes 500, instructions 1000.

Allowed values — use these strings exactly, nothing else
- primaryMuscle and each of secondaryMuscles (at most 6): ${list(MUSCLES)}
- equipment: ${list(EQUIPMENT)}
- trackingType: ${list(TRACKING_TYPES)}
- setType: ${list(SET_TYPES)}

Start with the day-name line for the first routine.`;
}
