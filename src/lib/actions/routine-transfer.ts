"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { routine } from "@/lib/db/schema";
import { getFullRoutine } from "@/lib/queries/routine";
import {
  buildRoutineExport,
  exportFilename,
  parseRoutineExport,
  serializeRoutineExport,
  exceedsImportBytes,
  type RoutineDocument,
} from "@/lib/routine-transfer";
import {
  nextUnfiledPosition,
  resolveExercisesForUser,
  writeRoutineChildren,
  type ExerciseResolveRef,
  type Resolution,
  type Tx,
} from "@/lib/routine-write";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

/**
 * Routine export and import as a JSON file.
 *
 * A file, rather than a share code or a link, because it works without both
 * people being on the same deployment and without either of them being signed
 * in to see it. The format itself lives in `lib/routine-transfer.ts` — pure and
 * unit-tested, no session and no database — so what remains here is
 * authorisation, rate limiting and the writes.
 */

/**
 * Who may export is exactly who may already read: the owner, or anyone at all
 * if the routine is public. Same predicate as `copyRoutine`. Refusing to export
 * a public routine would be theatre — its detail page renders every set and a
 * single tap already copies it.
 */
export async function exportRoutineFile(
  routineId: string,
): Promise<ActionResult<{ filename: string; json: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsedId = z.string().uuid().safeParse(routineId);
  if (!parsedId.success) return { ok: false, error: "Routine not found" };

  // This action returns a routine's entire contents as a string, so it is the
  // one surface here worth a limit on its own: unguarded it is a Discover
  // scraper that costs one serialisation per call.
  const limited = await rateLimit(me.id, "routine_export", {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const full = await getFullRoutine(parsedId.data);
  if (!full) return { ok: false, error: "Routine not found" };
  if (full.userId !== me.id && !full.isPublic) {
    return { ok: false, error: "That routine is private" };
  }

  const now = new Date();
  const doc = buildRoutineExport(full, now);
  return {
    ok: true,
    data: {
      filename: exportFilename(full.name, now),
      json: serializeRoutineExport(doc),
    },
  };
}

export type ImportPreview = {
  name: string;
  notes: string | null;
  exerciseCount: number;
  setCount: number;
  newCustomCount: number;
  exercises: {
    name: string;
    primaryMuscle: string;
    equipment: string;
    sets: number;
    resolution: Resolution;
  }[];
};

function toRefs(doc: RoutineDocument): ExerciseResolveRef[] {
  return doc.routine.exercises.map((e) => ({
    slug: e.exercise.slug,
    name: e.exercise.name,
    primaryMuscle: e.exercise.primaryMuscle,
    secondaryMuscles: e.exercise.secondaryMuscles,
    equipment: e.exercise.equipment,
    trackingType: e.exercise.trackingType,
    instructions: e.exercise.instructions,
    // A file import has no in-database source to point at. That is by design:
    // the format carries no ids at all.
    sourceExerciseId: null,
  }));
}

/**
 * What importing this file would do, before it does it.
 *
 * Worth its round trip: an import writes rows into a library that can only be
 * archived, never deleted, so "this creates 2 new exercises" is something a
 * person should get to read first.
 *
 * The result is never a token the client hands back to `importRoutine` — that
 * would be a channel for editing the resolved ids. `importRoutine` re-parses
 * and re-resolves the same raw string from scratch.
 */
export async function previewRoutineImport(
  json: string,
): Promise<ActionResult<ImportPreview>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  if (typeof json !== "string" || exceedsImportBytes(json)) {
    return { ok: false, error: "That file is too large to be a routine" };
  }

  const limited = await rateLimit(me.id, "routine_import_preview", {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const parsed = parseRoutineExport(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const doc = parsed.doc;

  // The same resolver the import runs, in dry-run: it reads, decides, and
  // writes nothing. Sharing the code is the point — a preview that computes
  // "creates 2 new exercises" any other way is one that will eventually lie.
  // No transaction: a dry run writes nothing, so holding one open per preview
  // bought nothing but a lock.
  const resolved = await resolveExercisesForUser(db, me.id, toRefs(doc), {
    dryRun: true,
  });

  const exercises = doc.routine.exercises.map((e, i) => ({
    name: e.exercise.name,
    primaryMuscle: e.exercise.primaryMuscle,
    equipment: e.exercise.equipment,
    sets: e.sets.length,
    resolution: resolved[i].resolution,
  }));

  return {
    ok: true,
    data: {
      name: doc.routine.name,
      notes: doc.routine.notes,
      exerciseCount: exercises.length,
      setCount: exercises.reduce((n, e) => n + e.sets, 0),
      newCustomCount: exercises.filter((e) => e.resolution === "new").length,
      exercises,
    },
  };
}

export async function importRoutine(
  json: string,
): Promise<ActionResult<{ routineId: string; created: number }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  if (typeof json !== "string" || exceedsImportBytes(json)) {
    return { ok: false, error: "That file is too large to be a routine" };
  }

  // Each import can mint up to 50 library rows, and the deployment target is a
  // 0.5 GB Neon Free database.
  const limited = await rateLimit(me.id, "routine_import", {
    limit: 20,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const parsed = parseRoutineExport(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const doc = parsed.doc;

  const result = await db.transaction(async (tx: Tx) => {
    const [created] = await tx
      .insert(routine)
      .values({
        userId: me.id,
        name: doc.routine.name,
        notes: doc.routine.notes,
        // Imports land unfiled and private. An import is not a publication,
        // and the file's author has no say over where it sits in your list.
        folderId: null,
        position: nextUnfiledPosition(me.id),
        isPublic: false,
        // Never set from a file. A document has no verifiable author, so
        // honouring a source id from one would be an unbounded way to drive
        // `saveCount` on any routine it happened to name.
        sourceRoutineId: null,
      })
      .returning({ id: routine.id });

    const resolved = await resolveExercisesForUser(tx, me.id, toRefs(doc));

    await writeRoutineChildren(
      tx,
      created.id,
      doc.routine.exercises.map((e, i) => ({
        exerciseId: resolved[i].exerciseId,
        notes: e.notes,
        restSeconds: e.restSeconds,
        supersetGroup: e.supersetGroup,
        intervalWorkSeconds: e.intervalWorkSeconds,
        intervalRestSeconds: e.intervalRestSeconds,
        sets: e.sets,
      })),
    );

    return {
      routineId: created.id,
      created: resolved.filter((r) => r.resolution === "new").length,
    };
  });

  revalidatePath("/routines");
  revalidatePath("/exercises");
  return { ok: true, data: result };
}
