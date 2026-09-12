import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  routineExercise,
  routineSet,
  type Equipment,
  type Muscle,
  type SetType,
  type TrackingType,
} from "@/lib/db/schema";

/**
 * The write half of building a routine, shared by the editor, the file
 * importer and `copyRoutine`.
 *
 * This is not a `"use server"` module and must not become one. Every export of
 * one is a public POST endpoint, and both functions here take a transaction
 * handle as their first argument — the same reason `lib/records.ts` sits
 * outside `lib/actions/`. Authorisation belongs to the actions that call
 * these; what lives here is the SQL they agree on.
 */

type PgTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/**
 * A transaction handle — or the database itself, for a read-only dry run.
 * `resolveExercisesForUser` with `dryRun` writes nothing, and opening a
 * transaction just to satisfy the type held a lock per import preview.
 */
export type Tx = PgTx | typeof db;

export type RoutineChildInput = {
  exerciseId: string;
  notes?: string | null;
  restSeconds?: number | null;
  supersetGroup?: string | null;
  intervalWorkSeconds?: number | null;
  intervalRestSeconds?: number | null;
  sets: {
    setType: SetType;
    targetWeightKg?: number | null;
    targetReps?: number | null;
    targetSeconds?: number | null;
    targetDistanceM?: number | null;
    targetRpe?: number | null;
  }[];
};

export async function writeRoutineChildren(
  tx: Tx,
  routineId: string,
  exercises: RoutineChildInput[],
) {
  if (!exercises.length) return;

  // Two statements total rather than two per exercise. The zod cap allows 50
  // exercises, which was 100 sequential round trips inside a transaction.
  const inserted = await tx
    .insert(routineExercise)
    .values(
      exercises.map((e, i) => ({
        routineId,
        exerciseId: e.exerciseId,
        position: i,
        notes: e.notes ?? null,
        restSeconds: e.restSeconds ?? null,
        supersetGroup: e.supersetGroup ?? null,
        intervalWorkSeconds: e.intervalWorkSeconds ?? null,
        intervalRestSeconds: e.intervalRestSeconds ?? null,
      })),
    )
    .returning({ id: routineExercise.id, position: routineExercise.position });

  const byPosition = new Map(inserted.map((r) => [r.position, r.id]));

  const rows = exercises.flatMap((e, i) => {
    const reId = byPosition.get(i);
    if (!reId) return [];
    return e.sets.map((s, j) => ({
      routineExerciseId: reId,
      position: j,
      setType: s.setType,
      targetWeightKg: s.targetWeightKg ?? null,
      targetReps: s.targetReps ?? null,
      targetSeconds: s.targetSeconds ?? null,
      targetDistanceM: s.targetDistanceM ?? null,
      targetRpe: s.targetRpe ?? null,
    }));
  });

  if (rows.length) await tx.insert(routineSet).values(rows);
}

/**
 * One exercise as it arrives attached to somebody else's routine — either
 * described by a JSON document or read off the source rows by `copyRoutine`.
 */
export type ExerciseResolveRef = {
  /** Non-null identifies a built-in; null means "this is a custom". */
  slug: string | null;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  trackingType: TrackingType;
  instructions: string | null;
  /**
   * The row this came from, when the source is in this database. `copyRoutine`
   * sets it; a file import can't, because the format carries no ids.
   */
  sourceExerciseId: string | null;
};

export type Resolution = "builtin" | "existing" | "restored" | "new";

export type ResolvedExercise = {
  /** Empty string under `dryRun` — nothing was created, so there is no id. */
  exerciseId: string;
  resolution: Resolution;
};

/**
 * Bind every incoming exercise to a row **the importer owns or that is
 * built in**, cloning what isn't already theirs.
 *
 * Cloning rather than referencing is the whole contract. Pointing a routine at
 * another user's custom exercise looks like it works and then doesn't: the
 * detail page 404s, the picker can't re-add it after a removal, the builder
 * silently drops it, PRs get written against a row you don't own, and the day
 * the author deletes their account the cascade takes your logged sets with it.
 * A clone is yours, so every one of those surfaces just works.
 *
 * Resolution order, four bulk statements regardless of how many exercises
 * arrive — never one round trip per exercise:
 *
 *   1. built-in by `slug`. On a hit the embedded definition is discarded.
 *   2. a clone you already made of that exact source row (`sourceExerciseId`),
 *      so copying two of the same person's routines reuses one clone even if
 *      you have since renamed it.
 *   3. one of your own by case-insensitive name. `nameTaken` enforces
 *      name-only uniqueness per user, so a name match is unambiguous — and
 *      keying on name+equipment instead would push a same-name entry into
 *      step 4, where it would collide with that very rule. An archived match
 *      is un-archived: you are using it again.
 *   4. insert a clone.
 *
 * Returned in the same order as `refs`.
 *
 * `dryRun` answers "what would this do" without doing it — it is what the
 * import preview reads. One function rather than a read-only twin on purpose:
 * a preview that computes "creates 2 new exercises" through different code
 * than the import is a preview that will eventually lie.
 */
export async function resolveExercisesForUser(
  tx: Tx,
  userId: string,
  refs: ExerciseResolveRef[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ResolvedExercise[]> {
  const out: (ResolvedExercise | null)[] = refs.map(() => null);

  // 1. Built-ins, by the one identifier that means the same thing in every
  //    database.
  const slugs = [...new Set(refs.map((r) => r.slug).filter((s): s is string => !!s))];
  const bySlug = new Map<string, string>();
  if (slugs.length) {
    const rows = await tx
      .select({ id: exercise.id, slug: exercise.slug })
      .from(exercise)
      .where(and(isNull(exercise.ownerId), inArray(exercise.slug, slugs)));
    for (const r of rows) if (r.slug) bySlug.set(r.slug, r.id);
  }

  // 2 & 3. This user's own library. Bounded by their own custom rows — tens,
  //    not the library — so it is one small select however big the document is.
  const mine = await tx
    .select({
      id: exercise.id,
      name: exercise.name,
      archivedAt: exercise.archivedAt,
      sourceExerciseId: exercise.sourceExerciseId,
    })
    .from(exercise)
    .where(eq(exercise.ownerId, userId));

  const byName = new Map(mine.map((m) => [m.name.toLowerCase(), m]));
  const bySource = new Map(
    mine.flatMap((m) => (m.sourceExerciseId ? [[m.sourceExerciseId, m] as const] : [])),
  );

  const toRestore: string[] = [];
  const toInsert: { index: number; ref: ExerciseResolveRef }[] = [];

  refs.forEach((ref, i) => {
    if (ref.slug) {
      const builtin = bySlug.get(ref.slug);
      if (builtin) {
        out[i] = { exerciseId: builtin, resolution: "builtin" };
        return;
      }
      // A slug we don't have. `legacy-slugs.ts` is frozen so this shouldn't
      // fire in practice, but degrading to a clone keeps the routine whole
      // instead of failing the whole import over one movement.
    }

    const existing =
      (ref.sourceExerciseId ? bySource.get(ref.sourceExerciseId) : undefined) ??
      byName.get(ref.name.toLowerCase());

    if (existing) {
      if (existing.archivedAt) toRestore.push(existing.id);
      out[i] = {
        exerciseId: existing.id,
        resolution: existing.archivedAt ? "restored" : "existing",
      };
      return;
    }

    toInsert.push({ index: i, ref });
  });

  if (toRestore.length && !dryRun) {
    await tx
      .update(exercise)
      .set({ archivedAt: null })
      .where(
        and(eq(exercise.ownerId, userId), inArray(exercise.id, [...new Set(toRestore)])),
      );
  }

  if (toInsert.length) {
    // A document may name the same custom twice. Dedupe on the same key the
    // lookup above used, so it mints one row and both entries point at it.
    const fresh = new Map<string, { index: number; ref: ExerciseResolveRef }[]>();
    for (const item of toInsert) {
      const key = item.ref.name.toLowerCase();
      const list = fresh.get(key) ?? [];
      list.push(item);
      fresh.set(key, list);
    }

    if (dryRun) {
      for (const items of fresh.values()) {
        for (const item of items) {
          out[item.index] = { exerciseId: "", resolution: "new" };
        }
      }
      return out as ResolvedExercise[];
    }

    const values = [...fresh.values()].map(([{ ref }]) => ({
      name: ref.name,
      primaryMuscle: ref.primaryMuscle,
      secondaryMuscles: ref.secondaryMuscles,
      equipment: ref.equipment,
      trackingType: ref.trackingType,
      instructions: ref.instructions,
      ownerId: userId,
      sourceExerciseId: ref.sourceExerciseId,
      importedAt: new Date(),
      // slug, videoUrl and bodyEffect are deliberately absent. A settable slug
      // collides with a built-in; videoUrl is the column the UI presents as a
      // vetted demonstration; bodyEffect is seeded for built-ins only.
      // popularity takes its default 0, which tails these alphabetically.
    }));

    const inserted = await tx
      .insert(exercise)
      .values(values)
      .returning({ id: exercise.id, name: exercise.name });

    const insertedByName = new Map(inserted.map((r) => [r.name.toLowerCase(), r.id]));
    for (const [key, items] of fresh) {
      const id = insertedByName.get(key);
      if (!id) continue;
      for (const item of items) {
        out[item.index] = { exerciseId: id, resolution: "new" };
      }
    }
  }

  const missing = out.findIndex((r) => r === null);
  if (missing !== -1) {
    // Unreachable: every branch above assigns or queues an insert. Loud rather
    // than writing a routine with a hole in it.
    throw new Error(`Could not resolve exercise at position ${missing}`);
  }
  return out as ResolvedExercise[];
}

/** `MAX(position) + 1` among this user's unfiled routines. */
export function nextUnfiledPosition(userId: string) {
  return sql<number>`(
    SELECT COALESCE(MAX("position"), -1) + 1 FROM "routine" r2
    WHERE r2."user_id" = ${userId} AND r2."folder_id" IS NULL
  )`;
}
