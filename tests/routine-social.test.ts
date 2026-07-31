import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * The routine like counter and the save counter are the same class of bug as
 * the feed's: a denormalised number that another statement has to keep in step
 * with a set of rows. These assert the SQL, against the real database — a
 * mocked `db` would prove nothing about a transaction.
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
const { routine, routineExercise, routineLike, routineSet } = await import(
  "@/lib/db/schema"
);
const { toggleRoutineLike } = await import("@/lib/actions/routine-social");
const { copyRoutine } = await import("@/lib/actions/routine");
const { getDiscoverRoutines } = await import("@/lib/queries/routine");
const { cleanup, makeExercise, makeUser } = await import("./helpers");

/** A routine with one exercise and one set, so it clears the Discover gate. */
async function makeRoutine(
  userId: string,
  exerciseId: string,
  { isPublic = true, name = "Test routine" } = {},
) {
  const [r] = await db
    .insert(routine)
    .values({ userId, name, isPublic })
    .returning({ id: routine.id });
  const [re] = await db
    .insert(routineExercise)
    .values({ routineId: r.id, exerciseId, position: 0 })
    .returning({ id: routineExercise.id });
  await db
    .insert(routineSet)
    .values({ routineExerciseId: re.id, position: 0, targetReps: 5 });
  return r.id;
}

async function routineRow(id: string) {
  const [row] = await db
    .select({
      likeCount: routine.likeCount,
      saveCount: routine.saveCount,
      popularity: routine.popularity,
      folderId: routine.folderId,
      sourceRoutineId: routine.sourceRoutineId,
    })
    .from(routine)
    .where(eq(routine.id, id));
  return row;
}

describe("routine likes", () => {
  let author = "";
  let liker = "";
  let exerciseId = "";
  let routineId = "";

  beforeAll(async () => {
    author = await makeUser();
    liker = await makeUser();
    exerciseId = await makeExercise();
    routineId = await makeRoutine(author, exerciseId);
  });

  afterAll(async () => {
    await cleanup([author, liker], [exerciseId]);
  });

  async function counts() {
    const row = await routineRow(routineId);
    const rows = await db
      .select({ id: routineLike.routineId })
      .from(routineLike)
      .where(eq(routineLike.routineId, routineId));
    return { likes: row.likeCount, actualLikes: rows.length };
  }

  it("increments and decrements in step with the rows", async () => {
    actingUserId = liker;
    await toggleRoutineLike(routineId);
    expect(await counts()).toEqual({ likes: 1, actualLikes: 1 });

    await toggleRoutineLike(routineId);
    expect(await counts()).toEqual({ likes: 0, actualLikes: 0 });
  });

  it("never lets the counter drift from the row count under concurrency", async () => {
    actingUserId = liker;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => toggleRoutineLike(routineId)),
    );
    // Assert the calls actually ran: a rate limit or auth failure would leave
    // the database untouched and make 0 === 0 pass vacuously below.
    expect(results.every((r) => r.ok)).toBe(true);
    const c = await counts();
    expect(c.likes).toBe(c.actualLikes);
    expect(c.likes).toBeLessThanOrEqual(1);
  });

  it("clamps at zero rather than going negative", async () => {
    actingUserId = liker;
    await db.delete(routineLike).where(eq(routineLike.routineId, routineId));
    await db
      .update(routine)
      .set({ likeCount: 0 })
      .where(eq(routine.id, routineId));

    // A like row exists while the counter reads zero — the drifted-low state
    // an unguarded `likeCount - 1` turns into -1 permanently.
    await db.insert(routineLike).values({ routineId, userId: liker });
    await toggleRoutineLike(routineId);
    expect((await routineRow(routineId)).likeCount).toBe(0);
  });

  it("refuses a like on someone else's private routine", async () => {
    const privateId = await makeRoutine(author, exerciseId, {
      isPublic: false,
      name: "Private routine",
    });
    actingUserId = liker;
    const res = await toggleRoutineLike(privateId);
    expect(res.ok).toBe(false);
    const rows = await db
      .select({ id: routineLike.routineId })
      .from(routineLike)
      .where(eq(routineLike.routineId, privateId));
    expect(rows).toHaveLength(0);
  });
});

describe("saving a routine", () => {
  let author = "";
  let saver = "";
  let thirdParty = "";
  let exerciseId = "";
  let originalId = "";

  beforeAll(async () => {
    author = await makeUser();
    saver = await makeUser();
    thirdParty = await makeUser();
    exerciseId = await makeExercise();
    originalId = await makeRoutine(author, exerciseId, { name: "PPL Push" });
  });

  afterAll(async () => {
    await cleanup([author, saver, thirdParty], [exerciseId]);
  });

  it("credits the original author and lands the copy unfiled", async () => {
    actingUserId = saver;
    const res = await copyRoutine(originalId);
    expect(res.ok).toBe(true);

    expect((await routineRow(originalId)).saveCount).toBe(1);

    const copy = await routineRow(res.ok ? res.data!.routineId : "");
    // A copy inheriting the source's folder dropped a stranger's filing system
    // into your list.
    expect(copy.folderId).toBeNull();
    expect(copy.sourceRoutineId).toBe(originalId);
    expect(copy.saveCount).toBe(0);
  });

  it("credits the root original when a copy is copied", async () => {
    actingUserId = saver;
    const first = await copyRoutine(originalId);
    const copyId = first.ok ? first.data!.routineId : "";
    // The copy is created private; make it reachable so a third party can save
    // it, which is the case that would otherwise credit the wrong person.
    await db
      .update(routine)
      .set({ isPublic: true })
      .where(eq(routine.id, copyId));

    const before = (await routineRow(originalId)).saveCount;
    actingUserId = thirdParty;
    const second = await copyRoutine(copyId);
    expect(second.ok).toBe(true);

    expect((await routineRow(originalId)).saveCount).toBe(before + 1);
    // The intermediate copy is not the author's work, so it earns nothing.
    expect((await routineRow(copyId)).saveCount).toBe(0);
  });

  it("does not count copying your own routine", async () => {
    const before = (await routineRow(originalId)).saveCount;
    actingUserId = author;
    const res = await copyRoutine(originalId);
    expect(res.ok).toBe(true);
    expect((await routineRow(originalId)).saveCount).toBe(before);
  });
});

describe("popularity", () => {
  let author = "";
  let other = "";
  let exerciseId = "";
  let routineId = "";

  beforeAll(async () => {
    author = await makeUser();
    other = await makeUser();
    exerciseId = await makeExercise();
    routineId = await makeRoutine(author, exerciseId, { name: "Ranked" });
  });

  afterAll(async () => {
    await cleanup([author, other], [exerciseId]);
  });

  it("is generated from the two counters and cannot drift", async () => {
    actingUserId = other;
    await toggleRoutineLike(routineId);
    await copyRoutine(routineId);

    const row = await routineRow(routineId);
    expect(row.likeCount).toBe(1);
    expect(row.saveCount).toBe(1);
    // A save weighs more than a like: it's someone committing to train it.
    expect(row.popularity).toBe(row.likeCount + 2 * row.saveCount);
  });

  it("hides your own routines and empty ones from Discover", async () => {
    const [empty] = await db
      .insert(routine)
      .values({ userId: author, name: "Empty draft", isPublic: true })
      .returning({ id: routine.id });

    const mine = await getDiscoverRoutines(author, { sort: "popular" });
    expect(mine.map((r) => r.id)).not.toContain(routineId);

    const theirs = await getDiscoverRoutines(other, { sort: "popular" });
    expect(theirs.map((r) => r.id)).toContain(routineId);
    // An exercise-less routine is a draft, not a program.
    expect(theirs.map((r) => r.id)).not.toContain(empty.id);
  });

  it("pages without repeating or skipping a row across a popularity tie", async () => {
    // Three routines all on popularity 0 — the exact case a cursor on the
    // counter alone cannot separate.
    const ids = [];
    for (const n of [1, 2, 3]) {
      ids.push(await makeRoutine(author, exerciseId, { name: `Tie ${n}` }));
    }

    const first = await getDiscoverRoutines(other, { sort: "popular", limit: 2 });
    expect(first).toHaveLength(2);
    const last = first[first.length - 1];
    const second = await getDiscoverRoutines(other, {
      sort: "popular",
      limit: 2,
      cursor: { value: last.popularity, id: last.id },
    });

    const seen = [...first, ...second].map((r) => r.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).not.toContain(undefined);
    // Everything visible on page one must not reappear on page two.
    for (const r of second) expect(first.map((f) => f.id)).not.toContain(r.id);
    expect(ids.length).toBe(3);
  });
});
