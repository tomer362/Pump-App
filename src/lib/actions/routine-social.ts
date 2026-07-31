"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { routine, routineLike } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { notify } from "./notify";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

/**
 * Liking a routine. A near-exact port of `toggleLike` for feed posts, and
 * deliberately so — the transaction shape is the load-bearing part, not the
 * table it writes to.
 */
export async function toggleRoutineLike(
  routineId: string,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!z.string().uuid().safeParse(routineId).success) {
    return { ok: false, error: "Routine not found" };
  }

  const limited = await rateLimit(me.id, "toggle_routine_like", {
    limit: 60,
    windowSeconds: 60,
  });
  if (!limited.ok) return limited;

  const [target] = await db
    .select({
      id: routine.id,
      userId: routine.userId,
      name: routine.name,
      isPublic: routine.isPublic,
    })
    .from(routine)
    .where(eq(routine.id, routineId))
    .limit(1);
  if (!target) return { ok: false, error: "Routine not found" };
  // A private routine isn't visible to anyone else, so it can't be liked by
  // anyone else either — the id alone must not be enough.
  if (target.userId !== me.id && !target.isPublic) {
    return { ok: false, error: "That routine is private" };
  }

  /**
   * The counter delta is derived from what the write actually did, inside the
   * transaction. Reading "does a like exist?" first and branching on it lets
   * two concurrent taps both take the insert branch: the primary key collapses
   * them to one row, but both would increment, and the count drifts up
   * permanently with no reconciliation anywhere.
   */
  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(routineLike)
      .values({ routineId, userId: me.id })
      .onConflictDoNothing()
      .returning({ routineId: routineLike.routineId });

    if (inserted.length > 0) {
      const [row] = await tx
        .update(routine)
        .set({ likeCount: sql`${routine.likeCount} + 1` })
        .where(eq(routine.id, routineId))
        .returning({ likeCount: routine.likeCount });
      return { liked: true, likeCount: row?.likeCount ?? 0 };
    }

    const removed = await tx
      .delete(routineLike)
      .where(
        and(
          eq(routineLike.routineId, routineId),
          eq(routineLike.userId, me.id),
        ),
      )
      .returning({ routineId: routineLike.routineId });

    if (removed.length === 0) {
      const [row] = await tx
        .select({ likeCount: routine.likeCount })
        .from(routine)
        .where(eq(routine.id, routineId))
        .limit(1);
      return { liked: false, likeCount: row?.likeCount ?? 0 };
    }

    const [row] = await tx
      .update(routine)
      .set({ likeCount: sql`GREATEST(${routine.likeCount} - 1, 0)` })
      .where(eq(routine.id, routineId))
      .returning({ likeCount: routine.likeCount });
    return { liked: false, likeCount: row?.likeCount ?? 0 };
  });

  if (result.liked) {
    await notify({
      userId: target.userId,
      actorId: me.id,
      type: "routine_like",
      body: `${me.name} liked ${target.name}`,
      url: `/routines/${routineId}`,
    });
  }

  revalidatePath(`/routines/${routineId}`);
  return { ok: true, data: result };
}
