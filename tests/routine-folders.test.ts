import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";

/**
 * Folders became a table so they could be renamed, ordered and deleted without
 * rewriting their members. The properties worth pinning are the destructive
 * ones: a delete that unfiles rather than cascades, a reorder that can't be
 * half-applied, and a uniqueness rule that survives case.
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
const { routine, routineExercise, routineFolder, workout } = await import(
  "@/lib/db/schema"
);
const {
  createFolder,
  deleteFolder,
  moveRoutineToFolder,
  renameFolder,
  reorderFolders,
  reorderRoutinesInFolder,
  setFolderRotation,
} = await import("@/lib/actions/routine-folder");
const { getFolders } = await import("@/lib/queries/routine");
const { cleanup, makeExercise, makeUser } = await import("./helpers");

async function makeRoutine(userId: string, exerciseId: string, name: string) {
  const [r] = await db
    .insert(routine)
    .values({ userId, name })
    .returning({ id: routine.id });
  await db
    .insert(routineExercise)
    .values({ routineId: r.id, exerciseId, position: 0 });
  return r.id;
}

async function newFolder(name: string) {
  const res = await createFolder({ name });
  if (!res.ok) throw new Error(`fixture: ${res.error}`);
  return res.data!.folderId;
}

describe("folder lifecycle", () => {
  let me = "";
  let other = "";
  let exerciseId = "";

  beforeAll(async () => {
    me = await makeUser();
    other = await makeUser();
    exerciseId = await makeExercise();
  });

  afterAll(async () => {
    await cleanup([me, other], [exerciseId]);
  });

  it("unfiles its routines on delete instead of cascading", async () => {
    actingUserId = me;
    const folderId = await newFolder("Delete me");
    const routineId = await makeRoutine(me, exerciseId, "Keep me");
    expect((await moveRoutineToFolder(routineId, folderId)).ok).toBe(true);

    expect((await deleteFolder(folderId)).ok).toBe(true);

    // A cascade here would take the routine — and with it every workout logged
    // from it — for what the user thinks is tidying up.
    const [row] = await db
      .select({ id: routine.id, folderId: routine.folderId })
      .from(routine)
      .where(eq(routine.id, routineId));
    expect(row).toBeDefined();
    expect(row.folderId).toBeNull();
  });

  it("folds case when deciding a name is taken, per user", async () => {
    actingUserId = me;
    await newFolder("PPL");
    // The old free-text column let "PPL" and "ppl" become two folders that
    // sorted apart and could never be merged.
    const dupe = await createFolder({ name: "ppl" });
    expect(dupe.ok).toBe(false);

    // Uniqueness is per user, not global.
    actingUserId = other;
    const theirs = await createFolder({ name: "PPL" });
    expect(theirs.ok).toBe(true);
  });

  it("refuses to rename or delete another user's folder", async () => {
    actingUserId = other;
    const theirFolder = await newFolder("Not yours");

    actingUserId = me;
    expect((await renameFolder(theirFolder, "Mine now")).ok).toBe(false);
    expect((await deleteFolder(theirFolder)).ok).toBe(false);
    expect((await setFolderRotation(theirFolder, true)).ok).toBe(false);

    const [row] = await db
      .select({ name: routineFolder.name })
      .from(routineFolder)
      .where(eq(routineFolder.id, theirFolder));
    expect(row.name).toBe("Not yours");
  });

  it("rejects a reorder batch containing someone else's id, whole", async () => {
    actingUserId = me;
    const a = await newFolder("Order A");
    const b = await newFolder("Order B");
    actingUserId = other;
    const theirs = await newFolder("Order theirs");

    actingUserId = me;
    const res = await reorderFolders([b, theirs, a]);
    expect(res.ok).toBe(false);

    // Writing the ids that did belong to the caller and skipping the rest
    // would leave a half-applied order nobody asked for.
    const rows = await db
      .select({ id: routineFolder.id, position: routineFolder.position })
      .from(routineFolder)
      .where(eq(routineFolder.userId, me));
    const byId = new Map(rows.map((r) => [r.id, r.position]));
    expect(byId.get(a)).toBeLessThan(byId.get(b)!);
  });

  it("applies a valid reorder in the order given", async () => {
    actingUserId = me;
    const rows = await db
      .select({ id: routineFolder.id })
      .from(routineFolder)
      .where(eq(routineFolder.userId, me))
      .orderBy(asc(routineFolder.position));
    const reversed = rows.map((r) => r.id).reverse();

    expect((await reorderFolders(reversed)).ok).toBe(true);

    const after = await db
      .select({ id: routineFolder.id })
      .from(routineFolder)
      .where(eq(routineFolder.userId, me))
      .orderBy(asc(routineFolder.position));
    expect(after.map((r) => r.id)).toEqual(reversed);
  });

  it("refuses to reorder routines that aren't in the folder", async () => {
    actingUserId = me;
    const folderId = await newFolder("Reorder scope");
    const inside = await makeRoutine(me, exerciseId, "Inside");
    const outside = await makeRoutine(me, exerciseId, "Outside");
    await moveRoutineToFolder(inside, folderId);

    // Otherwise a reorder doubles as an unchecked move.
    const res = await reorderRoutinesInFolder(folderId, [outside, inside]);
    expect(res.ok).toBe(false);

    const [row] = await db
      .select({ folderId: routine.folderId })
      .from(routine)
      .where(eq(routine.id, outside));
    expect(row.folderId).toBeNull();
  });

  it("refuses to file a routine into someone else's folder", async () => {
    actingUserId = other;
    const theirFolder = await newFolder("Their drawer");

    actingUserId = me;
    const routineId = await makeRoutine(me, exerciseId, "Mine");
    expect((await moveRoutineToFolder(routineId, theirFolder)).ok).toBe(false);

    const [row] = await db
      .select({ folderId: routine.folderId })
      .from(routine)
      .where(eq(routine.id, routineId));
    expect(row.folderId).toBeNull();
  });
});

describe("program rotation", () => {
  let me = "";
  let exerciseId = "";
  let folderId = "";
  let push = "";
  let pull = "";
  let legs = "";

  beforeAll(async () => {
    me = await makeUser();
    exerciseId = await makeExercise();
    actingUserId = me;
    folderId = await newFolder("PPL");
    push = await makeRoutine(me, exerciseId, "Push");
    pull = await makeRoutine(me, exerciseId, "Pull");
    legs = await makeRoutine(me, exerciseId, "Legs");
    for (const id of [push, pull, legs]) {
      await moveRoutineToFolder(id, folderId);
    }
    await setFolderRotation(folderId, true);
  });

  afterAll(async () => {
    await cleanup([me], [exerciseId]);
  });

  async function nextUp() {
    const folders = await getFolders(me);
    return folders.find((f) => f.id === folderId);
  }

  /** A finished workout logged against one of the folder's routines. */
  async function finish(routineId: string, endedAt: Date) {
    await db.insert(workout).values({
      userId: me,
      routineId,
      name: "Session",
      startedAt: new Date(endedAt.getTime() - 3_600_000),
      endedAt,
      durationSeconds: 3600,
    });
  }

  it("starts at the first routine when the folder has never been trained", async () => {
    const f = await nextUp();
    expect(f?.routineCount).toBe(3);
    expect(f?.nextRoutineId).toBe(push);
    expect(f?.nextRoutineName).toBe("Push");
  });

  it("advances past whatever was last finished", async () => {
    await finish(push, new Date(Date.now() - 2 * 86_400_000));
    expect((await nextUp())?.nextRoutineId).toBe(pull);

    await finish(pull, new Date(Date.now() - 86_400_000));
    expect((await nextUp())?.nextRoutineId).toBe(legs);
  });

  it("wraps to the start at the end of the cycle", async () => {
    await finish(legs, new Date());
    expect((await nextUp())?.nextRoutineId).toBe(push);
  });

  it("ignores a workout still in progress", async () => {
    // An unfinished session hasn't happened yet; advancing on it would skip a
    // day the moment someone opened a routine by mistake.
    await db.insert(workout).values({
      userId: me,
      routineId: push,
      name: "Open session",
      startedAt: new Date(),
      endedAt: null,
    });
    expect((await nextUp())?.nextRoutineId).toBe(push);
  });

  it("reports nothing up next once rotation is switched off", async () => {
    expect((await setFolderRotation(folderId, false)).ok).toBe(true);
    const f = await nextUp();
    expect(f?.rotation).toBe(false);
    expect(f?.nextRoutineId).toBeNull();
  });
});
