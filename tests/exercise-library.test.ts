import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Integrity of the seeded library as it actually sits in the database.
 *
 * tests/seed-data.test.ts proves the authored data is coherent; this proves
 * the seed put it in correctly and left nothing dangling. Both matter: the
 * failure this pair exists to prevent is the seed inserting 249 duplicates
 * against rows whose slug was still null, orphaning every workout_exercise
 * row that pointed at the originals.
 *
 * Requires `pnpm db:migrate && pnpm db:seed` to have run.
 */

describe("seeded exercise library", () => {
  it("has a slug on every built-in", async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM "exercise"
      WHERE "owner_id" IS NULL AND "slug" IS NULL
    `);
    // A built-in without a slug is invisible to the seed's upsert, so the next
    // run would insert a duplicate alongside it rather than updating it.
    expect(rows[0].n).toBe(0);
  });

  it("has no duplicate built-in slugs", async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM (
        SELECT "slug" FROM "exercise"
        WHERE "owner_id" IS NULL AND "slug" IS NOT NULL
        GROUP BY "slug" HAVING COUNT(*) > 1
      ) d
    `);
    expect(rows[0].n).toBe(0);
  });

  it("never gives a custom exercise a slug", async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM "exercise"
      WHERE "owner_id" IS NOT NULL AND "slug" IS NOT NULL
    `);
    // `slug` is not settable through any server action; if this ever fails,
    // something has started writing it and the unique index will start
    // rejecting user-created exercises.
    expect(rows[0].n).toBe(0);
  });

  it("seeded the library and its alternatives", async () => {
    const { rows } = await db.execute<{ ex: number; alt: number }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM "exercise" WHERE "owner_id" IS NULL) AS ex,
        (SELECT COUNT(*)::int FROM "exercise_alternative") AS alt
    `);
    expect(rows[0].ex).toBeGreaterThanOrEqual(240);
    expect(rows[0].alt).toBeGreaterThan(0);
  });

  it("has enriched prose on the built-ins", async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM "exercise"
      WHERE "owner_id" IS NULL
        AND ("body_effect" IS NULL OR "instructions" IS NULL)
    `);
    expect(rows[0].n).toBe(0);
  });

  it("has no alternative pointing at a missing or custom exercise", async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n
      FROM "exercise_alternative" a
      LEFT JOIN "exercise" e ON e."id" = a."alternative_id"
      WHERE e."id" IS NULL OR e."owner_id" IS NOT NULL
    `);
    expect(rows[0].n).toBe(0);
  });

  it("never points an exercise at itself", async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM "exercise_alternative"
      WHERE "exercise_id" = "alternative_id"
    `);
    expect(rows[0].n).toBe(0);
  });
});
