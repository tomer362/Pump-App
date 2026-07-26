"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendRequest, pushSubscription } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./user";

type Payload = { title: string; body: string; url?: string };

function vapidConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .insert(pushSubscription)
    .values({
      userId: me.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        userId: me.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
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

/**
 * Send to every accepted friend of `userId`.
 *
 * Push is strictly an extra channel: iOS only delivers to home-screen-installed
 * PWAs and drops subscriptions after long inactivity, so nothing in the app
 * depends on it landing. Failures are swallowed; dead endpoints are pruned.
 */
export async function notifyFriends(userId: string, payload: Payload) {
  if (!vapidConfigured()) return;

  const subs = await db
    .select({
      id: pushSubscription.id,
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.p256dh,
      auth: pushSubscription.auth,
    })
    .from(pushSubscription)
    .where(
      sql`${pushSubscription.userId} IN (
        SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END
        FROM ${friendRequest}
        WHERE status = 'accepted' AND (requester_id = ${userId} OR addressee_id = ${userId})
      )`,
    );

  if (!subs.length) return;

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser dropped the subscription for good.
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length) {
    await db.delete(pushSubscription).where(inArray(pushSubscription.id, dead));
  }
}

export async function isPushConfigured(): Promise<boolean> {
  return vapidConfigured();
}
