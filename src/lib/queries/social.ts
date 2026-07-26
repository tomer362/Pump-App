import "server-only";
import { and, desc, eq, gt, ilike, ne, or, sql, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  follow,
  friendRequest,
  gym,
  gymMember,
  gymPresence,
  post,
  postComment,
  postLike,
  user,
  workout,
} from "@/lib/db/schema";

export type FeedItem = {
  postId: string;
  caption: string | null;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  author: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  workout: {
    id: string;
    name: string;
    durationSeconds: number;
    totalVolumeKg: number;
    totalSets: number;
    prCount: number;
    startedAt: Date;
  };
  /** Up to three exercise names for the card preview. */
  exercises: string[];
};

const feedSelection = (viewerId: string) => ({
  postId: post.id,
  caption: post.caption,
  createdAt: post.createdAt,
  likeCount: post.likeCount,
  commentCount: post.commentCount,
  likedByMe: sql<boolean>`EXISTS (
    SELECT 1 FROM ${postLike} pl
    WHERE pl.post_id = ${post.id} AND pl.user_id = ${viewerId}
  )`,
  authorId: user.id,
  authorName: user.name,
  authorUsername: user.username,
  authorImage: user.image,
  workoutId: workout.id,
  workoutName: workout.name,
  durationSeconds: workout.durationSeconds,
  totalVolumeKg: workout.totalVolumeKg,
  totalSets: workout.totalSets,
  prCount: workout.prCount,
  startedAt: workout.startedAt,
  exercises: sql<string[]>`(
    SELECT COALESCE(ARRAY_AGG(t.name ORDER BY t.position), ARRAY[]::text[])
    FROM (
      SELECT e.name, we.position
      FROM workout_exercise we
      JOIN exercise e ON e.id = we.exercise_id
      WHERE we.workout_id = ${workout.id}
      ORDER BY we.position LIMIT 3
    ) t
  )`,
});

type FeedRow = Awaited<ReturnType<typeof runFeedQuery>>[number];

async function runFeedQuery(
  viewerId: string,
  where: ReturnType<typeof and>,
  limit: number,
  before?: Date,
) {
  return db
    .select(feedSelection(viewerId))
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .innerJoin(workout, eq(workout.id, post.workoutId))
    .where(and(where, before ? lt(post.createdAt, before) : undefined))
    .orderBy(desc(post.createdAt))
    .limit(limit);
}

function toFeedItem(r: FeedRow): FeedItem {
  return {
    postId: r.postId,
    caption: r.caption,
    createdAt: r.createdAt,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    likedByMe: r.likedByMe,
    author: {
      id: r.authorId,
      name: r.authorName,
      username: r.authorUsername,
      image: r.authorImage,
    },
    workout: {
      id: r.workoutId,
      name: r.workoutName,
      durationSeconds: r.durationSeconds,
      totalVolumeKg: r.totalVolumeKg,
      totalSets: r.totalSets,
      prCount: r.prCount,
      startedAt: r.startedAt,
    },
    exercises: r.exercises ?? [],
  };
}

/** Home feed: you plus everyone you follow. */
export async function getFollowingFeed(
  viewerId: string,
  { limit = 20, before }: { limit?: number; before?: Date } = {},
): Promise<FeedItem[]> {
  const rows = await runFeedQuery(
    viewerId,
    and(
      or(
        eq(post.userId, viewerId),
        sql`${post.userId} IN (SELECT following_id FROM follow WHERE follower_id = ${viewerId})`,
      ),
    ),
    limit,
    before,
  );
  return rows.map(toFeedItem);
}

/** Discovery: recent workouts from people you don't follow yet. */
export async function getDiscoveryFeed(
  viewerId: string,
  limit = 20,
): Promise<FeedItem[]> {
  const rows = await runFeedQuery(
    viewerId,
    and(
      ne(post.userId, viewerId),
      sql`${post.userId} NOT IN (SELECT following_id FROM follow WHERE follower_id = ${viewerId})`,
    ),
    limit,
  );
  return rows.map(toFeedItem);
}

export async function getPost(postId: string, viewerId: string) {
  const rows = await runFeedQuery(viewerId, and(eq(post.id, postId)), 1);
  return rows.length ? toFeedItem(rows[0]) : null;
}

/** Capped: an unbounded thread lets one spammer make the page un-renderable. */
export async function getComments(postId: string, limit = 200) {
  return db
    .select({
      id: postComment.id,
      body: postComment.body,
      createdAt: postComment.createdAt,
      parentId: postComment.parentId,
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(postComment)
    .innerJoin(user, eq(user.id, postComment.userId))
    .where(eq(postComment.postId, postId))
    .orderBy(postComment.createdAt)
    .limit(limit);
}

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

export type PersonCard = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  workoutCount: number;
  isFollowing: boolean;
  friendStatus: "none" | "pending_out" | "pending_in" | "friends";
};

/**
 * Outer-row references are written qualified via `sql.raw`. Some callers select
 * from `user` with no joins, and in that shape drizzle renders `${user.id}` as
 * a bare "id" — which each correlated subquery then resolves against its own
 * FROM instead of the outer row.
 */
const USER_ID = sql.raw('"user"."id"');

const personSelection = (viewerId: string) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
  bio: user.bio,
  workoutCount: sql<number>`(
    SELECT COUNT(*)::int FROM ${workout} w
    WHERE w.user_id = ${USER_ID} AND w.ended_at IS NOT NULL
  )`,
  isFollowing: sql<boolean>`EXISTS (
    SELECT 1 FROM ${follow} f
    WHERE f.follower_id = ${viewerId} AND f.following_id = ${USER_ID}
  )`,
  outgoing: sql<string | null>`(
    SELECT fr.status FROM ${friendRequest} fr
    WHERE fr.requester_id = ${viewerId} AND fr.addressee_id = ${USER_ID}
    LIMIT 1
  )`,
  incoming: sql<string | null>`(
    SELECT fr.status FROM ${friendRequest} fr
    WHERE fr.requester_id = ${USER_ID} AND fr.addressee_id = ${viewerId}
    LIMIT 1
  )`,
});

function toPerson(r: {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  workoutCount: number;
  isFollowing: boolean;
  outgoing: string | null;
  incoming: string | null;
}): PersonCard {
  const friendStatus: PersonCard["friendStatus"] =
    r.outgoing === "accepted" || r.incoming === "accepted"
      ? "friends"
      : r.outgoing === "pending"
        ? "pending_out"
        : r.incoming === "pending"
          ? "pending_in"
          : "none";
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    image: r.image,
    bio: r.bio,
    workoutCount: r.workoutCount,
    isFollowing: r.isFollowing,
    friendStatus,
  };
}

export async function searchPeople(
  viewerId: string,
  query: string,
  limit = 25,
): Promise<PersonCard[]> {
  const q = query.trim();
  const rows = await db
    .select(personSelection(viewerId))
    .from(user)
    .where(
      and(
        ne(user.id, viewerId),
        sql`${user.onboardedAt} IS NOT NULL`,
        q
          ? or(ilike(user.name, `%${q}%`), ilike(user.username, `%${q}%`))
          : undefined,
      ),
    )
    .limit(limit);
  return rows.map(toPerson);
}

export async function getPersonByUsername(
  viewerId: string,
  username: string,
): Promise<PersonCard | null> {
  const [row] = await db
    .select(personSelection(viewerId))
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  return row ? toPerson(row) : null;
}

export async function getFriends(
  userId: string,
  limit = 200,
): Promise<PersonCard[]> {
  const rows = await db
    .select(personSelection(userId))
    .from(user)
    .where(
      sql`${user.id} IN (
        SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END
        FROM ${friendRequest}
        WHERE status = 'accepted' AND (requester_id = ${userId} OR addressee_id = ${userId})
      )`,
    )
    // personSelection runs four correlated subqueries per row, so this is
    // capped rather than left to grow with the friend list.
    .limit(limit);
  return rows.map(toPerson);
}

export async function getPendingFriendRequests(
  userId: string,
): Promise<PersonCard[]> {
  const rows = await db
    .select(personSelection(userId))
    .from(user)
    .innerJoin(friendRequest, eq(friendRequest.requesterId, user.id))
    .where(
      and(
        eq(friendRequest.addresseeId, userId),
        eq(friendRequest.status, "pending"),
      ),
    );
  return rows.map(toPerson);
}

export async function getFollowCounts(userId: string) {
  const [row] = await db
    .select({
      followers: sql<number>`(SELECT COUNT(*)::int FROM ${follow} WHERE following_id = ${userId})`,
      following: sql<number>`(SELECT COUNT(*)::int FROM ${follow} WHERE follower_id = ${userId})`,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? { followers: 0, following: 0 };
}

/* -------------------------------------------------------------------------- */
/* Gym presence                                                                */
/* -------------------------------------------------------------------------- */

export type PresenceEntry = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  gymName: string | null;
  note: string | null;
  startedAt: Date;
};

/**
 * Friends currently at a gym. Expired rows are filtered on read rather than
 * cleaned by a job — Hobby only allows two daily crons, and a stale row is
 * harmless if it's never selected.
 */
export async function getFriendsAtGym(
  userId: string,
): Promise<PresenceEntry[]> {
  const rows = await db
    .select({
      userId: gymPresence.userId,
      note: gymPresence.note,
      startedAt: gymPresence.startedAt,
      name: user.name,
      username: user.username,
      image: user.image,
      gymName: gym.name,
    })
    .from(gymPresence)
    .innerJoin(user, eq(user.id, gymPresence.userId))
    .leftJoin(gym, eq(gym.id, gymPresence.gymId))
    .where(
      and(
        gt(gymPresence.expiresAt, new Date()),
        ne(gymPresence.userId, userId),
        sql`${gymPresence.userId} IN (
          SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END
          FROM ${friendRequest}
          WHERE status = 'accepted' AND (requester_id = ${userId} OR addressee_id = ${userId})
        )`,
      ),
    )
    .orderBy(desc(gymPresence.startedAt));

  return rows;
}

export async function getMyPresence(userId: string) {
  const [row] = await db
    .select()
    .from(gymPresence)
    .where(
      and(eq(gymPresence.userId, userId), gt(gymPresence.expiresAt, new Date())),
    )
    .limit(1);
  return row ?? null;
}

export async function getMyGyms(userId: string) {
  return db
    .select({
      id: gym.id,
      name: gym.name,
      city: gym.city,
      joinCode: gym.joinCode,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM gym_member gm WHERE gm.gym_id = ${gym.id}
      )`,
    })
    .from(gym)
    .innerJoin(
      sql`gym_member gm2`,
      sql`gm2.gym_id = ${gym.id} AND gm2.user_id = ${userId}`,
    )
    .orderBy(gym.name);
}

export type GymDetail = {
  id: string;
  name: string;
  city: string | null;
  joinCode: string;
  createdAt: Date;
  members: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    joinedAt: Date;
    /** Non-null when this member is checked in right now. */
    presentSince: Date | null;
    presenceNote: string | null;
  }[];
};

/**
 * A gym's roster and who's in the building. Membership-gated: the join code is
 * the only credential a gym has, so a non-member must not be able to read it
 * back out of a page.
 */
export async function getGymDetail(
  gymId: string,
  viewerId: string,
): Promise<GymDetail | null> {
  const [g] = await db
    .select({
      id: gym.id,
      name: gym.name,
      city: gym.city,
      joinCode: gym.joinCode,
      createdAt: gym.createdAt,
    })
    .from(gym)
    .innerJoin(
      gymMember,
      and(eq(gymMember.gymId, gym.id), eq(gymMember.userId, viewerId)),
    )
    .where(eq(gym.id, gymId))
    .limit(1);
  if (!g) return null;

  const members = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      joinedAt: gymMember.joinedAt,
      presentSince: gymPresence.startedAt,
      presenceNote: gymPresence.note,
    })
    .from(gymMember)
    .innerJoin(user, eq(user.id, gymMember.userId))
    // Expired check-ins are filtered here rather than swept by a cron — Hobby
    // allows two daily jobs and a stale row is harmless if never selected.
    .leftJoin(
      gymPresence,
      and(
        eq(gymPresence.userId, gymMember.userId),
        eq(gymPresence.gymId, gymMember.gymId),
        gt(gymPresence.expiresAt, new Date()),
      ),
    )
    .where(eq(gymMember.gymId, gymId))
    // Whoever is there now goes to the top; that's the reason to open the page.
    .orderBy(desc(gymPresence.startedAt), gymMember.joinedAt)
    .limit(200);

  return { ...g, members };
}

export async function getUsersByIds(ids: string[]) {
  if (!ids.length) return [];
  return db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(user)
    .where(inArray(user.id, ids));
}
