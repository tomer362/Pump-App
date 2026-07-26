"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-z0-9_.]+$/, "Letters, numbers, dots and underscores only");

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function checkUsernameAvailable(
  raw: string,
): Promise<ActionResult<{ available: boolean }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, parsed.data), ne(user.id, me.id)))
    .limit(1);

  return { ok: true, data: { available: !taken } };
}

const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  username: usernameSchema,
  unit: z.enum(["kg", "lb"]),
  defaultRestSeconds: z.number().int().min(0).max(900),
});

export async function completeOnboarding(input: {
  name: string;
  username: string;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, parsed.data.username), ne(user.id, me.id)))
    .limit(1);
  if (taken) return { ok: false, error: "That username is taken" };

  await db
    .update(user)
    .set({
      name: parsed.data.name,
      username: parsed.data.username,
      unit: parsed.data.unit,
      defaultRestSeconds: parsed.data.defaultRestSeconds,
      onboardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(user.id, me.id));

  revalidatePath("/", "layout");
  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(160).nullable(),
  unit: z.enum(["kg", "lb"]),
  defaultRestSeconds: z.number().int().min(0).max(900),
});

export async function updateProfile(input: {
  name: string;
  bio: string | null;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  await db
    .update(user)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(user.id, me.id));

  revalidatePath("/profile");
  return { ok: true };
}
