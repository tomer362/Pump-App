CREATE TABLE "exercise_alternative" (
	"exercise_id" uuid NOT NULL,
	"alternative_id" uuid NOT NULL,
	"note" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "exercise_alternative_exercise_id_alternative_id_pk" PRIMARY KEY("exercise_id","alternative_id")
);
--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "body_effect" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "exercise_alternative" ADD CONSTRAINT "exercise_alternative_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_alternative" ADD CONSTRAINT "exercise_alternative_alternative_id_exercise_id_fk" FOREIGN KEY ("alternative_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_alternative_src_idx" ON "exercise_alternative" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_slug_idx" ON "exercise" USING btree ("slug");