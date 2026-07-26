"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAchievement } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./user";

/**
 * Clear the "new" markers once the grid has been looked at. Achievements
 * unlock silently at the end of a workout, so without this there's nothing to
 * tell you which of the twenty badges is the one you just earned.
 */
export async function markAchievementsSeen(): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .update(userAchievement)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(userAchievement.userId, me.id),
        isNull(userAchievement.seenAt),
      ),
    );

  revalidatePath("/profile");
  return { ok: true };
}
