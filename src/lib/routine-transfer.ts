import { z } from "zod";
import { EQUIPMENT, MUSCLES, SET_TYPES, TRACKING_TYPES } from "@/lib/db/schema";
import type { FullRoutine } from "@/lib/queries/routine";
import { rpeInput } from "@/lib/rpe";

/**
 * The routine interchange format — what `Export file` writes and what `Import`
 * reads. Pure: no database, no session, no `server-only`, so it can be unit
 * tested and so both halves are provably the same shape.
 *
 * The document is deliberately small and deliberately id-free. Three rules
 * shape it:
 *
 * 1. **No uuids, ever.** They are per-database, so they mean nothing to the
 *    importer — and an `exercise.id` in a file is an invitation to trust it.
 *    A built-in is identified by `slug`, the one stable cross-database key
 *    (see the seed and `seed-data/legacy-slugs.ts`); a custom is identified by
 *    the definition carried inline.
 * 2. **Nothing that grants or claims anything.** No `sourceRoutineId` (a
 *    crafted file could otherwise drive `saveCount` on any routine it named),
 *    no counters, no owner, no author identity. A file has no verifiable
 *    author, so an import credits nobody.
 * 3. **Nothing the app treats as vetted.** `videoUrl` in particular: only
 *    curated ids reach that column and the UI labels those differently from a
 *    search, so accepting one from a file would let anyone dress an arbitrary
 *    URL as a demonstration. Same for `slug` on a custom, which would collide
 *    with a built-in.
 *
 * Rule 3 is only as good as the parser, which is why every object below is
 * `.strict()`: an unknown key is a rejection, not a silent drop.
 */

export const ROUTINE_FORMAT = "pump.routine";
export const ROUTINE_FORMAT_VERSION = 1;

/** Refuse before `JSON.parse` rather than after. */
export const MAX_IMPORT_BYTES = 262_144;

/**
 * Bytes, not UTF-16 code units: `.length` under-counts a non-ASCII document
 * by up to 3×, and the constant's name is a promise.
 */
export function exceedsImportBytes(raw: string) {
  // `.length` is a cheap lower bound on the byte count, so anything over it
  // is refused before the encode.
  if (raw.length > MAX_IMPORT_BYTES) return true;
  return new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES;
}

/**
 * One exercise, in a single shape for both kinds, with `slug` nullable.
 *
 * A discriminated union of builtin-by-slug vs custom-by-definition would read
 * more cleanly and be worse: it would force the importer to hard-fail on a
 * slug it cannot resolve. Carrying the definition alongside the slug means a
 * miss — a fork, a hand-edited file, a library entry retired after the export
 * — degrades to "clone it as a custom" and the routine still imports whole.
 *
 * On a slug *hit* every field here except the slug is discarded: the local
 * built-in row is the truth, so renaming a built-in stays safe.
 */
const exerciseRefSchema = z
  .object({
    slug: z.string().trim().min(1).max(120).nullable(),
    name: z.string().trim().min(1).max(80),
    primaryMuscle: z.enum(MUSCLES),
    secondaryMuscles: z.array(z.enum(MUSCLES)).max(6).default([]),
    equipment: z.enum(EQUIPMENT),
    trackingType: z.enum(TRACKING_TYPES),
    instructions: z.string().trim().max(1000).nullable(),
  })
  .strict();

// Caps match `routineInputSchema` in actions/routine.ts exactly. They have to:
// an import that parsed here and failed there would be a file the app wrote
// and then refused to read.
const setSchema = z
  .object({
    setType: z.enum(SET_TYPES),
    // Kilograms, and the key says so. There is no `unit` field on purpose —
    // one would invite writing the exporter's display preference into the
    // document and converting twice. `user.unit` never leaves the render layer.
    targetWeightKg: z.number().min(0).max(1000).nullable(),
    targetReps: z.number().int().min(0).max(1000).nullable(),
    targetSeconds: z.number().int().min(0).max(86_400).nullable(),
    targetDistanceM: z.number().min(0).max(1_000_000).nullable(),
    // Same 1–10 band as `routineInputSchema`, and snapped to the half-point
    // scale on the way in by the shared `rpeInput`.
    targetRpe: rpeInput.nullable(),
  })
  .strict();

const exerciseEntrySchema = z
  .object({
    exercise: exerciseRefSchema,
    notes: z.string().trim().max(500).nullable(),
    restSeconds: z.number().int().min(0).max(1800).nullable(),
    supersetGroup: z.string().trim().max(2).nullable(),
    intervalWorkSeconds: z.number().int().min(0).max(3600).nullable(),
    intervalRestSeconds: z.number().int().min(0).max(3600).nullable(),
    sets: z.array(setSchema).max(30),
  })
  .strict();

export const routineDocumentSchema = z
  .object({
    format: z.literal(ROUTINE_FORMAT),
    formatVersion: z.number().int().min(1),
    exportedAt: z.string().datetime(),
    routine: z
      .object({
        name: z.string().trim().min(1).max(80),
        notes: z.string().trim().max(1000).nullable(),
        exercises: z.array(exerciseEntrySchema).min(1).max(50),
      })
      .strict(),
  })
  .strict();

export type RoutineDocument = z.infer<typeof routineDocumentSchema>;
export type ExerciseRef = z.infer<typeof exerciseRefSchema>;

export function buildRoutineExport(
  r: FullRoutine,
  exportedAt: Date,
): RoutineDocument {
  return {
    format: ROUTINE_FORMAT,
    formatVersion: ROUTINE_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    routine: {
      name: r.name,
      notes: r.notes,
      exercises: r.exercises.map((e) => ({
        exercise: {
          slug: e.slug,
          name: e.name,
          primaryMuscle: e.primaryMuscle as ExerciseRef["primaryMuscle"],
          secondaryMuscles: e.secondaryMuscles,
          equipment: e.equipment as ExerciseRef["equipment"],
          trackingType: e.trackingType as ExerciseRef["trackingType"],
          instructions: e.instructions,
        },
        notes: e.notes,
        restSeconds: e.restSeconds,
        supersetGroup: e.supersetGroup,
        intervalWorkSeconds: e.intervalWorkSeconds,
        intervalRestSeconds: e.intervalRestSeconds,
        sets: e.sets.map((s) => ({
          setType: s.setType,
          targetWeightKg: s.targetWeightKg,
          targetReps: s.targetReps,
          targetSeconds: s.targetSeconds,
          targetDistanceM: s.targetDistanceM,
          targetRpe: s.targetRpe,
        })),
      })),
    },
  };
}

/** Pretty-printed on purpose — a routine file is something people open. */
export function serializeRoutineExport(doc: RoutineDocument): string {
  return JSON.stringify(doc, null, 2);
}

export type ParseResult =
  | { ok: true; doc: RoutineDocument }
  | { ok: false; error: string };

/** A ```-fenced block, closing fence on its own line, info string ignored. */
const FENCED_BLOCK = /^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;

/**
 * The fenced blocks in a chat reply, in order.
 *
 * `routine-prompt.ts` asks a model for one \`\`\`json block per training day,
 * because that is what puts a copy button on each one. What lands on the
 * clipboard afterwards depends on how it was copied: the button gives the bare
 * document, a hand-selection gives the fence and usually the "Day 1 — Upper A"
 * line above it, and an impatient person gives the entire reply. All three are
 * reasonable things to do, so the parser reads all three.
 *
 * Only the fences are recognised. No stripping of a label line, no scanning
 * prose for the first `{`: a parser that guesses is a parser that eventually
 * imports the wrong half of something.
 */
export function stripCodeFence(raw: string): {
  json: string;
  blocks: number;
} {
  const found = [...raw.matchAll(FENCED_BLOCK)];
  return {
    json: (found[0]?.[1] ?? raw).trim(),
    blocks: found.length,
  };
}

/**
 * Every rejection here is a sentence someone can act on. A zod issue dump is
 * the wrong thing to show a person who just picked the wrong file in Files.
 */
export function parseRoutineExport(raw: string): ParseResult {
  if (exceedsImportBytes(raw)) {
    return { ok: false, error: "That file is too large to be a routine" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Only now consider fences. Trying JSON first means a real export file is
    // never reinterpreted — a routine whose notes happen to contain ``` parses
    // as itself and never reaches this branch.
    const fenced = stripCodeFence(raw);
    if (fenced.blocks > 1) {
      return {
        ok: false,
        error: "That's several routines — paste them one at a time",
      };
    }
    if (fenced.blocks === 0) {
      return { ok: false, error: "That file isn't valid JSON" };
    }
    try {
      json = JSON.parse(fenced.json);
    } catch {
      return { ok: false, error: "That file isn't valid JSON" };
    }
  }

  // Check the discriminator before the schema so the common mistake — picking
  // some other .json off the phone — gets told what happened rather than
  // being handed a complaint about a missing key.
  if (
    typeof json !== "object" ||
    json === null ||
    (json as { format?: unknown }).format !== ROUTINE_FORMAT
  ) {
    return { ok: false, error: "That isn't a Pump routine file" };
  }

  const version = (json as { formatVersion?: unknown }).formatVersion;
  if (typeof version === "number" && version > ROUTINE_FORMAT_VERSION) {
    return {
      ok: false,
      error: "That file was made by a newer version of Pump",
    };
  }

  const parsed = routineDocumentSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    return {
      ok: false,
      error: path
        ? `That routine file is malformed (${path})`
        : "That routine file is malformed",
    };
  }

  return { ok: true, doc: parsed.data };
}

/** `pump-push-a-2026-08-02.json` */
export function exportFilename(routineName: string, on: Date): string {
  const slug =
    routineName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "routine";
  return `pump-${slug}-${on.toISOString().slice(0, 10)}.json`;
}
