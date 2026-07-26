"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./user";

export async function markNotificationsRead(): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(eq(notification.userId, me.id), isNull(notification.readAt)),
    );

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true };
}
