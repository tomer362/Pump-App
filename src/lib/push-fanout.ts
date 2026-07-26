import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendRequest, pushSubscription } from "@/lib/db/schema";
import { deliver, vapidConfigured } from "@/lib/actions/notify";

type Payload = { title: string; body: string; url?: string };

/**
 * Send a push notification to every accepted friend of `userId`.
 *
 * Deliberately NOT in a `"use server"` module — every export of one of those
 * is a live POST endpoint, and this takes a `userId` plus a freeform payload.
 * Exported there, it would let anyone signed in blast arbitrary notification
 * text to any user's entire friend list; the only caller (`checkInAtGym`)
 * already resolves `userId` from the session before calling in, so nothing is
 * lost by making it uncallable from outside.
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
    )
    // Bounded: one function invocation shouldn't fan out to an unlimited
    // number of endpoints.
    .limit(200);

  await deliver(subs, payload);
}
