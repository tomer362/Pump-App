ALTER TABLE "exercise" ADD COLUMN "imported_at" timestamp;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "source_exercise_id" uuid;