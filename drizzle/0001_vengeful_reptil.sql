CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"post_id" uuid,
	"workout_id" uuid,
	"body" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_user_id_action_pk" PRIMARY KEY("user_id","action")
);
--> statement-breakpoint
ALTER TABLE "push_subscription" DROP CONSTRAINT "push_subscription_endpoint_unique";--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_unread_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_user_endpoint_idx" ON "push_subscription" USING btree ("user_id","endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_one_active_idx" ON "workout" USING btree ("user_id") WHERE "workout"."ended_at" IS NULL;