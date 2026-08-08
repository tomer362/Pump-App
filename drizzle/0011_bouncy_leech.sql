ALTER TABLE "workout" ADD COLUMN "kind" text DEFAULT 'session' NOT NULL;--> statement-breakpoint
CREATE INDEX "workout_user_kind_started_idx" ON "workout" USING btree ("user_id","kind","started_at");