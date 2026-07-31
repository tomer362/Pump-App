-- Backfill stable slugs onto the 94 built-in exercises that predate the
-- `slug` column. This lives in a migration, not the seed: `drizzle-kit
-- migrate` runs inside `pnpm build` while `db:seed` is a manual deploy step,
-- and a seed that upserts ON CONFLICT (slug) against rows whose slug is still
-- NULL would not conflict at all -- it would insert 94 duplicates and orphan
-- every workout_exercise row pointing at the originals.
--
-- Three clauses, all load-bearing: owner_id IS NULL (a user may own a custom
-- exercise named "Push Up"), slug IS NULL (safe to re-run), exact name match.
UPDATE "exercise" SET "slug" = 'bench-press-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bench Press (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'bench-press-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bench Press (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'incline-bench-press-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Incline Bench Press (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'incline-bench-press-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Incline Bench Press (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'decline-bench-press-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Decline Bench Press (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'chest-press-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Chest Press (Machine)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'chest-fly-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Chest Fly (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'cable-fly'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Cable Fly';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'pec-deck'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Pec Deck';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'push-up'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Push Up';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'dip-chest'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Dip (Chest)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'deadlift-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Deadlift (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'romanian-deadlift-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Romanian Deadlift (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'pull-up'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Pull Up';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'chin-up'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Chin Up';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'lat-pulldown-cable'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Lat Pulldown (Cable)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'seated-row-cable'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Seated Row (Cable)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'bent-over-row-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bent Over Row (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'bent-over-row-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bent Over Row (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 't-bar-row'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'T-Bar Row';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'chest-supported-row-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Chest Supported Row (Machine)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'straight-arm-pulldown'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Straight Arm Pulldown';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'face-pull'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Face Pull';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'shrug-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Shrug (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'shrug-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Shrug (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'back-extension'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Back Extension';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'overhead-press-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Overhead Press (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'overhead-press-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Overhead Press (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'arnold-press'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Arnold Press';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'shoulder-press-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Shoulder Press (Machine)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'lateral-raise-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Lateral Raise (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'lateral-raise-cable'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Lateral Raise (Cable)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'rear-delt-fly-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Rear Delt Fly (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'rear-delt-fly-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Rear Delt Fly (Machine)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'front-raise-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Front Raise (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'upright-row-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Upright Row (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'bicep-curl-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bicep Curl (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'bicep-curl-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bicep Curl (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'hammer-curl-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Hammer Curl (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'preacher-curl'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Preacher Curl';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'incline-curl-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Incline Curl (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'cable-curl'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Cable Curl';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'concentration-curl'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Concentration Curl';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'tricep-pushdown-cable'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Tricep Pushdown (Cable)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'overhead-tricep-extension-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Overhead Tricep Extension (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'skull-crusher-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Skull Crusher (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'close-grip-bench-press'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Close Grip Bench Press';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'dip-triceps'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Dip (Triceps)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'tricep-kickback'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Tricep Kickback';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'wrist-curl'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Wrist Curl';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'farmers-walk'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Farmer''s Walk';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'squat-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Squat (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'front-squat-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Front Squat (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'squat-smith-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Squat (Smith Machine)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'hack-squat'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Hack Squat';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'leg-press'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Leg Press';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'bulgarian-split-squat'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Bulgarian Split Squat';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'lunge-dumbbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Lunge (Dumbbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'goblet-squat'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Goblet Squat';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'leg-extension'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Leg Extension';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'leg-curl-lying'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Leg Curl (Lying)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'leg-curl-seated'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Leg Curl (Seated)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'good-morning'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Good Morning';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'hip-thrust-barbell'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Hip Thrust (Barbell)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'glute-bridge'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Glute Bridge';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'cable-kickback'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Cable Kickback';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'hip-abduction-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Hip Abduction (Machine)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'calf-raise-standing'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Calf Raise (Standing)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'calf-raise-seated'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Calf Raise (Seated)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'calf-press-leg-press'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Calf Press (Leg Press)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'plank'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Plank';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'hanging-leg-raise'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Hanging Leg Raise';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'cable-crunch'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Cable Crunch';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'crunch'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Crunch';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'sit-up'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Sit Up';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'russian-twist'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Russian Twist';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'ab-wheel-rollout'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Ab Wheel Rollout';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'side-plank'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Side Plank';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'woodchopper-cable'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Woodchopper (Cable)';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'power-clean'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Power Clean';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'clean-and-jerk'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Clean and Jerk';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'snatch'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Snatch';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'kettlebell-swing'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Kettlebell Swing';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'thruster'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Thruster';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'burpee'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Burpee';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'treadmill-run'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Treadmill Run';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'cycling'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Cycling';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'rowing-machine'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Rowing Machine';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'stair-climber'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Stair Climber';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'elliptical'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Elliptical';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'jump-rope'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Jump Rope';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'battle-ropes'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Battle Ropes';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'mountain-climbers'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Mountain Climbers';
--> statement-breakpoint
UPDATE "exercise" SET "slug" = 'sled-push'
  WHERE "owner_id" IS NULL AND "slug" IS NULL AND "name" = 'Sled Push';
