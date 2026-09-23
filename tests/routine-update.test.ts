import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";

/**
 * "Update routines with AI": a model edits routines the lifter already has and
 * the answer is applied onto them. What matters is what a reviewer can't see
 * from the happy path — that the routine is edited in place rather than
 * duplicated, that a name match can only ever reach your own routines, and that
 * an exercise named like a built-in binds to it instead of minting a twin.
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
const { exercise, routine, routineExercise, routineFolder } = await import(
  "@/lib/db/schema"
);
const { createRoutine } = await import("@/lib/actions/routine");
const { applyRoutineUpdate, getRoutineUpdatePrompt, previewRoutineUpdate } =
  await import("@/lib/actions/routine-transfer");
const { parseRoutineUpdate } = await import("@/lib/routine-transfer");
const { cleanup, makeUser } = await import("./helpers");

const users: string[] = [];
let me = "";
let stranger = "";
let bench: { id: string; slug: string; name: string };
let other: { id: string; slug: string; name: string };

type Ok<T> = { ok: true; data: T };

async function routinesOf(userId: string) {
  return db.select().from(routine).where(eq(routine.userId, userId));
}

async function exerciseIdsOf(routineId: string) {
  const rows = await db
    .select({ id: routineExercise.exerciseId })
    .from(routineExercise)
    .where(eq(routineExercise.routineId, routineId))
    .orderBy(routineExercise.position);
  return rows.map((r) => r.id);
}

async function make(userId: string, name: string, folderId: string | null = null) {
  actingUserId = userId;
  const res = await createRoutine({
    name,
    notes: null,
    folderId,
    isPublic: true,
    exercises: [
      {
        exerciseId: bench.id,
        restSeconds: 120,
        sets: [{ setType: "normal", targetWeightKg: 60, targetReps: 8 }],
      },
    ],
  });
  expect(res.ok).toBe(true);
  return (res as Ok<{ routineId: string }>).data.routineId;
}

/** The embedded current-state document, exactly as a model would copy it. */
async function promptDoc(userId: string, ids: string[]) {
  actingUserId = userId;
  const res = await getRoutineUpdatePrompt(ids);
  expect(res.ok).toBe(true);
  const prompt = (res as Ok<{ prompt: string }>).data.prompt;
  const start = prompt.indexOf("{");
  const end = prompt.indexOf("\n}\n") + 2;
  const parsed = parseRoutineUpdate(prompt.slice(start, end));
  expect(parsed.ok).toBe(true);
  return { prompt, doc: (parsed as { ok: true; doc: any }).doc }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeAll(async () => {
  me = await makeUser();
  stranger = await makeUser();
  users.push(me, stranger);
  const seeded = await db
    .select({ id: exercise.id, slug: exercise.slug, name: exercise.name })
    .from(exercise)
    .where(and(isNull(exercise.ownerId), isNull(exercise.archivedAt)))
    .limit(2);
  bench = seeded[0] as typeof bench;
  other = seeded[1] as typeof other;
});

afterAll(async () => {
  await cleanup(users);
});

describe("routine update prompt", () => {
  it("carries the chosen routines with their exact names and slugs", async () => {
    const a = await make(me, "Upper A — Heavy");
    const { prompt, doc } = await promptDoc(me, [a]);
    expect(prompt).toContain('"Upper A — Heavy"');
    expect(doc.routines[0].exercises[0].exercise.slug).toBe(bench.slug);
    expect(prompt).toContain(`${bench.slug} · ${bench.name}`);
  });

  it("refuses somebody else's routine", async () => {
    const theirs = await make(stranger, "Their Push");
    actingUserId = me;
    const res = await getRoutineUpdatePrompt([theirs]);
    expect(res.ok).toBe(false);
  });
});

describe("applying an update", () => {
  it("edits the routine in place and keeps where you filed it", async () => {
    actingUserId = me;
    const [folder] = await db
      .insert(routineFolder)
      .values({ userId: me, name: "Block 1", position: 0 })
      .returning({ id: routineFolder.id });
    const id = await make(me, "Push Day", folder.id);
    const before = (await routinesOf(me)).length;

    const { doc } = await promptDoc(me, [id]);
    const push = doc.routines[0];
    push.exercises[0].sets.push({ ...push.exercises[0].sets[0], targetReps: 6 });
    // A built-in named from memory, with no slug: must bind, not clone.
    push.exercises.push({
      ...push.exercises[0],
      exercise: { ...push.exercises[0].exercise, slug: null, name: other.name.toUpperCase() },
    });
    const json = JSON.stringify(doc);

    const preview = await previewRoutineUpdate(json);
    expect(preview.ok).toBe(true);
    const p = (preview as Ok<import("@/lib/actions/routine-transfer").UpdatePreview>).data;
    expect(p.routines[0].status).toBe("update");
    expect(p.newExercises).toEqual([]);
    expect(p.routines[0].diff!.lines.map((l) => l.kind)).toEqual(["changed", "added"]);

    const res = await applyRoutineUpdate(json);
    expect(res.ok).toBe(true);
    const after = await routinesOf(me);
    expect(after).toHaveLength(before);
    const row = after.find((r) => r.id === id)!;
    expect(row.folderId).toBe(folder.id);
    expect(row.isPublic).toBe(true);
    expect(await exerciseIdsOf(id)).toEqual([bench.id, other.id]);

    const customs = await db.select().from(exercise).where(eq(exercise.ownerId, me));
    expect(customs).toHaveLength(0);
  });

  it("matches a name regardless of case and leaves untouched routines alone", async () => {
    const id = await make(me, "Legs");
    const { doc } = await promptDoc(me, [id]);
    doc.routines[0].name = "legs";
    const res = await applyRoutineUpdate(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    // Only the capitalisation differed, so it counts as a change to write…
    expect((res as Ok<{ updated: number }>).data.updated).toBe(1);
    expect((await routinesOf(me)).filter((r) => r.name.toLowerCase() === "legs")).toHaveLength(1);

    // …and sending the same thing again changes nothing at all.
    const again = await previewRoutineUpdate(JSON.stringify(doc));
    expect((again as Ok<{ routines: { status: string }[] }>).data.routines[0].status).toBe(
      "unchanged",
    );
  });

  it("creates a routine for a name you don't have", async () => {
    const id = await make(me, "Pull Day");
    const { doc } = await promptDoc(me, [id]);
    doc.routines.push({ ...doc.routines[0], name: "Arms (new)" });
    const before = (await routinesOf(me)).length;
    const res = await applyRoutineUpdate(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    expect((res as Ok<{ created: number }>).data.created).toBe(1);
    const after = await routinesOf(me);
    expect(after).toHaveLength(before + 1);
    const arms = after.find((r) => r.name === "Arms (new)")!;
    expect(arms.isPublic).toBe(false);
    expect(arms.folderId).toBeNull();
  });

  it("never reaches another user's routine of the same name", async () => {
    const theirs = await make(stranger, "Shared Name");
    const mine = await make(me, "Shared Name");
    const { doc } = await promptDoc(me, [mine]);
    doc.routines[0].exercises[0].restSeconds = 45;
    const res = await applyRoutineUpdate(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    const [theirRe] = await db
      .select({ rest: routineExercise.restSeconds })
      .from(routineExercise)
      .where(eq(routineExercise.routineId, theirs));
    expect(theirRe.rest).toBe(120);
  });

  it("refuses to guess between two of your routines with one name", async () => {
    const a = await make(me, "Twin");
    await make(me, "twin");
    const { doc } = await promptDoc(me, [a]);
    const res = await applyRoutineUpdate(JSON.stringify(doc));
    expect(res.ok === false && res.error).toMatch(/rename one first/);
  });
});
