import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { follow, post } from "@/lib/db/schema";
import { getFollowingFeed, getUserFeed } from "@/lib/queries/social";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

/**
 * The public profile page used to render someone's posts by fetching the
 * *viewer's* home feed (capped, across everyone they follow) and filtering it
 * down to that one author — so a viewer who follows enough active people
 * could see a followed person's own profile render empty, purely because that
 * person's post had aged out of the viewer's global window.
 *
 * This reproduces exactly that: the viewer follows the profile owner plus 5
 * other people who between them post more recently, pushing the owner's post
 * outside a small feed window — then shows the old approach coming back empty
 * while `getUserFeed`, scoped to the one author, still finds it.
 */
describe("profile feed does not depend on the viewer's own feed window", () => {
  let viewerId: string;
  let ownerId: string;
  let exerciseId: string;
  const otherUserIds: string[] = [];

  beforeAll(async () => {
    viewerId = await makeUser();
    ownerId = await makeUser();
    exerciseId = await makeExercise();

    // The owner posts first (oldest)...
    const owned = await makeFinishedWorkout(ownerId, exerciseId, [
      { weightKg: 50, reps: 5 },
    ]);
    await db.insert(post).values({ userId: ownerId, workoutId: owned.workoutId });

    // ...then 5 other people the viewer also follows post more recently,
    // each one pushing the owner's post one slot further down the viewer's
    // combined feed.
    for (let i = 0; i < 5; i++) {
      const other = await makeUser();
      otherUserIds.push(other);
      const w = await makeFinishedWorkout(other, exerciseId, [
        { weightKg: 50, reps: 5 },
      ]);
      await db.insert(post).values({ userId: other, workoutId: w.workoutId });
      await db.insert(follow).values({ followerId: viewerId, followingId: other });
    }

    await db.insert(follow).values({ followerId: viewerId, followingId: ownerId });
  });

  afterAll(async () => {
    await cleanup([viewerId, ownerId, ...otherUserIds], [exerciseId]);
  });

  it("the old approach (viewer's feed, filtered) misses the owner's post once the window is small enough", async () => {
    // limit: 3 — smaller than the 5 more-recent posts from other followees,
    // so the owner's older post has already aged out of the viewer's feed.
    const viewerFeed = await getFollowingFeed(viewerId, { limit: 3 });
    const filtered = viewerFeed.filter((i) => i.author.id === ownerId);
    expect(filtered).toEqual([]);
  });

  it("getUserFeed finds the owner's post regardless of the viewer's window", async () => {
    const ownerFeed = await getUserFeed(ownerId, viewerId);
    expect(ownerFeed).toHaveLength(1);
    expect(ownerFeed[0].author.id).toBe(ownerId);
  });
});
