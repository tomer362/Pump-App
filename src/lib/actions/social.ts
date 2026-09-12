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
import { isUniqueViolation, withFreshJoinCode } from "@/lib/join-code";
import { isUuid } from "@/lib/uuid";
import { notify, notifyPostAuthor } from "./notify";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

/**
 * A target id arrives off the wire like any other argument. `user.id` is text,
 * so a made-up id doesn't fail the uuid check — it fails the foreign key on
 * `follow`/`friend_request` instead, which throws out of the action rather
 * than answering. One indexed read settles it.
 */
async function userExists(id: string) {
  if (typeof id !== "string" || !id || id.length > 64) return false;
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return Boolean(row);
}

/* -------------------------------------------------------------------------- */
/* Follow                                                                      */
/* -------------------------------------------------------------------------- */

export async function toggleFollow(
  targetId: string,
): Promise<ActionResult<{ following: boolean }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.id === targetId)
    return { ok: false, error: "You can't follow yourself" };
  if (!(await userExists(targetId))) {
    return { ok: false, error: "Person not found" };
  }

  // Following writes a row and revalidates the feed on every flip; unbounded,
  // a loop here is a free write amplifier.
  const limited = await rateLimit(me.id, "toggle_follow", {
    limit: 60,
    windowSeconds: 60,
  });
  if (!limited.ok) return limited;

  const [existing] = await db
    .select()
    .from(follow)
    .where(and(eq(follow.followerId, me.id), eq(follow.followingId, targetId)))
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
  if (!(await userExists(targetId))) {
    return { ok: false, error: "Person not found" };
  }

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

  // A request they already declined stays declined. Re-opening it here would
  // let one person re-ask — and re-notify — thirty times an hour for as long
  // as they liked; the answer "no" has to be able to stick. Nothing is
  // reported back, because "they declined you" is theirs to tell, not ours.
  let written: { status: string }[];
  try {
    written = await db
      .insert(friendRequest)
      .values({ requesterId: me.id, addresseeId: targetId, status: "pending" })
      .onConflictDoUpdate({
        target: [friendRequest.requesterId, friendRequest.addresseeId],
        set: { status: "pending", respondedAt: null },
        setWhere: sql`${friendRequest.status} <> 'declined'`,
      })
      .returning({ status: friendRequest.status });
  } catch (err) {
    // `friend_pair_sym_idx`: they asked us in the same instant and their row
    // landed first. That is the "already asked us" branch above, one race
    // later — so answer it the same way.
    if (!isUniqueViolation(err)) throw err;
    return acceptFriendRequest(targetId);
  }

  // Following is implied by friending — you want their workouts in your feed.
  await db
    .insert(follow)
    .values({ followerId: me.id, followingId: targetId })
    .onConflictDoNothing();

  if (written.length) {
    await notify({
      userId: targetId,
      actorId: me.id,
      type: "friend_request",
      body: `${me.name} sent you a friend request`,
      url: "/friends",
    });
  }

  revalidatePath("/friends");
  return { ok: true, data: { status: "pending" } };
}

/**
 * Friendship implied the follows (`sendFriendRequest` and `acceptFriendRequest`
 * both insert them), so ending it has to take them back. Without this a
 * declined requester — or an ex-friend — kept every workout you posted in
 * their feed, because `getFollowingFeed` reads `follow` and nothing else.
 */
async function unfollowBothWays(tx: Tx, a: string, b: string) {
  await tx
    .delete(follow)
    .where(
      or(
        and(eq(follow.followerId, a), eq(follow.followingId, b)),
        and(eq(follow.followerId, b), eq(follow.followingId, a)),
      ),
    );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  if (typeof requesterId !== "string" || !requesterId) {
    return { ok: false, error: "Person not found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(friendRequest)
      .set({ status: "declined", respondedAt: new Date() })
      .where(
        and(
          eq(friendRequest.requesterId, requesterId),
          eq(friendRequest.addresseeId, me.id),
        ),
      );
    await unfollowBothWays(tx, me.id, requesterId);
  });

  revalidatePath("/friends");
  revalidatePath("/feed");
  return { ok: true };
}

export async function removeFriend(otherId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (typeof otherId !== "string" || !otherId) {
    return { ok: false, error: "Person not found" };
  }

  await db.transaction(async (tx) => {
    await tx
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
    await unfollowBothWays(tx, me.id, otherId);
  });

  revalidatePath("/friends");
  revalidatePath("/feed");
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

  // Once per (post, liker). The limiter allows sixty flips a minute, and
  // every re-like used to write another inbox row and another push to the
  // author — sixty banners a minute from one thumb on one heart.
  if (result.liked && !(await alreadyNotified(postId, me.id, "like"))) {
    await notifyPostAuthor(
      postId,
      me.id,
      "like",
      `${me.name} liked your workout`,
    );
  }

  return { ok: true, data: result };
}

async function alreadyNotified(postId: string, actorId: string, type: "like") {
  const [row] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.postId, postId),
        eq(notification.actorId, actorId),
        eq(notification.type, type),
      ),
    )
    .limit(1);
  return Boolean(row);
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
  let repliedToUserId: string | null = null;
  if (parentId) {
    if (!z.string().uuid().safeParse(parentId).success) {
      return { ok: false, error: "That comment no longer exists" };
    }
    const [parent] = await db
      .select({
        id: postComment.id,
        parentId: postComment.parentId,
        userId: postComment.userId,
      })
      .from(postComment)
      .where(and(eq(postComment.id, parentId), eq(postComment.postId, postId)))
      .limit(1);
    if (!parent) return { ok: false, error: "That comment no longer exists" };
    // Single-level threading: a reply to a reply attaches to its root.
    resolvedParent = parent.parentId ?? parent.id;
    repliedToUserId = parent.userId;
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

  // A reply goes to the person replied to; the post's author hears about it
  // as a comment on their post, unless they are that person. It used to send
  // the "reply" to the post author alone, so the one person a reply is
  // addressed to was the one who never heard about it.
  const excerpt = parsed.data.slice(0, 80);
  if (repliedToUserId) {
    await notify({
      userId: repliedToUserId,
      actorId: me.id,
      type: "comment_reply",
      body: `${me.name} replied: ${excerpt}`,
      postId,
      url: `/post/${postId}`,
    });
  }
  const [author] = await db
    .select({ userId: post.userId })
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);
  if (author && author.userId !== repliedToUserId) {
    await notify({
      userId: author.userId,
      actorId: me.id,
      type: "comment",
      body: `${me.name} commented: ${excerpt}`,
      postId,
      url: `/post/${postId}`,
    });
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true, data: { commentId: row.id } };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  if (!z.string().uuid().safeParse(commentId).success) {
    return { ok: false, error: "Comment not found" };
  }

  // Yours to delete if you wrote it — or if it sits on your workout. The post
  // author had no way to clear a stranger's comment off their own session
  // before, and the thread cap that a stranger could fill was the only limit.
  const [c] = await db
    .select({ postId: postComment.postId })
    .from(postComment)
    .innerJoin(post, eq(post.id, postComment.postId))
    .where(
      and(
        eq(postComment.id, commentId),
        or(eq(postComment.userId, me.id), eq(post.userId, me.id)),
      ),
    )
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

  const g = await withFreshJoinCode(async (joinCode) => {
    const [row] = await db
      .insert(gym)
      .values({
        name: parsed.data.name,
        city: parsed.data.city ?? null,
        joinCode,
        createdById: me.id,
      })
      .returning({ id: gym.id, joinCode: gym.joinCode });
    return row;
  });

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

  const parsedCode = z.string().trim().min(1).max(16).safeParse(code);
  if (!parsedCode.success) return { ok: false, error: "No gym with that code" };
  const normalized = parsedCode.data.toUpperCase();
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
  if (!isUuid(gymId)) return { ok: false, error: "Gym not found" };

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

  // The home gym is stamped onto every workout you start and is what a
  // check-in inherits, so — like `checkInAtGym` — it can only name a gym you
  // are actually a member of. `user.home_gym_id` carries no foreign key, so
  // without this any string at all would persist.
  if (gymId !== null) {
    if (!isUuid(gymId)) return { ok: false, error: "Gym not found" };
    const [member] = await db
      .select({ gymId: gymMember.gymId })
      .from(gymMember)
      .where(and(eq(gymMember.gymId, gymId), eq(gymMember.userId, me.id)))
      .limit(1);
    if (!member) return { ok: false, error: "You're not a member of that gym" };
  }

  await db.update(user).set({ homeGymId: gymId }).where(eq(user.id, me.id));
  revalidatePath("/gyms");
  return { ok: true };
}

const checkInSchema = z.object({
  gymId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(140).nullable().optional(),
  minutes: z.number().int().min(15).max(240).optional(),
});

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
  // Validated before the limiter: a malformed call must not spend the one
  // check-in the window allows. `minutes` used to be bare arithmetic on
  // whatever arrived, and `new Date(NaN)` threw out of the insert.
  const parsed = checkInSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid check-in" };

  const limited = await rateLimit(me.id, "gym_checkin", {
    limit: 1,
    windowSeconds: 600,
  });
  if (!limited.ok) return limited;

  const minutes = parsed.data.minutes ?? 90;
  const expiresAt = new Date(Date.now() + minutes * 60_000);

  // `null` and "absent" are different answers: the picker sends `null` for
  // "don't say where", and only a caller that never mentioned a gym at all
  // should inherit the home gym.
  const requested =
    "gymId" in parsed.data ? (parsed.data.gymId ?? null) : me.homeGymId;

  // A gym name reaches every friend's notification, so it can't be an
  // arbitrary id off the wire — you may only broadcast from a gym you joined.
  let gymId: string | null = null;
  let gymName: string | null = null;
  if (requested) {
    const [row] = await db
      .select({ id: gym.id, name: gym.name })
      .from(gym)
      .innerJoin(
        gymMember,
        and(eq(gymMember.gymId, gym.id), eq(gymMember.userId, me.id)),
      )
      .where(eq(gym.id, requested))
      .limit(1);
    if (!row) {
      // An explicit pick that isn't yours is a refusal; a stale home gym just
      // means the broadcast doesn't name a place.
      if ("gymId" in parsed.data)
        return { ok: false, error: "You're not a member of that gym" };
    } else {
      gymId = row.id;
      gymName = row.name;
    }
  }

  const note = parsed.data.note?.trim() || null;
  const where = gymName ? `is at ${gymName}` : "is at the gym";

  // The presence row and the inbox fan-out land together or not at all: a
  // failure between them used to leave you "at the gym" with half your
  // friends told. Push stays outside — it is best-effort by design, and the
  // inbox row is what a friend can actually rely on.
  await db.transaction(async (tx) => {
    await tx
      .insert(gymPresence)
      .values({
        userId: me.id,
        gymId,
        note,
        startedAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: gymPresence.userId,
        set: {
          gymId,
          note,
          startedAt: new Date(),
          expiresAt,
        },
      });

    const friendIds = await tx
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
      await tx.insert(notification).values(
        friendIds.map((f) => ({
          userId: f.id,
          actorId: me.id,
          type: "gym_presence" as const,
          body: note ? `${me.name} ${where} — ${note}` : `${me.name} ${where}`,
        })),
      );
    }
  });

  await notifyFriends(me.id, {
    title: `${me.name} ${where}`,
    body: note || "Training now — come join.",
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
