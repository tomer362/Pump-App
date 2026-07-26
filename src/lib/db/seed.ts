import { db } from "./index";
import { achievement, exercise } from "./schema";
import { SEED_ACHIEVEMENTS, SEED_EXERCISES } from "./seed-data";
import { isNull, sql } from "drizzle-orm";

/**
 * Idempotent seed for the built-in exercise library and achievement list.
 * Safe to re-run: exercises match on name, achievements on their stable key.
 */
async function main() {
  console.log("Seeding built-in exercises…");

  const existing = await db
    .select({ name: exercise.name })
    .from(exercise)
    .where(isNull(exercise.ownerId));
  const known = new Set(existing.map((e) => e.name));

  const toInsert = SEED_EXERCISES.filter((e) => !known.has(e.name)).map((e) => ({
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    secondaryMuscles: e.secondaryMuscles ?? [],
    equipment: e.equipment,
    trackingType: e.trackingType ?? ("weight_reps" as const),
    ownerId: null,
  }));

  if (toInsert.length) {
    await db.insert(exercise).values(toInsert);
  }
  console.log(
    `  ${toInsert.length} inserted, ${known.size} already present (${SEED_EXERCISES.length} total).`,
  );

  console.log("Seeding achievements…");
  await db
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

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
