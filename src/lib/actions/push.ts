"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { pushSubscription } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { vapidConfigured } from "./notify";
import type { ActionResult } from "./user";

/**
 * A push endpoint is a URL this server will later POST to, and it arrives from
 * the client, so it is validated as untrusted input: https only, length-capped,
 * and never a local address.
 */
const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine((value) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return false;
      }
      if (url.protocol !== "https:") return false;
      // Don't let a caller aim the server at its own network.
      const host = url.hostname.toLowerCase();
      return !(
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host === "0.0.0.0" ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
        host.endsWith(".internal") ||
        host.endsWith(".local")
      );
    }, "Invalid push endpoint"),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) {
    return { ok: false, error: "Invalid push subscription" };
  }

  /**
   * The conflict target is (user_id, endpoint), never endpoint alone. Keying on
   * the endpoint by itself would let anyone re-assign someone else's device to
   * their own account simply by submitting that device's endpoint.
   */
  await db
    .insert(pushSubscription)
    .values({
      userId: me.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    .onConflictDoUpdate({
      target: [pushSubscription.userId, pushSubscription.endpoint],
      set: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });

  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.endpoint, endpoint),
        eq(pushSubscription.userId, me.id),
      ),
    );
  return { ok: true };
}

export async function isPushConfigured(): Promise<boolean> {
  return vapidConfigured();
}
