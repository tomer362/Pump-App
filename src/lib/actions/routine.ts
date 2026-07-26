"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  exercise,
  routine,
  routineExercise,
  routineSet,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./user";

/** Shape the routine editor posts back. The whole routine is saved at once. */
const routineInputSchema = z.object({
  name: z.string().trim().min(1, "Give the routine a name").max(80),
  notes: z.string().trim().max(1000).nullable().optional(),
  folder: z.string().trim().max(40).nullable().optional(),
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

  const id = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(routine)
      .values({
        userId: me.id,
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        folder: parsed.data.folder ?? null,
        isPublic: parsed.data.isPublic,
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
    .select({ id: routine.id })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.userId, me.id)))
    .limit(1);
  if (!existing) return { ok: false, error: "Routine not found" };

  await db.transaction(async (tx) => {
    await tx
      .update(routine)
      .set({
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        folder: parsed.data.folder ?? null,
        isPublic: parsed.data.isPublic,
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeRoutineChildren(
  tx: Tx,
  routineId: string,
  exercises: z.output<typeof routineInputSchema>["exercises"],
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

  const newId = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(routine)
      .values({
        userId: me.id,
        name: src.userId === me.id ? `${src.name} (copy)` : src.name,
        notes: src.notes,
        folder: src.folder,
        isPublic: false,
        sourceRoutineId: src.sourceRoutineId ?? src.id,
      })
      .returning({ id: routine.id });

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

    const inserted = await tx
      .insert(routineExercise)
      .values(
        res.map((re) => ({
          routineId: copy.id,
          exerciseId: re.exerciseId,
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

  revalidatePath("/routines");
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

  const byWe = new Map<string, typeof sets>();
  for (const s of sets) {
    const list = byWe.get(s.workoutExerciseId) ?? [];
    list.push(s);
    byWe.set(s.workoutExerciseId, list);
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
        targetRpe: null,
      }));
    });

    if (rows.length) await tx.insert(routineSet).values(rows);
    return r.id;
  });

  revalidatePath("/routines");
  return { ok: true, data: { routineId: id } };
}

/* -------------------------------------------------------------------------- */
/* Custom exercises                                                            */
/* -------------------------------------------------------------------------- */

const customExerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  primaryMuscle: z.string().min(1),
  equipment: z.string().min(1),
  trackingType: z
    .enum(["weight_reps", "reps", "time", "distance_time", "weight_time"])
    .default("weight_reps"),
});

export async function createCustomExercise(input: {
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType?: string;
}): Promise<ActionResult<{ exerciseId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const [dupe] = await db
    .select({ id: exercise.id })
    .from(exercise)
    .where(
      and(
        eq(exercise.ownerId, me.id),
        sql`LOWER(${exercise.name}) = LOWER(${parsed.data.name})`,
      ),
    )
    .limit(1);
  if (dupe) return { ok: false, error: "You already have an exercise with that name" };

  const [row] = await db
    .insert(exercise)
    .values({
      name: parsed.data.name,
      primaryMuscle: parsed.data.primaryMuscle as never,
      equipment: parsed.data.equipment as never,
      trackingType: parsed.data.trackingType as never,
      ownerId: me.id,
    })
    .returning({ id: exercise.id });

  revalidatePath("/exercises");
  return { ok: true, data: { exerciseId: row.id } };
}

export async function deleteCustomExercise(
  exerciseId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .delete(exercise)
    .where(and(eq(exercise.id, exerciseId), eq(exercise.ownerId, me.id)));

  revalidatePath("/exercises");
  return { ok: true };
}
