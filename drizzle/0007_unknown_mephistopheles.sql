CREATE TABLE "routine_folder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"rotation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_like" (
	"routine_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "routine_like_routine_id_user_id_pk" PRIMARY KEY("routine_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "save_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "popularity" integer GENERATED ALWAYS AS (like_count + 2 * save_count) STORED;--> statement-breakpoint
ALTER TABLE "routine_folder" ADD CONSTRAINT "routine_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_like" ADD CONSTRAINT "routine_like_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_like" ADD CONSTRAINT "routine_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_folder_user_idx" ON "routine_folder" USING btree ("user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "routine_folder_user_name_idx" ON "routine_folder" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "routine_like_user_idx" ON "routine_like" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_folder_id_routine_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."routine_folder"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_folder_idx" ON "routine" USING btree ("folder_id","position");--> statement-breakpoint
CREATE INDEX "routine_popular_idx" ON "routine" USING btree ("popularity","id") WHERE "routine"."is_public";--> statement-breakpoint
CREATE INDEX "routine_new_idx" ON "routine" USING btree ("created_at","id") WHERE "routine"."is_public";