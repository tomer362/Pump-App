"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  follow,
  friendRequest,
  gym,
  gymMember,
  gymPresence,
  notification,
  post,
  postComment,
  postLike,
  user,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { grantAchievements } from "./achievements";
import { notifyFriends } from "@/lib/push-fanout";
import { notify, notifyPostAuthor } from "./notify";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

/* -------------------------------------------------------------------------- */
/* Follow                                                                      */
/* -------------------------------------------------------------------------- */

export async function toggleFollow(
  targetId: string,
): Promise<ActionResult<{ following: boolean }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.id === targetId) return { ok: false, error: "You can't follow yourself" };

  const [existing] = await db
    .select()
    .from(follow)
    .where(
      and(eq(follow.followerId, me.id), eq(follow.followingId, targetId)),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(follow)
      .where(
        and(eq(follow.followerId, me.id), eq(follow.followingId, targetId)),
      );
    revalidatePath("/feed");
    return { ok: true, data: { following: false } };
  }

  await db
    .insert(follow)
    .values({ followerId: me.id, followingId: targetId })
    .onConflictDoNothing();

  revalidatePath("/feed");
  return { ok: true, data: { following: true } };
}

/* -------------------------------------------------------------------------- */
/* Friends                                                                     */
/* -------------------------------------------------------------------------- */

export async function sendFriendRequest(
  targetId: string,
): Promise<ActionResult<{ status: "pending" | "friends" }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.id === targetId) return { ok: false, error: "That's you" };

  // If they already asked us, treat this as accepting rather than creating a
  // mirrored request that could never resolve.
  const [incoming] = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.requesterId, targetId),
        eq(friendRequest.addresseeId, me.id),
        eq(friendRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (incoming) return acceptFriendRequest(targetId);

  const limited = await rateLimit(me.id, "friend_request", {
    limit: 30,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  await db
    .insert(friendRequest)
    .values({ requesterId: me.id, addresseeId: targetId, status: "pending" })
    .onConflictDoUpdate({
      target: [friendRequest.requesterId, friendRequest.addresseeId],
      set: { status: "pending", respondedAt: null },
    });

  // Following is implied by friending — you want their workouts in your feed.
  await db
    .insert(follow)
    .values({ followerId: me.id, followingId: targetId })
    .onConflictDoNothing();

  await notify({
    userId: targetId,
    actorId: me.id,
    type: "friend_request",
    body: `${me.name} sent you a friend request`,
    url: "/friends",
  });

  revalidatePath("/friends");
  return { ok: true, data: { status: "pending" } };
}

export async function acceptFriendRequest(
  requesterId: string,
): Promise<ActionResult<{ status: "friends" }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const res = await db
    .update(friendRequest)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(
      and(
        eq(friendRequest.requesterId, requesterId),
        eq(friendRequest.addresseeId, me.id),
        eq(friendRequest.status, "pending"),
      ),
    )
    .returning({ id: friendRequest.id });

  if (!res.length) return { ok: false, error: "No pending request from them" };

  // Friendship is mutual, so follow both ways.
  await db
    .insert(follow)
    .values([
      { followerId: me.id, followingId: requesterId },
      { followerId: requesterId, followingId: me.id },
    ])
    .onConflictDoNothing();

  await grantAchievements(me.id, { addedFriend: true });
  await grantAchievements(requesterId, { addedFriend: true });

  await notify({
    userId: requesterId,
    actorId: me.id,
    type: "friend_accepted",
    body: `${me.name} accepted your friend request`,
    url: `/u/${me.username ?? me.id}`,
  });

  revalidatePath("/friends");
  revalidatePath("/feed");
  return { ok: true, data: { status: "friends" } };
}

export async function declineFriendRequest(
  requesterId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .update(friendRequest)
    .set({ status: "declined", respondedAt: new Date() })
    .where(
      and(
        eq(friendRequest.requesterId, requesterId),
        eq(friendRequest.addresseeId, me.id),
      ),
    );

  revalidatePath("/friends");
  return { ok: true };
}

export async function removeFriend(otherId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .delete(friendRequest)
    .where(
      or(
        and(
          eq(friendRequest.requesterId, me.id),
          eq(friendRequest.addresseeId, otherId),
        ),
        and(
          eq(friendRequest.requesterId, otherId),
          eq(friendRequest.addresseeId, me.id),
        ),
      ),
    );

  revalidatePath("/friends");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Post interactions                                                           */
/* -------------------------------------------------------------------------- */

export async function toggleLike(
  postId: string,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (!z.string().uuid().safeParse(postId).success) {
    return { ok: false, error: "Post not found" };
  }

  const limited = await rateLimit(me.id, "toggle_like", {
    limit: 60,
    windowSeconds: 60,
  });
  if (!limited.ok) return limited;

  /**
   * The counter delta is derived from what the write actually did, inside the
   * transaction. Reading "does a like exist?" first and branching on it lets
   * two concurrent taps both take the insert branch: the unique constraint
   * collapses them to one row, but both would increment, and the count drifts
   * up permanently with no reconciliation anywhere.
   */
  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postLike)
      .values({ postId, userId: me.id })
      .onConflictDoNothing()
      .returning({ postId: postLike.postId });

    if (inserted.length > 0) {
      const [row] = await tx
        .update(post)
        .set({ likeCount: sql`${post.likeCount} + 1` })
        .where(eq(post.id, postId))
        .returning({ likeCount: post.likeCount });
      return { liked: true, likeCount: row?.likeCount ?? 0 };
    }

    const removed = await tx
      .delete(postLike)
      .where(and(eq(postLike.postId, postId), eq(postLike.userId, me.id)))
      .returning({ postId: postLike.postId });

    if (removed.length === 0) {
      const [row] = await tx
        .select({ likeCount: post.likeCount })
        .from(post)
        .where(eq(post.id, postId))
        .limit(1);
      return { liked: false, likeCount: row?.likeCount ?? 0 };
    }

    const [row] = await tx
      .update(post)
      .set({ likeCount: sql`GREATEST(${post.likeCount} - 1, 0)` })
      .where(eq(post.id, postId))
      .returning({ likeCount: post.likeCount });
    return { liked: false, likeCount: row?.likeCount ?? 0 };
  });

  if (result.liked) {
    await notifyPostAuthor(postId, me.id, "like", `${me.name} liked your workout`);
  }

  return { ok: true, data: result };
}

export async function addComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<ActionResult<{ commentId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  if (!z.string().uuid().safeParse(postId).success) {
    return { ok: false, error: "Post not found" };
  }

  const parsed = z.string().trim().min(1).max(500).safeParse(body);
  if (!parsed.success) return { ok: false, error: "Comment can't be empty" };

  const limited = await rateLimit(me.id, "add_comment", {
    limit: 20,
    windowSeconds: 60,
  });
  if (!limited.ok) return limited;

  const [target] = await db
    .select({ id: post.id })
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);
  if (!target) return { ok: false, error: "Post not found" };

  // A reply must point at a comment on THIS post. `parentId` has no foreign
  // key, so an unchecked value would create a comment that renders nowhere —
  // the thread only walks replies of its own roots — while still counting
  // toward commentCount.
  let resolvedParent: string | null = null;
  if (parentId) {
    const [parent] = await db
      .select({ id: postComment.id, parentId: postComment.parentId })
      .from(postComment)
      .where(and(eq(postComment.id, parentId), eq(postComment.postId, postId)))
      .limit(1);
    if (!parent) return { ok: false, error: "That comment no longer exists" };
    // Single-level threading: a reply to a reply attaches to its root.
    resolvedParent = parent.parentId ?? parent.id;
  }

  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postComment)
      .values({
        postId,
        userId: me.id,
        body: parsed.data,
        parentId: resolvedParent,
      })
      .returning({ id: postComment.id });
    await tx
      .update(post)
      .set({ commentCount: sql`${post.commentCount} + 1` })
      .where(eq(post.id, postId));
    return inserted;
  });

  await notifyPostAuthor(
    postId,
    me.id,
    resolvedParent ? "comment_reply" : "comment",
    `${me.name} commented: ${parsed.data.slice(0, 80)}`,
  );

  revalidatePath(`/post/${postId}`);
  return { ok: true, data: { commentId: row.id } };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const [c] = await db
    .select({ postId: postComment.postId })
    .from(postComment)
    .where(and(eq(postComment.id, commentId), eq(postComment.userId, me.id)))
    .limit(1);
  if (!c) return { ok: false, error: "Comment not found" };

  await db.transaction(async (tx) => {
    // Replies carry no FK cascade, so deleting a root would otherwise strand
    // them — invisible in the thread but still counted.
    const removed = await tx
      .delete(postComment)
      .where(
        or(eq(postComment.id, commentId), eq(postComment.parentId, commentId)),
      )
      .returning({ id: postComment.id });

    if (removed.length) {
      await tx
        .update(post)
        .set({
          commentCount: sql`GREATEST(${post.commentCount} - ${removed.length}, 0)`,
        })
        .where(eq(post.id, c.postId));
    }
  });

  revalidatePath(`/post/${c.postId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Gyms + presence                                                             */
/* -------------------------------------------------------------------------- */

function makeJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function createGym(input: {
  name: string;
  city?: string | null;
}): Promise<ActionResult<{ gymId: string; joinCode: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const limited = await rateLimit(me.id, "create_gym", {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name is required").max(80),
      city: z.string().trim().max(80).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const joinCode = makeJoinCode();
  const [g] = await db
    .insert(gym)
    .values({
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      joinCode,
      createdById: me.id,
    })
    .returning({ id: gym.id, joinCode: gym.joinCode });

  await db
    .insert(gymMember)
    .values({ gymId: g.id, userId: me.id })
    .onConflictDoNothing();

  // First gym becomes your default, so workouts get tagged without asking.
  if (!me.homeGymId) {
    await db.update(user).set({ homeGymId: g.id }).where(eq(user.id, me.id));
  }

  revalidatePath("/gyms");
  return { ok: true, data: { gymId: g.id, joinCode: g.joinCode } };
}

export async function joinGymByCode(
  code: string,
): Promise<ActionResult<{ gymId: string; name: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  // Join codes are the only credential for a gym, so guessing must be slow.
  const limited = await rateLimit(me.id, "join_gym", {
    limit: 10,
    windowSeconds: 600,
  });
  if (!limited.ok) return limited;

  const normalized = z.string().trim().max(16).parse(code).toUpperCase();
  const [g] = await db
    .select()
    .from(gym)
    .where(eq(gym.joinCode, normalized))
    .limit(1);
  if (!g) return { ok: false, error: "No gym with that code" };

  await db
    .insert(gymMember)
    .values({ gymId: g.id, userId: me.id })
    .onConflictDoNothing();

  if (!me.homeGymId) {
    await db.update(user).set({ homeGymId: g.id }).where(eq(user.id, me.id));
  }

  revalidatePath("/gyms");
  return { ok: true, data: { gymId: g.id, name: g.name } };
}

export async function leaveGym(gymId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .delete(gymMember)
    .where(and(eq(gymMember.gymId, gymId), eq(gymMember.userId, me.id)));

  if (me.homeGymId === gymId) {
    await db.update(user).set({ homeGymId: null }).where(eq(user.id, me.id));
  }

  revalidatePath("/gyms");
  return { ok: true };
}

export async function setHomeGym(gymId: string | null): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  await db.update(user).set({ homeGymId: gymId }).where(eq(user.id, me.id));
  revalidatePath("/gyms");
  return { ok: true };
}

/**
 * Broadcast "I'm at the gym" for a bounded window. Stored as a TTL row that
 * the feed filters on read — no background job, no live channel.
 */
export async function checkInAtGym(input: {
  gymId?: string | null;
  note?: string | null;
  minutes?: number;
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  // The heaviest action in the app: one call pushes to every friend's device.
  // Without a cooldown a loop here is a notification cannon.
  const limited = await rateLimit(me.id, "gym_checkin", {
    limit: 1,
    windowSeconds: 600,
  });
  if (!limited.ok) return limited;

  const minutes = Math.min(240, Math.max(15, input.minutes ?? 90));
  const expiresAt = new Date(Date.now() + minutes * 60_000);

  await db
    .insert(gymPresence)
    .values({
      userId: me.id,
      gymId: input.gymId ?? me.homeGymId ?? null,
      note: input.note?.trim() || null,
      startedAt: new Date(),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: gymPresence.userId,
      set: {
        gymId: input.gymId ?? me.homeGymId ?? null,
        note: input.note?.trim() || null,
        startedAt: new Date(),
        expiresAt,
      },
    });

  // Push is best-effort; the inbox row is what the user can actually rely on.
  const friendIds = await db
    .select({ id: user.id })
    .from(user)
    .where(
      sql`${user.id} IN (
        SELECT CASE WHEN requester_id = ${me.id} THEN addressee_id ELSE requester_id END
        FROM ${friendRequest}
        WHERE status = 'accepted' AND (requester_id = ${me.id} OR addressee_id = ${me.id})
      )`,
    )
    .limit(200);

  if (friendIds.length) {
    await db.insert(notification).values(
      friendIds.map((f) => ({
        userId: f.id,
        actorId: me.id,
        type: "gym_presence" as const,
        body: input.note?.trim()
          ? `${me.name} is at the gym — ${input.note.trim()}`
          : `${me.name} is at the gym`,
      })),
    );
  }

  await notifyFriends(me.id, {
    title: `${me.name} is at the gym`,
    body: input.note?.trim() || "Training now — come join.",
    url: "/feed",
  });

  revalidatePath("/feed");
  return { ok: true };
}

export async function checkOut(): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  await db.delete(gymPresence).where(eq(gymPresence.userId, me.id));
  revalidatePath("/feed");
  return { ok: true };
}
