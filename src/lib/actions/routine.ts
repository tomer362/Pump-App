"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  exercise,
  routine,
  routineExercise,
  routineFolder,
  routineSet,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import {
  nextUnfiledPosition,
  resolveExercisesForUser,
  writeRoutineChildren,
  type Tx,
} from "@/lib/routine-write";
import { getCurrentUser } from "@/lib/session";
import { notify } from "./notify";
import type { ActionResult } from "./user";

/**
 * A folder id arrives from the client like any other field, so it has to be
 * proven to belong to the caller before it is written — otherwise the routine
 * editor doubles as a way to drop rows into someone else's folder.
 */
async function ownsFolder(userId: string, folderId: string) {
  const [row] = await db
    .select({ id: routineFolder.id })
    .from(routineFolder)
    .where(and(eq(routineFolder.id, folderId), eq(routineFolder.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** Shape the routine editor posts back. The whole routine is saved at once. */
const routineInputSchema = z.object({
  name: z.string().trim().min(1, "Give the routine a name").max(80),
  notes: z.string().trim().max(1000).nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  isPublic: z.boolean().default(true),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        notes: z.string().trim().max(500).nullable().optional(),
        restSeconds: z.number().int().min(0).max(1800).nullable().optional(),
        supersetGroup: z.string().trim().max(2).nullable().optional(),
        intervalWorkSeconds: z.number().int().min(0).max(3600).nullable().optional(),
        intervalRestSeconds: z.number().int().min(0).max(3600).nullable().optional(),
        sets: z
          .array(
            z.object({
              setType: z.enum(["normal", "warmup", "drop", "failure"]),
              targetWeightKg: z.number().min(0).max(1000).nullable().optional(),
              targetReps: z.number().int().min(0).max(1000).nullable().optional(),
              targetSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
              targetDistanceM: z.number().min(0).max(1_000_000).nullable().optional(),
              targetRpe: z.number().min(1).max(10).nullable().optional(),
            }),
          )
          .max(30),
      }),
    )
    .min(1, "Add at least one exercise")
    .max(50),
});

export type RoutineInput = z.input<typeof routineInputSchema>;

export async function createRoutine(
  input: RoutineInput,
): Promise<ActionResult<{ routineId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = routineInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid routine" };
  }

  const folderId = parsed.data.folderId ?? null;
  if (folderId && !(await ownsFolder(me.id, folderId))) {
    return { ok: false, error: "Folder not found" };
  }

  const id = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(routine)
      .values({
        userId: me.id,
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        folderId,
        isPublic: parsed.data.isPublic,
        position: sql`(
          SELECT COALESCE(MAX("position"), -1) + 1 FROM "routine" r2
          WHERE r2."user_id" = ${me.id}
            AND r2."folder_id" IS NOT DISTINCT FROM ${folderId}
        )`,
      })
      .returning({ id: routine.id });

    await writeRoutineChildren(tx, r.id, parsed.data.exercises);
    return r.id;
  });

  revalidatePath("/routines");
  return { ok: true, data: { routineId: id } };
}

export async function updateRoutine(
  routineId: string,
  input: RoutineInput,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = routineInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid routine" };
  }

  const [existing] = await db
    .select({ id: routine.id, folderId: routine.folderId })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.userId, me.id)))
    .limit(1);
  if (!existing) return { ok: false, error: "Routine not found" };

  const folderId = parsed.data.folderId ?? null;
  if (folderId && !(await ownsFolder(me.id, folderId))) {
    return { ok: false, error: "Folder not found" };
  }
  const movedFolder = folderId !== existing.folderId;

  await db.transaction(async (tx) => {
    await tx
      .update(routine)
      .set({
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        folderId,
        isPublic: parsed.data.isPublic,
        // Only re-position when the routine actually changed folder; a plain
        // edit must not shuffle it to the end of a list the user ordered.
        ...(movedFolder
          ? {
              position: sql`(
                SELECT COALESCE(MAX("position"), -1) + 1 FROM "routine" r2
                WHERE r2."user_id" = ${me.id}
                  AND r2."folder_id" IS NOT DISTINCT FROM ${folderId}
              )`,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(routine.id, routineId));

    // Replace children wholesale — simpler and safe, since routines are small
    // and past workouts keep their own copies of the sets.
    await tx
      .delete(routineExercise)
      .where(eq(routineExercise.routineId, routineId));

    await writeRoutineChildren(tx, routineId, parsed.data.exercises);
  });

  revalidatePath("/routines");
  revalidatePath(`/routines/${routineId}`);
  return { ok: true };
}

/**
 * Given the exercise ids a source routine references, return the subset that
 * belong to somebody else mapped onto rows this user owns, cloning as needed.
 *
 * Built-ins and the user's own rows are absent from the map — the caller falls
 * back to the original id for those, which is already correct.
 */
async function remapForeignExercises(
  tx: Tx,
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(exerciseIds)];
  if (!ids.length) return new Map();

  const rows = await tx
    .select({
      id: exercise.id,
      ownerId: exercise.ownerId,
      slug: exercise.slug,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      secondaryMuscles: exercise.secondaryMuscles,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType,
      instructions: exercise.instructions,
    })
    .from(exercise)
    .where(inArray(exercise.id, ids));

  const foreign = rows.filter((r) => r.ownerId != null && r.ownerId !== userId);
  if (!foreign.length) return new Map();

  const resolved = await resolveExercisesForUser(
    tx,
    userId,
    foreign.map((r) => ({
      // A foreign row with a slug would be a built-in, which can't be foreign
      // — but pass it through rather than assume, so a hit resolves to the
      // shared built-in instead of minting a clone of it.
      slug: r.slug,
      name: r.name,
      primaryMuscle: r.primaryMuscle,
      secondaryMuscles: r.secondaryMuscles,
      equipment: r.equipment,
      trackingType: r.trackingType,
      instructions: r.instructions,
      sourceExerciseId: r.id,
    })),
  );

  return new Map(foreign.map((r, i) => [r.id, resolved[i].exerciseId]));
}

export async function deleteRoutine(routineId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .delete(routine)
    .where(and(eq(routine.id, routineId), eq(routine.userId, me.id)));

  revalidatePath("/routines");
  return { ok: true };
}

/**
 * Copy someone else's public routine into your own list (the spec's "send a
 * workout to friends" / "follow someone's program"). `sourceRoutineId` keeps
 * the provenance so the copy can credit the original author.
 */
export async function copyRoutine(
  routineId: string,
): Promise<ActionResult<{ routineId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const [src] = await db
    .select()
    .from(routine)
    .where(eq(routine.id, routineId))
    .limit(1);
  if (!src) return { ok: false, error: "Routine not found" };
  if (src.userId !== me.id && !src.isPublic) {
    return { ok: false, error: "That routine is private" };
  }

  // The chain is already flattened to the original for provenance; the save is
  // credited to that same root, so a copy-of-a-copy still counts for the author.
  const rootId = src.sourceRoutineId ?? src.id;
  const isForeign = src.userId !== me.id;

  const newId = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(routine)
      .values({
        userId: me.id,
        name: src.userId === me.id ? `${src.name} (copy)` : src.name,
        notes: src.notes,
        // A copy lands unfiled. Inheriting the source's folder dropped a
        // stranger's filing system into your list.
        folderId: null,
        position: nextUnfiledPosition(me.id),
        isPublic: false,
        sourceRoutineId: rootId,
      })
      .returning({ id: routine.id });

    if (isForeign) {
      await tx
        .update(routine)
        .set({ saveCount: sql`${routine.saveCount} + 1` })
        .where(eq(routine.id, rootId));
    }

    const res = await tx
      .select()
      .from(routineExercise)
      .where(eq(routineExercise.routineId, src.id))
      .orderBy(asc(routineExercise.position));

    if (!res.length) return copy.id;

    const rsets = await tx
      .select()
      .from(routineSet)
      .where(
        inArray(
          routineSet.routineExerciseId,
          res.map((re) => re.id),
        ),
      )
      .orderBy(asc(routineSet.position));

    // Anything of the author's own goes through the same clone path a file
    // import uses. Copying the ids verbatim used to leave the copier holding
    // rows they don't own — which renders, and then 404s on the detail page,
    // vanishes from the picker, and cascades away if the author ever deletes
    // their account.
    const remap = await remapForeignExercises(
      tx,
      me.id,
      res.map((re) => re.exerciseId),
    );

    const inserted = await tx
      .insert(routineExercise)
      .values(
        res.map((re) => ({
          routineId: copy.id,
          exerciseId: remap.get(re.exerciseId) ?? re.exerciseId,
          position: re.position,
          notes: re.notes,
          restSeconds: re.restSeconds,
          supersetGroup: re.supersetGroup,
          intervalWorkSeconds: re.intervalWorkSeconds,
          intervalRestSeconds: re.intervalRestSeconds,
        })),
      )
      .returning({ id: routineExercise.id, position: routineExercise.position });

    const byPosition = new Map(inserted.map((r) => [r.position, r.id]));
    const rows = rsets.flatMap((rs) => {
      const re = res.find((x) => x.id === rs.routineExerciseId);
      const newReId = re ? byPosition.get(re.position) : undefined;
      if (!newReId) return [];
      return [
        {
          routineExerciseId: newReId,
          position: rs.position,
          setType: rs.setType,
          targetWeightKg: rs.targetWeightKg,
          targetReps: rs.targetReps,
          targetSeconds: rs.targetSeconds,
          targetDistanceM: rs.targetDistanceM,
          targetRpe: rs.targetRpe,
        },
      ];
    });

    if (rows.length) await tx.insert(routineSet).values(rows);

    return copy.id;
  });

  if (isForeign) {
    // Credit the author of the original, not whoever's copy you happened to
    // open — `notify` already drops the notification if that's you.
    const [root] = await db
      .select({ userId: routine.userId, name: routine.name })
      .from(routine)
      .where(eq(routine.id, rootId))
      .limit(1);
    if (root) {
      await notify({
        userId: root.userId,
        actorId: me.id,
        type: "routine_save",
        body: `${me.name} saved ${root.name}`,
        url: `/routines/${rootId}`,
      });
    }
  }

  revalidatePath("/routines");
  revalidatePath(`/routines/${routineId}`);
  return { ok: true, data: { routineId: newId } };
}

/**
 * Turn a finished workout into a reusable routine — the natural way people
 * build templates, by lifting first and saving the shape afterwards.
 */
export async function saveWorkoutAsRoutine(
  workoutId: string,
  name?: string,
): Promise<ActionResult<{ routineId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const [w] = await db
    .select()
    .from(workout)
    .where(and(eq(workout.id, workoutId), eq(workout.userId, me.id)))
    .limit(1);
  if (!w) return { ok: false, error: "Workout not found" };

  const wes = await db
    .select()
    .from(workoutExercise)
    .where(eq(workoutExercise.workoutId, workoutId))
    .orderBy(asc(workoutExercise.position));

  if (!wes.length) return { ok: false, error: "That workout has no exercises" };

  const weIds = wes.map((r) => r.id);
  const sets = await db
    .select()
    .from(workoutSet)
    .where(inArray(workoutSet.workoutExerciseId, weIds))
    .orderBy(asc(workoutSet.position));

  // A workout saved as "unfinished" keeps its skipped sets. The template
  // should describe what was performed, so those are left out — unless the
  // exercise was skipped wholesale, in which case its plan is all we have.
  const byWe = new Map<string, typeof sets>();
  const skippedByWe = new Map<string, typeof sets>();
  for (const s of sets) {
    const target = s.completedAt != null ? byWe : skippedByWe;
    const list = target.get(s.workoutExerciseId) ?? [];
    list.push(s);
    target.set(s.workoutExerciseId, list);
  }
  for (const [weId, list] of skippedByWe) {
    if (!byWe.has(weId)) byWe.set(weId, list);
  }

  const id = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(routine)
      .values({
        userId: me.id,
        name: name?.trim() || w.name,
        isPublic: true,
      })
      .returning({ id: routine.id });

    const inserted = await tx
      .insert(routineExercise)
      .values(
        wes.map((we) => ({
          routineId: r.id,
          exerciseId: we.exerciseId,
          position: we.position,
          notes: we.notes,
          restSeconds: we.restSeconds,
          supersetGroup: we.supersetGroup,
          intervalWorkSeconds: we.intervalWorkSeconds,
          intervalRestSeconds: we.intervalRestSeconds,
        })),
      )
      .returning({ id: routineExercise.id, position: routineExercise.position });

    const byPosition = new Map(inserted.map((x) => [x.position, x.id]));
    const rows = wes.flatMap((we) => {
      const reId = byPosition.get(we.position);
      if (!reId) return [];
      return (byWe.get(we.id) ?? []).map((s, j) => ({
        routineExerciseId: reId,
        position: j,
        setType: s.setType,
        // Undo any deload scaling so the template holds true prescribed load.
        targetWeightKg:
          s.weightKg != null && w.loadMultiplier !== 0
            ? Math.round((s.weightKg / w.loadMultiplier) * 100) / 100
            : s.weightKg,
        targetReps: s.reps,
        targetSeconds: s.seconds,
        targetDistanceM: s.distanceM,
        targetRpe: s.rpe,
      }));
    });

    if (rows.length) await tx.insert(routineSet).values(rows);
    return r.id;
  });

  revalidatePath("/routines");
  return { ok: true, data: { routineId: id } };
}

/* Custom-exercise create/edit/archive live in `actions/exercise.ts`. */
