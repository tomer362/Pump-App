import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

/**
 * Routine export and import as a JSON file.
 *
 * The properties worth pinning are the ones a reviewer can't see by reading the
 * happy path: that a document can't smuggle a field into the library, that an
 * import binds every exercise to a row the importer actually owns, and that
 * importing the same file twice doesn't fork someone's exercise list.
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
const { exercise, routine, routineExercise, routineSet } = await import(
  "@/lib/db/schema"
);
const { createRoutine } = await import("@/lib/actions/routine");
const { exportRoutineFile, importRoutine, previewRoutineImport } = await import(
  "@/lib/actions/routine-transfer"
);
const { cleanup, makeUser } = await import("./helpers");

const users: string[] = [];
let author = "";
let importer = "";
let builtinId = "";
let builtinSlug = "";
let customId = "";

/** The exercises a routine actually points at, in order. */
async function exercisesOf(routineId: string) {
  return db
    .select({
      exerciseId: routineExercise.exerciseId,
      name: exercise.name,
      ownerId: exercise.ownerId,
      slug: exercise.slug,
      importedAt: exercise.importedAt,
      videoUrl: exercise.videoUrl,
    })
    .from(routineExercise)
    .innerJoin(exercise, eq(exercise.id, routineExercise.exerciseId))
    .where(eq(routineExercise.routineId, routineId))
    .orderBy(routineExercise.position);
}

async function myCustoms(userId: string) {
  return db.select().from(exercise).where(eq(exercise.ownerId, userId));
}

beforeAll(async () => {
  author = await makeUser();
  importer = await makeUser();
  users.push(author, importer);

  // A real seeded built-in, so the slug path is exercised against the library
  // as it actually ships rather than a fixture that can't drift from it.
  const [seeded] = await db
    .select({ id: exercise.id, slug: exercise.slug })
    .from(exercise)
    .where(and(isNull(exercise.ownerId), isNull(exercise.archivedAt)))
    .limit(1);
  builtinId = seeded.id;
  builtinSlug = seeded.slug!;

  const [custom] = await db
    .insert(exercise)
    .values({
      name: `Dana's Cable Curl ${Date.now()}`,
      primaryMuscle: "biceps",
      equipment: "cable",
      trackingType: "weight_reps",
      instructions: "Elbows pinned.",
      ownerId: author,
      // Only curated ids ever reach this column; it must not survive an export.
      videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    })
    .returning({ id: exercise.id });
  customId = custom.id;
});

afterAll(async () => {
  await cleanup(users);
});

async function authorRoutine(name: string) {
  actingUserId = author;
  const res = await createRoutine({
    name,
    notes: "Long rests on the first two.",
    isPublic: true,
    exercises: [
      {
        exerciseId: builtinId,
        restSeconds: 150,
        sets: [
          { setType: "warmup", targetWeightKg: 40, targetReps: 10 },
          { setType: "normal", targetWeightKg: 62.5, targetReps: 8 },
        ],
      },
      {
        exerciseId: customId,
        sets: [{ setType: "normal", targetWeightKg: 20, targetReps: 12 }],
      },
    ],
  });
  expect(res.ok).toBe(true);
  return (res as { data: { routineId: string } }).data.routineId;
}

async function exportAs(userId: string, routineId: string) {
  actingUserId = userId;
  const res = await exportRoutineFile(routineId);
  return res;
}

describe("routine export", () => {
  it("writes a portable document with no ids and nothing vetted", async () => {
    const id = await authorRoutine("Push A");
    const res = await exportAs(author, id);
    expect(res.ok).toBe(true);
    const { filename, json } = (res as { data: { filename: string; json: string } })
      .data;

    expect(filename).toMatch(/^pump-push-a-\d{4}-\d{2}-\d{2}\.json$/);

    const doc = JSON.parse(json);
    expect(doc.format).toBe("pump.routine");
    expect(doc.formatVersion).toBe(1);

    // No uuid of any kind anywhere in the document.
    expect(json).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(json).not.toContain("youtube.com");
    expect(json).not.toContain(author);

    const [first, second] = doc.routine.exercises;
    expect(first.exercise.slug).toBe(builtinSlug);
    // A custom carries its definition instead of a slug.
    expect(second.exercise.slug).toBeNull();
    expect(second.exercise.primaryMuscle).toBe("biceps");
    expect(second.exercise).not.toHaveProperty("videoUrl");

    // Kilograms, exactly, whatever the exporter's display unit is.
    expect(first.sets[1].targetWeightKg).toBe(62.5);
  });

  it("refuses someone else's private routine and allows a public one", async () => {
    const id = await authorRoutine("Private Push");
    actingUserId = author;
    await db.update(routine).set({ isPublic: false }).where(eq(routine.id, id));

    const denied = await exportAs(importer, id);
    expect(denied.ok).toBe(false);
    expect((denied as { error: string }).error).toMatch(/private/i);

    await db.update(routine).set({ isPublic: true }).where(eq(routine.id, id));
    const allowed = await exportAs(importer, id);
    expect(allowed.ok).toBe(true);
  });
});

describe("routine import", () => {
  it("binds every exercise to a row the importer owns, and clones the custom", async () => {
    const id = await authorRoutine("Push B");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    actingUserId = importer;
    const before = (await myCustoms(importer)).length;
    const res = await importRoutine(json);
    expect(res.ok).toBe(true);
    const { routineId, created } = (
      res as { data: { routineId: string; created: number } }
    ).data;
    expect(created).toBe(1);

    const rows = await exercisesOf(routineId);
    expect(rows).toHaveLength(2);
    // The whole point: nothing points at a row belonging to someone else.
    for (const r of rows) {
      expect(r.ownerId === null || r.ownerId === importer).toBe(true);
    }

    // The built-in resolved to the shared library row, not a copy of it.
    expect(rows[0].exerciseId).toBe(builtinId);
    expect(rows[0].ownerId).toBeNull();

    // The custom became the importer's own, flagged and stripped.
    expect(rows[1].exerciseId).not.toBe(customId);
    expect(rows[1].ownerId).toBe(importer);
    expect(rows[1].importedAt).not.toBeNull();
    expect(rows[1].slug).toBeNull();
    expect(rows[1].videoUrl).toBeNull();

    expect((await myCustoms(importer)).length).toBe(before + 1);

    // The imported routine is private and unfiled — an import is not a
    // publication, and the file's author has no say over your filing.
    const [copy] = await db
      .select()
      .from(routine)
      .where(eq(routine.id, routineId));
    expect(copy.isPublic).toBe(false);
    expect(copy.folderId).toBeNull();
    expect(copy.sourceRoutineId).toBeNull();

    // Targets survive the round trip exactly.
    const sets = await db
      .select({ w: routineSet.targetWeightKg })
      .from(routineSet)
      .innerJoin(
        routineExercise,
        eq(routineExercise.id, routineSet.routineExerciseId),
      )
      .where(eq(routineExercise.routineId, routineId));
    expect(sets.map((s) => s.w)).toContain(62.5);
  });

  it("importing the same file twice makes two routines and one clone", async () => {
    const id = await authorRoutine("Push C");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    // A fresh importer: the point is that the *second* import adds nothing,
    // which only means something if the first one had something to add.
    const twice = await makeUser();
    users.push(twice);
    actingUserId = twice;

    const a = await importRoutine(json);
    const b = await importRoutine(json);
    expect(a.ok && b.ok).toBe(true);

    // One new row the first time, none the second.
    expect((await myCustoms(twice)).length).toBe(1);
    expect((a as { data: { created: number } }).data.created).toBe(1);
    expect((b as { data: { created: number } }).data.created).toBe(0);

    const rowsA = await exercisesOf(
      (a as { data: { routineId: string } }).data.routineId,
    );
    const rowsB = await exercisesOf(
      (b as { data: { routineId: string } }).data.routineId,
    );
    expect(rowsA[1].exerciseId).toBe(rowsB[1].exerciseId);

    // Two routines, though — importing twice is not deduplicated.
    const mine = await db
      .select({ id: routine.id })
      .from(routine)
      .where(eq(routine.userId, twice));
    expect(mine).toHaveLength(2);
  });

  it("resolves a built-in by slug, not by name", async () => {
    const id = await authorRoutine("Push D");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    const doc = JSON.parse(json);
    doc.routine.exercises[0].exercise.name = "Something Else Entirely";
    doc.routine.name = "Renamed Builtin";

    actingUserId = importer;
    const before = (await myCustoms(importer)).length;
    const res = await importRoutine(JSON.stringify(doc));
    expect(res.ok).toBe(true);

    const rows = await exercisesOf(
      (res as { data: { routineId: string } }).data.routineId,
    );
    // Still the seeded row, and no clone minted for the renamed built-in.
    expect(rows[0].exerciseId).toBe(builtinId);
    expect((await myCustoms(importer)).length).toBe(before);
  });

  it("degrades an unknown slug to a clone rather than failing the import", async () => {
    const id = await authorRoutine("Push E");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    const doc = JSON.parse(json);
    doc.routine.exercises[0].exercise.slug = "no-such-movement-anywhere";
    doc.routine.exercises[0].exercise.name = `Retired Lift ${Date.now()}`;

    actingUserId = importer;
    const res = await importRoutine(JSON.stringify(doc));
    expect(res.ok).toBe(true);

    const rows = await exercisesOf(
      (res as { data: { routineId: string } }).data.routineId,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].ownerId).toBe(importer);
    expect(rows[0].slug).toBeNull();
  });

  it("mints one row when a document names the same custom twice", async () => {
    actingUserId = importer;
    const name = `Twice Named ${Date.now()}`;
    const doc = {
      format: "pump.routine",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      routine: {
        name: "Doubled",
        notes: null,
        exercises: [0, 1].map(() => ({
          exercise: {
            slug: null,
            name,
            primaryMuscle: "chest",
            secondaryMuscles: [],
            equipment: "dumbbell",
            trackingType: "weight_reps",
            instructions: null,
          },
          notes: null,
          restSeconds: null,
          supersetGroup: null,
          intervalWorkSeconds: null,
          intervalRestSeconds: null,
          sets: [
            {
              setType: "normal",
              targetWeightKg: 10,
              targetReps: 10,
              targetSeconds: null,
              targetDistanceM: null,
              targetRpe: null,
            },
          ],
        })),
      },
    };

    const res = await importRoutine(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    const rows = await exercisesOf(
      (res as { data: { routineId: string } }).data.routineId,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].exerciseId).toBe(rows[1].exerciseId);
  });
});

describe("import rejects what it should", () => {
  const base = () => ({
    format: "pump.routine",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    routine: {
      name: "Hostile",
      notes: null,
      exercises: [
        {
          exercise: {
            slug: null,
            name: `Hostile Lift ${Date.now()}`,
            primaryMuscle: "chest",
            secondaryMuscles: [],
            equipment: "barbell",
            trackingType: "weight_reps",
            instructions: null,
          },
          notes: null,
          restSeconds: null,
          supersetGroup: null,
          intervalWorkSeconds: null,
          intervalRestSeconds: null,
          sets: [],
        },
      ],
    },
  });

  it.each([
    ["not JSON at all", "just a string"],
    ["some other JSON file", JSON.stringify({ name: "pump", version: "1.0.0" })],
    [
      "a newer format version",
      JSON.stringify({ ...base(), formatVersion: 2 }),
    ],
    [
      "an unknown top-level key",
      JSON.stringify({ ...base(), extra: "smuggled" }),
    ],
    ["an oversized document", `"${"x".repeat(300_000)}"`],
  ])("refuses %s", async (_label, payload) => {
    actingUserId = importer;
    const res = await importRoutine(payload);
    expect(res.ok).toBe(false);
  });

  it.each(["videoUrl", "ownerId", "id", "archivedAt", "popularity"])(
    "refuses a document carrying %s on an exercise",
    async (field) => {
      actingUserId = importer;
      const doc = base();
      (doc.routine.exercises[0].exercise as Record<string, unknown>)[field] =
        field === "popularity" ? 9999 : "smuggled";
      const res = await importRoutine(JSON.stringify(doc));
      expect(res.ok).toBe(false);

      // And nothing was written on the way to refusing.
      const [row] = await db
        .select({ id: exercise.id })
        .from(exercise)
        .where(eq(exercise.name, doc.routine.exercises[0].exercise.name))
        .limit(1);
      expect(row).toBeUndefined();
    },
  );

  it("never credits anybody — saveCount and likeCount are untouched", async () => {
    const id = await authorRoutine("Push F");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    const before = await db
      .select({ id: routine.id, save: routine.saveCount, like: routine.likeCount })
      .from(routine)
      .where(inArray(routine.userId, [author, importer]));

    actingUserId = importer;
    expect((await importRoutine(json)).ok).toBe(true);

    const after = await db
      .select({ id: routine.id, save: routine.saveCount, like: routine.likeCount })
      .from(routine)
      .where(inArray(routine.userId, [author, importer]));

    const byId = new Map(after.map((r) => [r.id, r]));
    for (const b of before) {
      expect(byId.get(b.id)!.save).toBe(b.save);
      expect(byId.get(b.id)!.like).toBe(b.like);
    }
  });
});

describe("import preview", () => {
  it("says what the import will do, and writes nothing", async () => {
    const id = await authorRoutine("Push G");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    // A fresh importer, so the custom really is new to them.
    const fresh = await makeUser();
    users.push(fresh);
    actingUserId = fresh;

    const res = await previewRoutineImport(json);
    expect(res.ok).toBe(true);
    const p = (res as { data: import("@/lib/actions/routine-transfer").ImportPreview })
      .data;

    expect(p.name).toBe("Push G");
    expect(p.exerciseCount).toBe(2);
    expect(p.setCount).toBe(3);
    expect(p.newCustomCount).toBe(1);
    expect(p.exercises[0].resolution).toBe("builtin");
    expect(p.exercises[1].resolution).toBe("new");

    // Preview is a preview: no rows, no routine.
    expect(await myCustoms(fresh)).toHaveLength(0);
    const routines = await db
      .select({ id: routine.id })
      .from(routine)
      .where(eq(routine.userId, fresh));
    expect(routines).toHaveLength(0);
  });

  it("reports an archived match as restored, and the import un-archives it", async () => {
    const id = await authorRoutine("Push H");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;
    const customName = JSON.parse(json).routine.exercises[1].exercise.name;

    const fresh = await makeUser();
    users.push(fresh);
    actingUserId = fresh;

    // They already have one by that name, archived.
    const [own] = await db
      .insert(exercise)
      .values({
        name: customName,
        primaryMuscle: "biceps",
        equipment: "cable",
        trackingType: "weight_reps",
        ownerId: fresh,
        archivedAt: new Date(),
      })
      .returning({ id: exercise.id });

    const preview = await previewRoutineImport(json);
    expect(
      (preview as { data: import("@/lib/actions/routine-transfer").ImportPreview })
        .data.exercises[1].resolution,
    ).toBe("restored");
    // Still archived — the preview didn't do it.
    const [stillArchived] = await db
      .select({ archivedAt: exercise.archivedAt })
      .from(exercise)
      .where(eq(exercise.id, own.id));
    expect(stillArchived.archivedAt).not.toBeNull();

    const res = await importRoutine(json);
    expect(res.ok).toBe(true);
    const rows = await exercisesOf(
      (res as { data: { routineId: string } }).data.routineId,
    );
    // Reused their row rather than minting a second one by the same name.
    expect(rows[1].exerciseId).toBe(own.id);
    const [restored] = await db
      .select({ archivedAt: exercise.archivedAt })
      .from(exercise)
      .where(eq(exercise.id, own.id));
    expect(restored.archivedAt).toBeNull();
  });
});

describe("copyRoutine no longer hands out foreign rows", () => {
  it("clones the author's custom into the copier's library", async () => {
    const { copyRoutine } = await import("@/lib/actions/routine");
    const id = await authorRoutine("Copy Me");

    const copier = await makeUser();
    users.push(copier);
    actingUserId = copier;

    const res = await copyRoutine(id);
    expect(res.ok).toBe(true);
    const rows = await exercisesOf(
      (res as { data: { routineId: string } }).data.routineId,
    );

    for (const r of rows) {
      expect(r.ownerId === null || r.ownerId === copier).toBe(true);
    }
    expect(rows[0].exerciseId).toBe(builtinId);
    expect(rows[1].exerciseId).not.toBe(customId);

    const [clone] = await db
      .select()
      .from(exercise)
      .where(eq(exercise.id, rows[1].exerciseId));
    // In-database copies do have a source to point at, unlike file imports.
    expect(clone.sourceExerciseId).toBe(customId);
    expect(clone.importedAt).not.toBeNull();

    // A second copy of another routine using the same custom reuses the clone,
    // even after the copier renames it.
    await db
      .update(exercise)
      .set({ name: `My Own Name ${Date.now()}` })
      .where(eq(exercise.id, clone.id));

    const second = await authorRoutine("Copy Me Too");
    actingUserId = copier;
    const res2 = await copyRoutine(second);
    const rows2 = await exercisesOf(
      (res2 as { data: { routineId: string } }).data.routineId,
    );
    expect(rows2[1].exerciseId).toBe(clone.id);
  });

  it("un-archives the copier's clone when they copy it again", async () => {
    const { copyRoutine } = await import("@/lib/actions/routine");
    const id = await authorRoutine("Archive Me");

    const copier = await makeUser();
    users.push(copier);
    actingUserId = copier;

    const first = await copyRoutine(id);
    const rows = await exercisesOf(
      (first as { data: { routineId: string } }).data.routineId,
    );
    const cloneId = rows[1].exerciseId;
    await db
      .update(exercise)
      .set({ archivedAt: new Date() })
      .where(eq(exercise.id, cloneId));

    const again = await copyRoutine(id);
    const rows2 = await exercisesOf(
      (again as { data: { routineId: string } }).data.routineId,
    );
    expect(rows2[1].exerciseId).toBe(cloneId);
    const [row] = await db
      .select({ archivedAt: exercise.archivedAt })
      .from(exercise)
      .where(eq(exercise.id, cloneId));
    expect(row.archivedAt).toBeNull();
  });

  it("leaves a routine of your own alone", async () => {
    const { copyRoutine } = await import("@/lib/actions/routine");
    const id = await authorRoutine("Mine To Duplicate");
    actingUserId = author;

    const res = await copyRoutine(id);
    const rows = await exercisesOf(
      (res as { data: { routineId: string } }).data.routineId,
    );
    // No clone: they already own it.
    expect(rows[1].exerciseId).toBe(customId);
  });
});

describe("imported exercises and the default search scope", () => {
  it("is hidden from search until adopted, but always reachable by id", async () => {
    const { searchExercises, getExercisesByIds, getImportedMatches } =
      await import("@/lib/queries/exercise");
    const { adoptImportedExercise } = await import("@/lib/actions/exercise");

    const id = await authorRoutine("Scope Check");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;
    const customName = JSON.parse(json).routine.exercises[1].exercise.name;

    const fresh = await makeUser();
    users.push(fresh);
    actingUserId = fresh;
    expect((await importRoutine(json)).ok).toBe(true);

    const [clone] = await myCustoms(fresh);
    const matches = (rows: { id: string }[]) => rows.some((r) => r.id === clone.id);

    // Out of every list that feeds a picker...
    expect(matches(await searchExercises(fresh, { query: customName }))).toBe(false);
    expect(
      matches(await searchExercises(fresh, { query: customName, scope: "mine" })),
    ).toBe(false);
    // ...but in its own scope, in the hint probe, and resolvable by id.
    expect(
      matches(await searchExercises(fresh, { query: customName, scope: "imported" })),
    ).toBe(true);
    expect(matches(await getImportedMatches(fresh, { query: customName }))).toBe(
      true,
    );
    expect(matches(await getExercisesByIds(fresh, [clone.id]))).toBe(true);

    // Adopting it puts it in the library proper, for good.
    expect((await adoptImportedExercise(clone.id)).ok).toBe(true);
    expect(matches(await searchExercises(fresh, { query: customName }))).toBe(true);
    expect(
      matches(await searchExercises(fresh, { query: customName, scope: "imported" })),
    ).toBe(false);
  });

  it("stays in Recent once it has actually been trained", async () => {
    const { getRecentExercises } = await import("@/lib/queries/exercise");
    const { makeFinishedWorkout } = await import("./helpers");

    const id = await authorRoutine("Recent Check");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    const fresh = await makeUser();
    users.push(fresh);
    actingUserId = fresh;
    expect((await importRoutine(json)).ok).toBe(true);
    const [clone] = await myCustoms(fresh);

    // Nothing logged yet, so nothing in Recent.
    expect(
      (await getRecentExercises(fresh)).some((r) => r.id === clone.id),
    ).toBe(false);

    await makeFinishedWorkout(fresh, clone.id, [{ weightKg: 20, reps: 12 }]);

    // Trained, so it belongs at the top of the picker — hidden-by-default must
    // never hide something the user has actually done.
    const recent = await getRecentExercises(fresh);
    expect(recent.some((r) => r.id === clone.id)).toBe(true);
    expect(recent.find((r) => r.id === clone.id)!.isImported).toBe(true);
  });

  it("shows an archived import in the archived scope", async () => {
    const { searchExercises } = await import("@/lib/queries/exercise");

    const id = await authorRoutine("Archive Scope");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    const fresh = await makeUser();
    users.push(fresh);
    actingUserId = fresh;
    expect((await importRoutine(json)).ok).toBe(true);
    const [clone] = await myCustoms(fresh);

    await db
      .update(exercise)
      .set({ archivedAt: new Date() })
      .where(eq(exercise.id, clone.id));

    const archived = await searchExercises(fresh, { scope: "archived" });
    expect(archived.some((r) => r.id === clone.id)).toBe(true);
  });

  it("editing an imported exercise adopts it", async () => {
    const { searchExercises } = await import("@/lib/queries/exercise");
    const { updateCustomExercise } = await import("@/lib/actions/exercise");

    const id = await authorRoutine("Edit Adopts");
    const { json } = (
      (await exportAs(author, id)) as { data: { json: string } }
    ).data;

    const fresh = await makeUser();
    users.push(fresh);
    actingUserId = fresh;
    expect((await importRoutine(json)).ok).toBe(true);
    const [clone] = await myCustoms(fresh);

    const renamed = `Renamed By Me ${Date.now()}`;
    const res = await updateCustomExercise({
      exerciseId: clone.id,
      name: renamed,
      primaryMuscle: "biceps",
      secondaryMuscles: [],
      equipment: "cable",
      trackingType: "weight_reps",
      instructions: null,
    });
    expect(res.ok).toBe(true);

    expect(
      (await searchExercises(fresh, { query: renamed })).some(
        (r) => r.id === clone.id,
      ),
    ).toBe(true);
  });

  it("getImportedMatches caps at the hint limit plus one", async () => {
    const { getImportedMatches } = await import("@/lib/queries/exercise");
    const { IMPORTED_HINT_LIMIT } = await import("@/lib/pagination");

    const fresh = await makeUser();
    users.push(fresh);
    const tag = `Capped${Date.now()}`;
    await db.insert(exercise).values(
      Array.from({ length: IMPORTED_HINT_LIMIT + 5 }, (_, i) => ({
        name: `${tag} ${i}`,
        primaryMuscle: "chest" as const,
        equipment: "barbell" as const,
        trackingType: "weight_reps" as const,
        ownerId: fresh,
        importedAt: new Date(),
      })),
    );

    const rows = await getImportedMatches(fresh, { query: tag });
    expect(rows).toHaveLength(IMPORTED_HINT_LIMIT + 1);
  });

  it("keyset paging over the imported scope terminates", async () => {
    const { searchExercisePage } = await import("@/lib/queries/exercise");

    const fresh = await makeUser();
    users.push(fresh);
    await db.insert(exercise).values(
      Array.from({ length: 7 }, (_, i) => ({
        name: `Paged Import ${Date.now()} ${i}`,
        primaryMuscle: "chest" as const,
        equipment: "barbell" as const,
        trackingType: "weight_reps" as const,
        ownerId: fresh,
        importedAt: new Date(),
      })),
    );

    const seen = new Set<string>();
    let cursor = null;
    for (let guard = 0; guard < 20; guard++) {
      const page = await searchExercisePage(fresh, {
        scope: "imported",
        limit: 3,
        after: cursor,
      });
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.cursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(seen.size).toBe(7);
  });
});

describe("the default-scope rule is the same everywhere", () => {
  it("replacement suggestions don't offer an unadopted import", async () => {
    const { getReplacementSuggestions } = await import("@/lib/queries/exercise");

    const fresh = await makeUser();
    users.push(fresh);

    const [source] = await db
      .select({ id: exercise.id, muscle: exercise.primaryMuscle })
      .from(exercise)
      .where(and(isNull(exercise.ownerId), eq(exercise.trackingType, "weight_reps")))
      .limit(1);

    const [hidden] = await db
      .insert(exercise)
      .values({
        name: `Suggested Import ${Date.now()}`,
        primaryMuscle: source.muscle,
        equipment: "barbell",
        trackingType: "weight_reps",
        ownerId: fresh,
        importedAt: new Date(),
      })
      .returning({ id: exercise.id });

    const suggestions = await getReplacementSuggestions(fresh, source.id, 200);
    expect(suggestions.some((s) => s.id === hidden.id)).toBe(false);

    // Adopting it makes it eligible, so the exclusion really is the flag and
    // not something else about the row.
    await db
      .update(exercise)
      .set({ importedAt: null })
      .where(eq(exercise.id, hidden.id));
    const after = await getReplacementSuggestions(fresh, source.id, 200);
    expect(after.some((s) => s.id === hidden.id)).toBe(true);
  });

  it("never leaks a foreign custom through any owner-scoped read", async () => {
    const { getExercisesByIds, searchExercises } = await import(
      "@/lib/queries/exercise"
    );
    const fresh = await makeUser();
    users.push(fresh);

    expect(await getExercisesByIds(fresh, [customId])).toHaveLength(0);
    const all = await searchExercises(fresh, { limit: 1000, scope: "imported" });
    expect(all.some((r) => r.id === customId)).toBe(false);

    // And the sanity check that the fixture is what the test thinks it is.
    const [row] = await db
      .select({ ownerId: exercise.ownerId })
      .from(exercise)
      .where(
        and(
          eq(exercise.id, customId),
          or(isNull(exercise.ownerId), eq(exercise.ownerId, author)),
        ),
      );
    expect(row.ownerId).toBe(author);
  });
});
