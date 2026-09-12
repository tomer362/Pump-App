import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** A drizzle transaction handle — records are always rebuilt inside one. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Rebuild this user's records for the given exercises from the sets that still
 * exist.
 *
 * Deliberately NOT in a `"use server"` module. Every export of one of those is
 * a live POST endpoint, and this takes a `userId` — publishing it would mean
 * publishing "wipe and rebuild any user's records" to the internet.
 *
 * `personal_record` keeps exactly one row per (user, exercise, kind), so the
 * previous best is overwritten as records improve — there is nothing to fall
 * back to. Deleting the workout that set a record therefore has to recompute
 * from history, or the user simply loses the record with no replacement.
 */
export async function recalculatePersonalRecords(
  tx: Tx,
  userId: string,
  exerciseIds: string[],
) {
  if (!exerciseIds.length) return;

  const ids = sql.join(
    exerciseIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

  await tx.execute(sql`
    DELETE FROM personal_record
    WHERE user_id = ${userId} AND exercise_id IN (${ids})
  `);

  // One statement: gather every surviving qualifying set, then take the best
  // per (exercise, kind) with DISTINCT ON.
  await tx.execute(sql`
    WITH candidate AS (
      SELECT
        we.exercise_id,
        ws.id                                              AS set_id,
        w.id                                               AS workout_id,
        -- On an assisted machine the weight column is the counterweight, so
        -- every weight-derived kind below has to fall out rather than crown the
        -- set you needed the most help on. Nulling it here is what does that:
        -- the weight, 1rm and volume branches are each guarded by a > 0, so
        -- they select no row for the exercise at all, while reps -- the one
        -- that still means something -- is untouched.
        CASE WHEN e.tracking_type = 'assist_reps' THEN NULL
             ELSE ws.weight_kg END                         AS weight_kg,
        ws.reps,
        CASE WHEN e.tracking_type = 'assist_reps' THEN 0
             ELSE COALESCE(ws.estimated_1rm, 0) END        AS e1rm,
        CASE WHEN e.tracking_type = 'assist_reps' THEN 0
             ELSE COALESCE(ws.weight_kg, 0) * COALESCE(ws.reps, 0) END AS volume,
        w.ended_at
      FROM workout_set ws
      JOIN workout_exercise we ON we.id = ws.workout_exercise_id
      JOIN workout w           ON w.id = we.workout_id
      JOIN exercise e          ON e.id = we.exercise_id
      WHERE w.user_id = ${userId}
        AND w.ended_at IS NOT NULL
        AND ws.completed_at IS NOT NULL
        AND ws.set_type <> 'warmup'
        AND we.exercise_id IN (${ids})
    ),
    -- Each branch is parenthesised: an unbracketed ORDER BY binds to the whole
    -- UNION, so DISTINCT ON's required leading sort is a syntax error without
    -- them. This path only runs on delete, which is why it went unnoticed.
    -- Ties break on the *earliest* session, then the set id: a record is the
    -- first time you lifted it, and without a tiebreak two equal bests picked
    -- an arbitrary row, so which workout wore the PR badge could flip between
    -- two rebuilds of identical data.
    best AS (
      (SELECT DISTINCT ON (exercise_id) exercise_id, '1rm' AS kind, e1rm AS value,
              weight_kg, reps, set_id, workout_id, ended_at
       FROM candidate WHERE e1rm > 0
       ORDER BY exercise_id, e1rm DESC, ended_at ASC, set_id ASC)
      UNION ALL
      (SELECT DISTINCT ON (exercise_id) exercise_id, 'weight', weight_kg,
              weight_kg, reps, set_id, workout_id, ended_at
       FROM candidate WHERE COALESCE(weight_kg, 0) > 0
       ORDER BY exercise_id, weight_kg DESC, ended_at ASC, set_id ASC)
      UNION ALL
      (SELECT DISTINCT ON (exercise_id) exercise_id, 'volume', volume,
              weight_kg, reps, set_id, workout_id, ended_at
       FROM candidate WHERE volume > 0
       ORDER BY exercise_id, volume DESC, ended_at ASC, set_id ASC)
      UNION ALL
      (SELECT DISTINCT ON (exercise_id) exercise_id, 'reps', reps,
              weight_kg, reps, set_id, workout_id, ended_at
       FROM candidate WHERE COALESCE(reps, 0) > 0
       ORDER BY exercise_id, reps DESC, ended_at ASC, set_id ASC)
    )
    INSERT INTO personal_record
      (user_id, exercise_id, kind, value, weight_kg, reps, workout_set_id, workout_id, achieved_at)
    SELECT ${userId}, exercise_id, kind, value, weight_kg, reps, set_id, workout_id,
           COALESCE(ended_at, NOW())
    FROM best
  `);

  // prCount on other workouts counted records that may no longer exist. Only
  // the workouts that could have changed: those holding a record for one of
  // these exercises before, or after, the rebuild. The previous version
  // rewrote every finished workout the user owned — 500 rows and 500
  // correlated subqueries, inside a transaction, on a scale-to-zero database,
  // to undo one quick log.
  await tx.execute(sql`
    UPDATE workout w SET pr_count = (
      SELECT COUNT(*)::int FROM personal_record pr
      WHERE pr.user_id = ${userId} AND pr.workout_id = w.id AND pr.kind = '1rm'
    )
    WHERE w.user_id = ${userId}
      AND w.ended_at IS NOT NULL
      AND (
        w.id IN (
          SELECT pr.workout_id FROM personal_record pr
          WHERE pr.user_id = ${userId} AND pr.exercise_id IN (${ids})
        )
        OR w.pr_count <> (
          SELECT COUNT(*)::int FROM personal_record pr
          WHERE pr.user_id = ${userId} AND pr.workout_id = w.id AND pr.kind = '1rm'
        )
      )
  `);
}
