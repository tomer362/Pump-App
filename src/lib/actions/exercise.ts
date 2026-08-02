"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { exercise, EQUIPMENT, MUSCLES, TRACKING_TYPES } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./user";

/**
 * Custom exercises: create, edit, archive, restore.
 *
 * Every statement here is scoped with `owner_id = me.id`. Built-in library
 * entries carry a null owner, so they can never match — the library is
 * read-only by construction rather than by a check someone can forget. `slug`
 * is never in the write set either: it is the stable key the seed and
 * `exercise_alternative` are authored against, and letting a user set one
 * would let them collide with a built-in.
 */

const exerciseFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  primaryMuscle: z.enum(MUSCLES),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(6).default([]),
  equipment: z.enum(EQUIPMENT),
  trackingType: z.enum(TRACKING_TYPES).default("weight_reps"),
  instructions: z.string().trim().max(1000).nullable().optional(),
});

export type CustomExerciseInput = z.input<typeof exerciseFieldsSchema>;

/**
 * Names are compared case-insensitively against this user's own exercises
 * only — two people may each have a "Tomer's Curl", and a custom exercise is
 * allowed to share a name with a built-in.
 */
async function nameTaken(userId: string, name: string, exceptId?: string) {
  const [dupe] = await db
    .select({ id: exercise.id })
    .from(exercise)
    .where(
      and(
        eq(exercise.ownerId, userId),
        sql`LOWER(${exercise.name}) = LOWER(${name})`,
        exceptId ? ne(exercise.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return dupe != null;
}

export async function createCustomExercise(
  input: CustomExerciseInput,
): Promise<ActionResult<{ exerciseId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = exerciseFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  if (await nameTaken(me.id, parsed.data.name)) {
    return { ok: false, error: "You already have an exercise with that name" };
  }

  const [row] = await db
    .insert(exercise)
    .values({
      name: parsed.data.name,
      primaryMuscle: parsed.data.primaryMuscle,
      secondaryMuscles: parsed.data.secondaryMuscles,
      equipment: parsed.data.equipment,
      trackingType: parsed.data.trackingType,
      instructions: parsed.data.instructions ?? null,
      ownerId: me.id,
    })
    .returning({ id: exercise.id });

  revalidatePath("/exercises");
  return { ok: true, data: { exerciseId: row.id } };
}

export async function updateCustomExercise(
  input: CustomExerciseInput & { exerciseId: string },
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsedId = z.string().uuid().safeParse(input.exerciseId);
  if (!parsedId.success) return { ok: false, error: "Unknown exercise" };

  const parsed = exerciseFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  if (await nameTaken(me.id, parsed.data.name, parsedId.data)) {
    return { ok: false, error: "You already have an exercise with that name" };
  }

  const updated = await db
    .update(exercise)
    .set({
      name: parsed.data.name,
      primaryMuscle: parsed.data.primaryMuscle,
      secondaryMuscles: parsed.data.secondaryMuscles,
      equipment: parsed.data.equipment,
      trackingType: parsed.data.trackingType,
      instructions: parsed.data.instructions ?? null,
      // Editing an exercise that arrived with someone's routine is as strong a
      // claim on it as pressing "Add to my library". Without this, a person
      // renames the thing to what they call it and then can't work out why it
      // still won't come up in search.
      importedAt: null,
    })
    .where(and(eq(exercise.id, parsedId.data), eq(exercise.ownerId, me.id)))
    .returning({ id: exercise.id });

  if (!updated.length) {
    return { ok: false, error: "That isn't one of your exercises" };
  }

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${parsedId.data}`);
  return { ok: true };
}

/**
 * The "delete" the UI offers.
 *
 * A real DELETE cascades to `workout_set` through `workout_exercise`, which
 * would rewrite finished sessions and drop the records computed from them.
 * Archiving hides the exercise from search, the picker and the browser while
 * every logged set, personal record and muscle-volume count stays exactly as
 * it was.
 */
export async function archiveCustomExercise(
  exerciseId: string,
): Promise<ActionResult> {
  return setArchived(exerciseId, true);
}

export async function restoreCustomExercise(
  exerciseId: string,
): Promise<ActionResult> {
  return setArchived(exerciseId, false);
}

/**
 * Take an exercise that arrived with an imported routine into the library
 * proper, so it turns up in search like anything you wrote yourself.
 *
 * `sourceExerciseId` is deliberately left alone. Provenance is a fact about
 * where the row came from; visibility is a preference about where it shows.
 * Collapsing the two into one column would mean adopting an exercise also
 * forgets that a later copy of the same source should reuse it.
 */
export async function adoptImportedExercise(
  exerciseId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsedId = z.string().uuid().safeParse(exerciseId);
  if (!parsedId.success) return { ok: false, error: "Unknown exercise" };

  const updated = await db
    .update(exercise)
    .set({ importedAt: null })
    .where(and(eq(exercise.id, parsedId.data), eq(exercise.ownerId, me.id)))
    .returning({ id: exercise.id });

  if (!updated.length) {
    return { ok: false, error: "That isn't one of your exercises" };
  }

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${parsedId.data}`);
  return { ok: true };
}

async function setArchived(
  exerciseId: string,
  archived: boolean,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsedId = z.string().uuid().safeParse(exerciseId);
  if (!parsedId.success) return { ok: false, error: "Unknown exercise" };

  const updated = await db
    .update(exercise)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(exercise.id, parsedId.data), eq(exercise.ownerId, me.id)))
    .returning({ id: exercise.id });

  if (!updated.length) {
    return { ok: false, error: "That isn't one of your exercises" };
  }

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${parsedId.data}`);
  return { ok: true };
}
