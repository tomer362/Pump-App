"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { routine, routineExercise } from "@/lib/db/schema";
import {
  getFullRoutine,
  getOwnRoutineContents,
  getPromptLibrary,
} from "@/lib/queries/routine";
import { diffRoutine, isUnchanged, type RoutineDiff } from "@/lib/routine-diff";
import {
  buildRoutineExport,
  exportFilename,
  MAX_UPDATE_ROUTINES,
  parseRoutineExport,
  parseRoutineUpdate,
  routineNameKey,
  serializeRoutineExport,
  exceedsImportBytes,
  type RoutineBody,
  type RoutineDocument,
  type RoutineUpdateDocument,
} from "@/lib/routine-transfer";
import { buildRoutineUpdatePrompt } from "@/lib/routine-update-prompt";
import { isUuid } from "@/lib/uuid";
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
  return entryRefs(doc.routine);
}

function entryRefs(body: RoutineBody): ExerciseResolveRef[] {
  return body.exercises.map((e) => ({
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

/**
 * "Update routines with AI": the prompt carries the chosen routines, a model
 * edits them in a chat, and the answer comes back through the same paste box
 * as a `pump.routine-update` document. See `routine-update-prompt.ts` for the
 * prompt and `routine-transfer.ts` for the format.
 *
 * Only your own routines can be put in the prompt, and only your own routines
 * can be matched by an update — every read below is `userId = me.id`, so a
 * document naming somebody else's routine creates a routine of yours instead.
 */
export async function getRoutineUpdatePrompt(
  routineIds: string[],
): Promise<ActionResult<{ prompt: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  if (
    !Array.isArray(routineIds) ||
    routineIds.length === 0 ||
    routineIds.length > MAX_UPDATE_ROUTINES ||
    !routineIds.every((id) => typeof id === "string" && isUuid(id))
  ) {
    return {
      ok: false,
      error: `Pick between 1 and ${MAX_UPDATE_ROUTINES} routines`,
    };
  }
  const ids = [...new Set(routineIds)];

  // Same budget as export: this also returns routines in full as text.
  const limited = await rateLimit(me.id, "routine_export", {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const [contents, library] = await Promise.all([
    getOwnRoutineContents(me.id, ids),
    getPromptLibrary(me.id),
  ]);
  if (contents.length !== ids.length) {
    return { ok: false, error: "Routine not found" };
  }

  const now = new Date();
  return {
    ok: true,
    data: {
      prompt: buildRoutineUpdatePrompt({
        routines: contents.map((c) => buildRoutineExport(c, now).routine),
        library,
      }),
    },
  };
}

export type UpdatePreviewRoutine = {
  name: string;
  status: "update" | "new" | "unchanged";
  exerciseCount: number;
  setCount: number;
  /** Null for a new routine — there is nothing to compare it with. */
  diff: RoutineDiff | null;
  /** What a new routine is made of; empty for an update. */
  exercises: { name: string; sets: number; resolution: Resolution }[];
};

export type UpdatePreview = {
  routines: UpdatePreviewRoutine[];
  /** Exercises the update would add to your library, deduplicated. */
  newExercises: string[];
};

type PlannedRoutine = UpdatePreviewRoutine & {
  body: RoutineBody;
  routineId: string | null;
  exerciseIds: string[];
};

/**
 * Match every routine in the document to one of yours by name, resolve every
 * exercise, and diff. Shared by preview (`dryRun`) and apply, so the preview
 * cannot promise one thing and the write do another — the same rule as
 * `resolveExercisesForUser`'s own dry run.
 */
async function planUpdate(
  tx: Tx,
  userId: string,
  unit: "kg" | "lb",
  doc: RoutineUpdateDocument,
  dryRun: boolean,
): Promise<
  { ok: true; routines: PlannedRoutine[]; newExercises: string[] } | { ok: false; error: string }
> {
  // All of this user's routine names — tens of rows — matched in JS so the
  // comparison is exactly `routineNameKey`, not an approximation of it in SQL.
  const mine = await tx
    .select({ id: routine.id, name: routine.name })
    .from(routine)
    .where(eq(routine.userId, userId));
  const byKey = new Map<string, string[]>();
  for (const r of mine) {
    const key = routineNameKey(r.name);
    byKey.set(key, [...(byKey.get(key) ?? []), r.id]);
  }

  const targets: (string | null)[] = [];
  for (const r of doc.routines) {
    const hits = byKey.get(routineNameKey(r.name)) ?? [];
    if (hits.length > 1) {
      // Guessing which of two same-named routines was meant would overwrite
      // one of them at random.
      return {
        ok: false,
        error: `You have ${hits.length} routines named "${r.name.trim()}" — rename one first`,
      };
    }
    targets.push(hits[0] ?? null);
  }

  const matchedIds = targets.filter((t): t is string => !!t);
  const contents = new Map(
    (await getOwnRoutineContents(userId, matchedIds)).map((c) => [c.id, c]),
  );

  // One resolve across the whole document, so a custom named in two routines
  // mints one row rather than one per routine.
  const refs = doc.routines.flatMap(entryRefs);
  const resolved = await resolveExercisesForUser(tx, userId, refs, { dryRun });

  let offset = 0;
  const routines = doc.routines.map((body, i): PlannedRoutine => {
    const slice = resolved.slice(offset, offset + body.exercises.length);
    offset += body.exercises.length;
    const exerciseIds = slice.map((r) => r.exerciseId);
    const setCount = body.exercises.reduce((n, e) => n + e.sets.length, 0);
    const exercises = body.exercises.map((e, j) => ({
      name: e.exercise.name,
      sets: e.sets.length,
      resolution: slice[j].resolution,
    }));

    const routineId = targets[i];
    const current = routineId ? contents.get(routineId) : undefined;
    if (!routineId || !current) {
      return {
        name: body.name,
        status: "new",
        exerciseCount: body.exercises.length,
        setCount,
        diff: null,
        exercises,
        body,
        routineId: null,
        exerciseIds,
      };
    }

    const currentBody = buildRoutineExport(current, new Date(0)).routine;
    const diff = diffRoutine(
      {
        name: current.name,
        notes: current.notes,
        exercises: currentBody.exercises.map((entry, j) => ({
          key: current.exercises[j].exerciseId,
          entry,
        })),
      },
      {
        name: body.name,
        notes: body.notes,
        exercises: body.exercises.map((entry, j) => ({
          // A dry-run clone has no id yet; its name is the key it will mint on.
          key: exerciseIds[j] || `new:${entry.exercise.name.toLowerCase()}`,
          entry,
        })),
      },
      unit,
    );

    return {
      name: body.name,
      status: isUnchanged(diff) ? "unchanged" : "update",
      exerciseCount: body.exercises.length,
      setCount,
      diff,
      exercises: [],
      body,
      routineId,
      exerciseIds,
    };
  });

  const newExercises = [
    ...new Map(
      refs.flatMap((ref, k) =>
        resolved[k].resolution === "new"
          ? [[ref.name.toLowerCase(), ref.name] as const]
          : [],
      ),
    ).values(),
  ];

  return { ok: true, routines, newExercises };
}

export async function previewRoutineUpdate(
  json: string,
): Promise<ActionResult<UpdatePreview>> {
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

  const parsed = parseRoutineUpdate(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const plan = await planUpdate(db, me.id, me.unit, parsed.doc, true);
  if (!plan.ok) return plan;

  return {
    ok: true,
    data: {
      // The resolved ids and the parsed body stay on the server: apply
      // recomputes them from the raw text rather than trusting a round trip.
      routines: plan.routines.map((r) => ({
        name: r.name,
        status: r.status,
        exerciseCount: r.exerciseCount,
        setCount: r.setCount,
        diff: r.diff,
        exercises: r.exercises,
      })),
      newExercises: plan.newExercises,
    },
  };
}

export async function applyRoutineUpdate(
  json: string,
): Promise<
  ActionResult<{ updated: number; created: number; routineIds: string[] }>
> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  if (typeof json !== "string" || exceedsImportBytes(json)) {
    return { ok: false, error: "That file is too large to be a routine" };
  }

  // Shares the import budget: an update can mint library rows too.
  const limited = await rateLimit(me.id, "routine_import", {
    limit: 20,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  // Re-parsed and re-matched from the raw text, never from anything the
  // preview returned — the same rule `importRoutine` follows.
  const parsed = parseRoutineUpdate(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const result = await db.transaction(async (tx: Tx) => {
    const plan = await planUpdate(tx, me.id, me.unit, parsed.doc, false);
    if (!plan.ok) return plan;

    let updated = 0;
    let created = 0;
    const routineIds: string[] = [];

    for (const p of plan.routines) {
      if (p.status === "unchanged" && p.routineId) {
        routineIds.push(p.routineId);
        continue;
      }

      let routineId = p.routineId;
      if (routineId) {
        // Folder, visibility, position and provenance are the lifter's, not
        // the model's: only what the document describes is rewritten.
        await tx
          .update(routine)
          .set({
            name: p.body.name,
            notes: p.body.notes,
            updatedAt: new Date(),
          })
          .where(and(eq(routine.id, routineId), eq(routine.userId, me.id)));
        await tx
          .delete(routineExercise)
          .where(eq(routineExercise.routineId, routineId));
        updated += 1;
      } else {
        // Exactly as `importRoutine` lands one: unfiled, private, uncredited.
        const [row] = await tx
          .insert(routine)
          .values({
            userId: me.id,
            name: p.body.name,
            notes: p.body.notes,
            folderId: null,
            position: nextUnfiledPosition(me.id),
            isPublic: false,
            sourceRoutineId: null,
          })
          .returning({ id: routine.id });
        routineId = row.id;
        created += 1;
      }

      await writeRoutineChildren(
        tx,
        routineId,
        p.body.exercises.map((e, j) => ({
          exerciseId: p.exerciseIds[j],
          notes: e.notes,
          restSeconds: e.restSeconds,
          supersetGroup: e.supersetGroup,
          intervalWorkSeconds: e.intervalWorkSeconds,
          intervalRestSeconds: e.intervalRestSeconds,
          sets: e.sets,
        })),
      );
      routineIds.push(routineId);
    }

    return { ok: true as const, updated, created, routineIds };
  });

  if (!result.ok) return result;

  revalidatePath("/routines");
  for (const id of result.routineIds) revalidatePath(`/routines/${id}`);
  revalidatePath("/exercises");
  return {
    ok: true,
    data: {
      updated: result.updated,
      created: result.created,
      routineIds: result.routineIds,
    },
  };
}
