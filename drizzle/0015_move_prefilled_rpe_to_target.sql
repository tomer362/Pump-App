-- Hand-authored, in the manner of 0004, 0008 and 0010.
--
-- startWorkoutFromRoutine used to copy routine_set.target_rpe straight into
-- workout_set.rpe, "pre-filled like every other target". Weight and reps survive
-- that treatment because they land in text inputs, which visibly are targets you
-- type over. RPE has no input — only the result-shaped `@8` subscript under the
-- set number — so a pre-filled prescription was indistinguishable from a rating
-- the lifter had given. Starting a routine showed you your own effort rating for
-- a set you hadn't lifted yet, and once finished there was no record of what was
-- prescribed versus what it actually felt like.
--
-- 0014 added workout_set.target_rpe and the action now writes the two facts to
-- two columns. This moves the values already sitting in the wrong one.
--
-- The three predicates together are what make this safe. An uncompleted set, in
-- a still-live session, that came from a routine, carrying an rpe, was written by
-- startWorkoutFromRoutine — nobody has ticked it, so nobody has rated it. The
-- unique index workout_one_active_idx (scoped WHERE ended_at IS NULL) bounds this
-- to at most one workout per user.
--
-- The one loss is a lifter who opened the options sheet and rated a set *before*
-- ticking it: their rating becomes a prescription rather than being deleted. Rare
-- enough, and recoverable by rating it again, which is one tap.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: finished workouts are left exactly as they
-- are. No predicate can tell a deliberate rating from a pre-fill after the fact —
-- completed_at is set on both — so "fixing" their appearance would mean un-rating
-- thousands of historical sets, some of which really were rated. Old sessions keep
-- reading as rated, and their target_rpe stays null; that is the honest outcome.
-- Free-form workouts (routine_id IS NULL) never had a prescription to recover.
UPDATE "workout_set" ws
SET "target_rpe" = ws."rpe", "rpe" = NULL
FROM "workout_exercise" we
JOIN "workout" w ON w."id" = we."workout_id"
WHERE we."id" = ws."workout_exercise_id"
  AND ws."rpe" IS NOT NULL
  AND ws."completed_at" IS NULL
  AND w."ended_at" IS NULL
  AND w."routine_id" IS NOT NULL;
