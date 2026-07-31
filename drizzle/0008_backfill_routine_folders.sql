-- Hand-authored, in the manner of 0004_backfill_exercise_slugs: 0007 added the
-- routine_folder table and routine.folder_id, but the data still lives in the
-- old free-text routine.folder column. Promote it to rows before dropping it,
-- or every folder anyone has ever made disappears on deploy.
--
-- Names are folded case-insensitively so the "PPL" / "ppl" fork that the old
-- text column allowed collapses into one folder rather than tripping the new
-- unique index.

INSERT INTO "routine_folder" ("user_id", "name", "position")
SELECT
  d."user_id",
  d."name",
  ROW_NUMBER() OVER (PARTITION BY d."user_id" ORDER BY lower(d."name")) - 1
FROM (
  SELECT DISTINCT ON ("user_id", lower(btrim("folder")))
    "user_id",
    btrim("folder") AS "name"
  FROM "routine"
  WHERE "folder" IS NOT NULL AND btrim("folder") <> ''
  ORDER BY "user_id", lower(btrim("folder")), "created_at"
) d
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "routine" r
SET "folder_id" = f."id"
FROM "routine_folder" f
WHERE f."user_id" = r."user_id"
  AND r."folder" IS NOT NULL
  AND lower(f."name") = lower(btrim(r."folder"));
--> statement-breakpoint
-- Freeze the order people currently see (updated_at desc) as the new manual
-- order, so promoting folders doesn't reshuffle anyone's list on first load.
UPDATE "routine" r
SET "position" = s."rn"
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", "folder_id" ORDER BY "updated_at" DESC
    ) - 1 AS "rn"
  FROM "routine"
) s
WHERE s."id" = r."id";
--> statement-breakpoint
ALTER TABLE "routine" DROP COLUMN "folder";
