-- Hand-authored, in the manner of 0004 and 0008.
--
-- copyRoutine used to copy routine_exercise.exercise_id verbatim, so anyone who
-- saved a routine containing the author's own custom exercise ended up holding
-- rows pointing at a row they don't own. That renders — getFullRoutine joins
-- exercise with no owner filter — and then fails everywhere else: /exercises/<id>
-- 404s, the picker can't re-add it after a removal, the routine builder silently
-- drops it because getExercisesByIds is owner-scoped, and the day the author
-- deletes their account the cascade takes the copier's rows with it.
--
-- 0009 added exercise.imported_at and exercise.source_exercise_id, and the action
-- now clones foreign customs on the way in. This repoints the rows already in the
-- database onto clones of their own.
--
-- Clones deliberately do NOT copy slug, video_url or body_effect — the same
-- contract a file import gets. A settable slug collides with a built-in;
-- video_url is the column the UI presents as a vetted demonstration; body_effect
-- is seeded for built-ins only. popularity takes its default of 0, which tails
-- these alphabetically in every picker.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: workout_exercise rows already logged
-- against a foreign custom are left alone. Repointing them moves finished sets
-- onto a different exercise row, which can merge two lifts' histories that were
-- never the same lift; personal_record is keyed on exercise_id too, so moving one
-- without the other desyncs them and moving both means merging PR rows kind by
-- kind against rows that may already exist. The residual exposure is bounded and
-- pre-existing — if the original author deletes their account, that already-logged
-- history cascades away — it affects only history logged against a stranger's row,
-- and it stops growing the moment this ships.

-- (a) Mint one clone per (owner, lowercased name), skipping anyone who already
--     has an exercise by that name — name-only uniqueness per user is what
--     nameTaken enforces, so a name match is an unambiguous reuse.
INSERT INTO "exercise"
  ("name", "primary_muscle", "secondary_muscles", "equipment", "tracking_type",
   "instructions", "owner_id", "source_exercise_id", "imported_at")
SELECT DISTINCT ON (r."user_id", lower(e."name"))
  e."name",
  e."primary_muscle",
  e."secondary_muscles",
  e."equipment",
  e."tracking_type",
  e."instructions",
  r."user_id",
  e."id",
  NOW()
FROM "routine_exercise" re
JOIN "routine" r ON r."id" = re."routine_id"
JOIN "exercise" e ON e."id" = re."exercise_id"
WHERE e."owner_id" IS NOT NULL
  AND e."owner_id" <> r."user_id"
  AND NOT EXISTS (
    SELECT 1 FROM "exercise" mine
    WHERE mine."owner_id" = r."user_id"
      AND lower(mine."name") = lower(e."name")
  )
ORDER BY r."user_id", lower(e."name"), e."created_at";
--> statement-breakpoint
-- (b) Repoint the routine rows onto the copier's own row — the clone just
--     minted, or the same-named one they already had.
UPDATE "routine_exercise" re
SET "exercise_id" = mine."id"
FROM "routine" r, "exercise" theirs, "exercise" mine
WHERE r."id" = re."routine_id"
  AND theirs."id" = re."exercise_id"
  AND theirs."owner_id" IS NOT NULL
  AND theirs."owner_id" <> r."user_id"
  AND mine."owner_id" = r."user_id"
  AND lower(mine."name") = lower(theirs."name");
