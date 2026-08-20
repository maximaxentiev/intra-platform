CREATE TABLE "platform_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"staff_id" uuid,
	"shift_id" uuid,
	"centre_id" uuid,
	"target_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "platform_audit_occurred_at_idx" ON "platform_audit_events" USING btree ("occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "platform_audit_action_idx" ON "platform_audit_events" USING btree ("action");
--> statement-breakpoint
CREATE INDEX "platform_audit_entity_idx" ON "platform_audit_events" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX "platform_audit_staff_occurred_idx" ON "platform_audit_events" USING btree ("staff_id","occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "platform_audit_centre_occurred_idx" ON "platform_audit_events" USING btree ("centre_id","occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "platform_audit_shift_occurred_idx" ON "platform_audit_events" USING btree ("shift_id","occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "platform_audit_actor_occurred_idx" ON "platform_audit_events" USING btree ("actor_user_id","occurred_at" DESC);
