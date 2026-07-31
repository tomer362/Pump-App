"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { routine, routineFolder, FOLDER_COLORS } from "@/lib/db/schema";
import type { FolderColor } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

/**
 * Folders used to be a free-text column on `routine`, which meant a folder had
 * no identity: it could not be renamed without rewriting every member, could
 * not be emptied without ceasing to exist, and "PPL" / "ppl" were two folders.
 * Every action here is scoped by `userId` in the WHERE clause rather than by a
 * prior read — each export is a public POST endpoint.
 */

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the folder a name")
  .max(40, "That name is too long");

const uuidSchema = z.string().uuid();
const colorSchema = z.enum(FOLDER_COLORS);

/**
 * Postgres unique-violation (23505), raised by routine_folder_user_name_idx.
 * Drizzle wraps the driver error in a DrizzleQueryError, so the code lives on
 * the cause — checking only the top-level error silently misses every one.
 */
function isDuplicateName(err: unknown) {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export async function createFolder(input: {
  name: string;
  color?: FolderColor;
}): Promise<ActionResult<{ folderId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const name = nameSchema.safeParse(input.name);
  if (!name.success) {
    return { ok: false, error: name.error.issues[0]?.message ?? "Invalid name" };
  }
  const color = colorSchema.safeParse(input.color ?? "slate");
  if (!color.success) return { ok: false, error: "Unknown colour" };

  const limited = await rateLimit(me.id, "create_folder", {
    limit: 20,
    windowSeconds: 60,
  });
  if (!limited.ok) return limited;

  try {
    const [row] = await db
      .insert(routineFolder)
      .values({
        userId: me.id,
        name: name.data,
        color: color.data,
        // New folders land at the end, where you just were.
        position: sql`(
          SELECT COALESCE(MAX("position"), -1) + 1 FROM "routine_folder"
          WHERE "user_id" = ${me.id}
        )`,
      })
      .returning({ id: routineFolder.id });

    revalidatePath("/routines");
    return { ok: true, data: { folderId: row.id } };
  } catch (err) {
    if (isDuplicateName(err)) {
      return { ok: false, error: `You already have a folder called ${name.data}` };
    }
    throw err;
  }
}

export async function renameFolder(
  folderId: string,
  name: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Folder not found" };
  }

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  try {
    const updated = await db
      .update(routineFolder)
      .set({ name: parsed.data, updatedAt: new Date() })
      .where(
        and(eq(routineFolder.id, folderId), eq(routineFolder.userId, me.id)),
      )
      .returning({ id: routineFolder.id });
    if (!updated.length) return { ok: false, error: "Folder not found" };
  } catch (err) {
    if (isDuplicateName(err)) {
      return { ok: false, error: `You already have a folder called ${parsed.data}` };
    }
    throw err;
  }

  revalidatePath("/routines");
  return { ok: true };
}

export async function setFolderColor(
  folderId: string,
  color: FolderColor,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Folder not found" };
  }
  const parsed = colorSchema.safeParse(color);
  if (!parsed.success) return { ok: false, error: "Unknown colour" };

  const updated = await db
    .update(routineFolder)
    .set({ color: parsed.data, updatedAt: new Date() })
    .where(and(eq(routineFolder.id, folderId), eq(routineFolder.userId, me.id)))
    .returning({ id: routineFolder.id });
  if (!updated.length) return { ok: false, error: "Folder not found" };

  revalidatePath("/routines");
  return { ok: true };
}

/**
 * Rotation turns the folder into a training cycle: it reports which routine is
 * up next from what you last finished, rather than being a drawer you pick out
 * of every session.
 */
export async function setFolderRotation(
  folderId: string,
  rotation: boolean,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Folder not found" };
  }
  if (typeof rotation !== "boolean") {
    return { ok: false, error: "Invalid value" };
  }

  const updated = await db
    .update(routineFolder)
    .set({ rotation, updatedAt: new Date() })
    .where(and(eq(routineFolder.id, folderId), eq(routineFolder.userId, me.id)))
    .returning({ id: routineFolder.id });
  if (!updated.length) return { ok: false, error: "Folder not found" };

  revalidatePath("/routines");
  return { ok: true };
}

/**
 * Deleting a folder unfiles its routines — `folder_id` is ON DELETE SET NULL.
 * It must never cascade: the routines carry the workout history logged from
 * them, so a cascade would turn "tidy up my folders" into data loss.
 */
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Folder not found" };
  }

  const removed = await db
    .delete(routineFolder)
    .where(and(eq(routineFolder.id, folderId), eq(routineFolder.userId, me.id)))
    .returning({ id: routineFolder.id });
  if (!removed.length) return { ok: false, error: "Folder not found" };

  revalidatePath("/routines");
  return { ok: true };
}

const orderSchema = z.array(z.string().uuid()).min(1).max(100);

/**
 * Positions are written from one array in a transaction, and the batch is
 * rejected whole if any id isn't yours. Writing the ids that do belong to you
 * and skipping the rest would silently half-apply a reorder.
 */
export async function reorderFolders(
  orderedIds: string[],
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = orderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  const ids = parsed.data;
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Invalid order" };
  }

  const mine = await db
    .select({ id: routineFolder.id })
    .from(routineFolder)
    .where(
      and(eq(routineFolder.userId, me.id), inArray(routineFolder.id, ids)),
    );
  if (mine.length !== ids.length) return { ok: false, error: "Folder not found" };

  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(routineFolder)
        .set({ position })
        .where(
          and(eq(routineFolder.id, id), eq(routineFolder.userId, me.id)),
        );
    }
  });

  revalidatePath("/routines");
  return { ok: true };
}

/**
 * Filing a routine used to mean opening the whole builder and saving it, which
 * rewrote every `routine_exercise` and `routine_set` row underneath. This
 * touches two columns.
 */
export async function moveRoutineToFolder(
  routineId: string,
  folderId: string | null,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!uuidSchema.safeParse(routineId).success) {
    return { ok: false, error: "Routine not found" };
  }
  if (folderId !== null && !uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Folder not found" };
  }

  if (folderId !== null) {
    const [folder] = await db
      .select({ id: routineFolder.id })
      .from(routineFolder)
      .where(
        and(eq(routineFolder.id, folderId), eq(routineFolder.userId, me.id)),
      )
      .limit(1);
    if (!folder) return { ok: false, error: "Folder not found" };
  }

  const updated = await db
    .update(routine)
    .set({
      folderId,
      // Append to the end of the destination, so a move never displaces
      // something the user deliberately ordered.
      position: sql`(
        SELECT COALESCE(MAX("position"), -1) + 1 FROM "routine" r2
        WHERE r2."user_id" = ${me.id} AND r2."folder_id" IS NOT DISTINCT FROM ${folderId}
      )`,
      updatedAt: new Date(),
    })
    .where(and(eq(routine.id, routineId), eq(routine.userId, me.id)))
    .returning({ id: routine.id });
  if (!updated.length) return { ok: false, error: "Routine not found" };

  revalidatePath("/routines");
  revalidatePath(`/routines/${routineId}`);
  return { ok: true };
}

export async function reorderRoutinesInFolder(
  folderId: string | null,
  orderedIds: string[],
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (folderId !== null && !uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Folder not found" };
  }

  const parsed = orderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  const ids = parsed.data;
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Invalid order" };
  }

  // Every id must be yours *and* already in the folder being reordered —
  // otherwise this doubles as an unchecked move.
  const mine = await db
    .select({ id: routine.id })
    .from(routine)
    .where(
      and(
        eq(routine.userId, me.id),
        inArray(routine.id, ids),
        folderId === null
          ? isNull(routine.folderId)
          : eq(routine.folderId, folderId),
      ),
    );
  if (mine.length !== ids.length) return { ok: false, error: "Routine not found" };

  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(routine)
        .set({ position })
        .where(and(eq(routine.id, id), eq(routine.userId, me.id)));
    }
  });

  revalidatePath("/routines");
  return { ok: true };
}
