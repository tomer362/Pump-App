import { db } from "./index";
import { achievement, exercise, exerciseAlternative } from "./schema";
import { SEED_ACHIEVEMENTS, SEED_EXERCISES, LEGACY_NAME_TO_SLUG } from "./seed-data";
import { youTubeWatchUrl } from "@/lib/exercise-video";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

/**
 * Idempotent *and* updatable seed for the built-in library.
 *
 * The old version only inserted names it had never seen, which meant enriched
 * fields could never reach the rows already in a database. This upserts on
 * `slug`, so re-running updates every built-in in place — keeping its uuid and
 * therefore every workout_exercise and personal_record row pointing at it.
 *
 * All of it runs in one transaction: a half-applied alternatives set would
 * leave the detail page showing a partial list with no way to tell.
 */

const CHUNK = 100;

async function main() {
  await db.transaction(async (tx) => {
    /* 1. Heal a database that got the `slug` column via `db:push` rather than
       through migration 0004. A no-op everywhere else — every clause of the
       WHERE has to match, including `slug IS NULL`. */
    let healed = 0;
    for (const [name, slug] of LEGACY_NAME_TO_SLUG) {
      const rows = await tx
        .update(exercise)
        .set({ slug })
        .where(
          and(isNull(exercise.ownerId), isNull(exercise.slug), eq(exercise.name, name)),
        )
        .returning({ id: exercise.id });
      healed += rows.length;
    }
    if (healed) console.log(`Backfilled ${healed} legacy slugs (db:push database).`);

    /* 2. Upsert the library on `slug`. Custom exercises have slug NULL and
       Postgres unique indexes permit many NULLs, so they never conflict. */
    console.log("Seeding built-in exercises…");
    const rows = SEED_EXERCISES.map((e) => ({
      slug: e.slug,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: e.secondaryMuscles ?? [],
      equipment: e.equipment,
      trackingType: e.trackingType ?? ("weight_reps" as const),
      instructions: e.instructions ?? null,
      bodyEffect: e.bodyEffect ?? null,
      videoUrl: e.videoId ? youTubeWatchUrl(e.videoId) : null,
      ownerId: null,
    }));

    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx
        .insert(exercise)
        .values(rows.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: exercise.slug,
          set: {
            name: sql`excluded.name`,
            primaryMuscle: sql`excluded.primary_muscle`,
            secondaryMuscles: sql`excluded.secondary_muscles`,
            equipment: sql`excluded.equipment`,
            trackingType: sql`excluded.tracking_type`,
            instructions: sql`excluded.instructions`,
            bodyEffect: sql`excluded.body_effect`,
            videoUrl: sql`excluded.video_url`,
          },
        });
    }
    console.log(`  ${rows.length} built-in exercises upserted.`);

    /* Deliberately not deleting built-ins that have dropped out of
       SEED_EXERCISES: the cascade would take every workout_exercise row a user
       has logged against them with it. Retiring a library entry needs its own
       considered migration, not a seed side-effect. */

    /* 3. Resolve authored slugs to the uuids this database generated. */
    const builtIns = await tx
      .select({ id: exercise.id, slug: exercise.slug })
      .from(exercise)
      .where(isNull(exercise.ownerId));
    const bySlug = new Map(
      builtIns.flatMap((r) => (r.slug ? [[r.slug, r.id] as const] : [])),
    );

    const altRows: (typeof exerciseAlternative.$inferInsert)[] = [];
    const unresolved: string[] = [];
    for (const e of SEED_EXERCISES) {
      const src = bySlug.get(e.slug);
      if (!src) {
        unresolved.push(e.slug);
        continue;
      }
      (e.alternatives ?? []).forEach((a, i) => {
        const dst = bySlug.get(a.slug);
        if (!dst) {
          unresolved.push(`${e.slug} -> ${a.slug}`);
          return;
        }
        altRows.push({ exerciseId: src, alternativeId: dst, note: a.note, position: i });
      });
    }
    // Fail loudly and roll back rather than silently dropping links — a
    // missing alternative is invisible in the UI, which is exactly how it
    // would go unnoticed. tests/seed-data.test.ts catches this without a DB.
    if (unresolved.length) {
      throw new Error(`Unresolved alternative slugs:\n  ${unresolved.join("\n  ")}`);
    }

    /* 4. Replace rather than upsert: an upsert alone would leave a pair that
       has been removed from the seed data in the table forever. Scoped to
       built-in sources, so nothing a user owns is touched. */
    console.log("Seeding exercise alternatives…");
    const builtInIds = builtIns.map((r) => r.id);
    if (builtInIds.length) {
      for (let i = 0; i < builtInIds.length; i += CHUNK) {
        await tx
          .delete(exerciseAlternative)
          .where(inArray(exerciseAlternative.exerciseId, builtInIds.slice(i, i + CHUNK)));
      }
    }
    for (let i = 0; i < altRows.length; i += CHUNK) {
      await tx.insert(exerciseAlternative).values(altRows.slice(i, i + CHUNK));
    }
    console.log(`  ${altRows.length} alternative links written.`);

    /* 5. Achievements — already a real upsert on a stable key. */
    console.log("Seeding achievements…");
    await tx
      .insert(achievement)
      .values(SEED_ACHIEVEMENTS)
      .onConflictDoUpdate({
        target: achievement.key,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          icon: sql`excluded.icon`,
          tier: sql`excluded.tier`,
        },
      });
    console.log(`  ${SEED_ACHIEVEMENTS.length} achievements upserted.`);
  });

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
