import type { TrackingType } from "@/lib/db/schema";
import { documentRules, PROMPT_EXAMPLE } from "@/lib/routine-prompt";
import {
  MAX_UPDATE_ROUTINES,
  ROUTINE_UPDATE_FORMAT,
  ROUTINE_UPDATE_FORMAT_VERSION,
  type RoutineBody,
  type RoutineUpdateDocument,
} from "@/lib/routine-transfer";

/**
 * The prompt behind "Update routines with AI" on the import sheet.
 *
 * `routine-prompt.ts` turns a plan into *new* routines, which is the wrong tool
 * the second time round: somebody who has been training a week for a month and
 * talks a change through with a model ("swap the flyes for dips, add a set to
 * squats") would re-import the whole week and end up with two of everything —
 * two "Upper A"s in the list, and, because a model writes exercise names from
 * memory, a custom "Barbell Bench Press" beside the built-in "Bench Press
 * (Barbell)".
 *
 * So this prompt carries the routines themselves, exactly as Pump holds them,
 * and asks for them back edited. Two things make the round trip land on the
 * same rows rather than beside them, and the prompt says both loudly because a
 * model's instinct is to tidy names up:
 *
 * - **The routine name is the key.** `applyRoutineUpdate` finds each routine by
 *   its exact name among yours; any other spelling is a new routine.
 * - **Exercises come from the library list, name and slug verbatim.** A slug is
 *   what binds a built-in, and the list is the only honest source of one. The
 *   resolver also binds a built-in by exact name as a fallback, but the prompt
 *   does not lean on it.
 *
 * The routines go in *as an update document*, so the example of the shape is
 * the real thing rather than an invented "Upper A" — whose slug-less bench
 * press would contradict the one rule that matters here.
 *
 * Pure, like its sibling: the caller loads the routines and the library.
 */

export type LibraryEntry = {
  slug: string | null;
  name: string;
  trackingType: TrackingType | string;
};

const SLUG_FROM_LIBRARY_RULE = `- "slug" and "name" of every exercise are copied exactly from the exercise library below — same spelling, same capitals, same punctuation. A custom exercise (listed with slug null) keeps slug null. Only when nothing in the library fits may you write a new exercise: slug null, a plain descriptive name, and a one-line note after the block saying you added it.`;

/** `slug · name · trackingType`, one per line. The slug-less rows are mine. */
function libraryLines(library: LibraryEntry[]) {
  return library
    .map((e) => `${e.slug ?? "null"} · ${e.name} · ${e.trackingType}`)
    .join("\n");
}

export function buildRoutineUpdatePrompt({
  routines,
  library,
}: {
  routines: RoutineBody[];
  library: LibraryEntry[];
}): string {
  const current: RoutineUpdateDocument = {
    format: ROUTINE_UPDATE_FORMAT,
    formatVersion: ROUTINE_UPDATE_FORMAT_VERSION,
    exportedAt: PROMPT_EXAMPLE.exportedAt,
    routines,
  };
  const names = routines.map((r) => `- ${JSON.stringify(r.name)}`).join("\n");

  return `Below are routines I already have in Pump, the gym tracker I log my workouts in. Apply the changes we have agreed in this conversation to them and give them back to me as one update document. Do not redesign anything we haven't discussed, and do not ask me anything first.

The routines, exactly as Pump holds them now
${names}

${JSON.stringify(current, null, 2)}

IMPORTANT — use the exact names, or I will get duplicates
- Pump finds each routine by its "routine.name". Copy the name of a routine you are changing character for character from the list above — same capitals, same spaces, same punctuation, no "(updated)" or "v2". Any other spelling creates a second routine next to the old one.
- Only use a new name for a routine that should be added as a new day. There is no way to rename or delete a routine through this document; if the plan needs that, say so in one line after the block.
- Every exercise must come from the exercise library at the end of this message, with its "name" and "slug" copied exactly. Do not rephrase an exercise name: if the library says "Bench Press (Barbell)", write exactly that, never "Barbell Bench Press". A rephrased name becomes a duplicate custom exercise.

What to output
- Exactly one \`\`\`json code block containing one document whose "routines" array holds every routine that changes — nothing before the block, and after it at most a few one-line notes about anything the format could not express.
- Leave routines that don't change out of the array entirely. At most ${MAX_UPDATE_ROUTINES} routines.
- Each routine you include is written out in full, as it should be after the change: Pump replaces the whole routine with what you send. Copy every exercise and set that stays the same verbatim, including notes, rest and targets — anything you leave out is removed from my routine.
- Every set is its own object in "sets": "3×8" is three objects. Every exercise needs at least one set. Don't invent weights I haven't agreed to — leave "targetWeightKg" as it was, or null.

The document above is already a complete, valid update — the one that would change nothing. Your answer has exactly its shape: edit it, and drop the routines that stay as they are.

${documentRules({
  format: ROUTINE_UPDATE_FORMAT,
  formatVersion: ROUTINE_UPDATE_FORMAT_VERSION,
  slugRule: SLUG_FROM_LIBRARY_RULE,
})}

Exercise library — slug · name · trackingType (use these names and slugs exactly)
${libraryLines(library)}

Start with the code block.`;
}
