import "server-only";
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notification, post, pushSubscription, user } from "@/lib/db/schema";
import type { NotificationType } from "@/lib/db/schema";

/**
 * Record an in-app notification and, best-effort, push it.
 *
 * The row is the source of truth — iOS drops push subscriptions after periods
 * of inactivity and only delivers to home-screen-installed PWAs at all, so the
 * inbox has to work whether or not the push lands.
 */
export async function notify(input: {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  body: string;
  postId?: string | null;
  workoutId?: string | null;
  url?: string;
}) {
  // Never notify someone about their own action.
  if (input.actorId && input.actorId === input.userId) return;

  await db.insert(notification).values({
    userId: input.userId,
    actorId: input.actorId ?? null,
    type: input.type,
    body: input.body,
    postId: input.postId ?? null,
    workoutId: input.workoutId ?? null,
  });

  await pushTo(input.userId, {
    title: "Pump",
    body: input.body,
    url: input.url ?? "/notifications",
    tag: input.type,
  });
}

/** Notify a post's author about interaction on it. */
export async function notifyPostAuthor(
  postId: string,
  actorId: string,
  type: NotificationType,
  body: string,
) {
  const [target] = await db
    .select({ userId: post.userId })
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);
  if (!target) return;

  await notify({
    userId: target.userId,
    actorId,
    type,
    body,
    postId,
    url: `/post/${postId}`,
  });
}

type Payload = { title: string; body: string; url?: string; tag?: string };

export function vapidConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

/** Push to every device belonging to one user. Failures are swallowed. */
export async function pushTo(userId: string, payload: Payload) {
  if (!vapidConfigured()) return;

  const subs = await db
    .select({
      id: pushSubscription.id,
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.p256dh,
      auth: pushSubscription.auth,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    // A single user shouldn't have many devices; cap the fan-out regardless.
    .limit(10);

  await deliver(subs, payload);
}

export async function deliver(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: Payload,
) {
  if (!subs.length || !vapidConfigured()) return;

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
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
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
    await db.execute(
      sql`DELETE FROM push_subscription WHERE id IN (${sql.join(
        dead.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  }
}

export type NotificationItem = {
  id: string;
  type: NotificationType;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
  postId: string | null;
  actor: { id: string; name: string; username: string | null; image: string | null } | null;
};

export async function getNotifications(
  userId: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      body: notification.body,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      postId: notification.postId,
      actorId: user.id,
      actorName: user.name,
      actorUsername: user.username,
      actorImage: user.image,
    })
    .from(notification)
    .leftJoin(user, eq(user.id, notification.actorId))
    .where(eq(notification.userId, userId))
    .orderBy(sql`${notification.createdAt} DESC`)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    createdAt: r.createdAt,
    readAt: r.readAt,
    postId: r.postId,
    actor: r.actorId
      ? {
          id: r.actorId,
          name: r.actorName ?? "",
          username: r.actorUsername,
          image: r.actorImage,
        }
      : null,
  }));
}

async function getUnreadNotificationCountUncached(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        sql`${notification.readAt} IS NULL`,
      ),
    );
  return row?.n ?? 0;
}

/** Per-request deduped: the layout's tab bar and `/profile` both ask. */
export const getUnreadNotificationCount = cache(getUnreadNotificationCountUncached);
