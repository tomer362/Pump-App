import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * `toggleLike` read the like's existence outside the transaction, so two
 * concurrent taps could both see "not liked", both take the increment branch,
 * and leave `likeCount` at 2 while `post_like` held one row —
 * `onConflictDoNothing` swallowed the duplicate. The fix derives the delta
 * from what the write actually did, which is what these assert.
 *
 * Auth and cache revalidation are mocked: the subject here is the counter SQL,
 * and neither a session cookie nor a Next request scope exists under vitest.
 */
let actingUserId = "";

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: async () => ({
    id: actingUserId,
    name: "Test Lifter",
    email: `${actingUserId}@test.invalid`,
    unit: "kg",
    defaultRestSeconds: 120,
    homeGymId: null,
    username: null,
    image: null,
    bio: null,
  }),
  requireUser: async () => {
    throw new Error("not used");
  },
}));

const { db } = await import("@/lib/db");
const { post, postComment, postLike } = await import("@/lib/db/schema");
const { addComment, deleteComment, toggleLike } = await import(
  "@/lib/actions/social"
);
const { cleanup, makeExercise, makeFinishedWorkout, makeUser } = await import(
  "./helpers"
);

describe("like and comment counters", () => {
  let author = "";
  let liker = "";
  let exerciseId = "";
  let postId = "";

  beforeAll(async () => {
    author = await makeUser();
    liker = await makeUser();
    exerciseId = await makeExercise();
    const w = await makeFinishedWorkout(author, exerciseId, [
      { weightKg: 100, reps: 5 },
    ]);
    const [p] = await db
      .insert(post)
      .values({ userId: author, workoutId: w.workoutId })
      .returning({ id: post.id });
    postId = p.id;
  });

  afterAll(async () => {
    await cleanup([author, liker], [exerciseId]);
  });

  async function counts() {
    const [row] = await db
      .select({ likes: post.likeCount, comments: post.commentCount })
      .from(post)
      .where(eq(post.id, postId));
    const rows = await db
      .select({ id: postLike.postId })
      .from(postLike)
      .where(eq(postLike.postId, postId));
    return { ...row, actualLikes: rows.length };
  }

  it("increments and decrements in step with the rows", async () => {
    actingUserId = liker;
    await toggleLike(postId);
    expect(await counts()).toMatchObject({ likes: 1, actualLikes: 1 });

    await toggleLike(postId);
    expect(await counts()).toMatchObject({ likes: 0, actualLikes: 0 });
  });

  it("never lets the counter drift from the row count under concurrency", async () => {
    actingUserId = liker;
    // Ten simultaneous taps of the same button. The counter must agree with
    // the table whatever order they land in.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => toggleLike(postId)),
    );
    // Assert every call actually executed before trusting the counts below —
    // otherwise a rate limit, an auth failure, or any other silent rejection
    // leaves the DB untouched and the two checks that follow pass on a total
    // no-op: 0 === 0 and 0 <= 1 are both true whether or not concurrency ever
    // ran at all.
    expect(results.every((r) => r.ok)).toBe(true);
    const c = await counts();
    expect(c.likes).toBe(c.actualLikes);
    expect(c.likes).toBeLessThanOrEqual(1);
  });

  it("clamps at zero rather than going negative", async () => {
    actingUserId = liker;
    await db.delete(postLike).where(eq(postLike.postId, postId));
    await db.update(post).set({ likeCount: 0 }).where(eq(post.id, postId));

    // A like exists while the counter reads zero — the drifted-low state that
    // an unguarded `likeCount - 1` turns into -1, which then renders as a
    // negative number on the card forever.
    await db.insert(postLike).values({ postId, userId: liker });
    await toggleLike(postId);

    const c = await counts();
    expect(c.likes).toBe(0);
    expect(c.actualLikes).toBe(0);
  });

  it("cascades replies so commentCount stays truthful", async () => {
    actingUserId = liker;
    const parent = await addComment(postId, "Nice session");
    expect(parent.ok).toBe(true);
    const parentId = parent.ok ? parent.data!.commentId : "";

    await addComment(postId, "Thanks!", parentId);
    await addComment(postId, "Agreed", parentId);

    let c = await counts();
    expect(c.comments).toBe(3);

    // Deleting the parent takes its two replies with it — a count of 1 after
    // deleting a thread of 3 would be a lie on every feed card.
    await deleteComment(parentId);

    c = await counts();
    const remaining = await db
      .select({ id: postComment.id })
      .from(postComment)
      .where(eq(postComment.postId, postId));
    expect(remaining).toHaveLength(0);
    expect(c.comments).toBe(0);
  });
});
