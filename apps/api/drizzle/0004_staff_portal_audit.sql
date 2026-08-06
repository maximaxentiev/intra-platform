CREATE TABLE "staff_portal_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"staff_account_id" uuid,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_portal_audit_events" ADD CONSTRAINT "staff_portal_audit_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_portal_audit_events" ADD CONSTRAINT "staff_portal_audit_events_staff_account_id_staff_accounts_id_fk" FOREIGN KEY ("staff_account_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_portal_audit_events" ADD CONSTRAINT "staff_portal_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "staff_portal_audit_staff_idx" ON "staff_portal_audit_events" USING btree ("staff_id","created_at");
