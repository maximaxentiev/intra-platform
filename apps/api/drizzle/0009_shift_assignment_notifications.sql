CREATE TYPE "public"."shift_assignment_notification_recipient_type" AS ENUM('centre', 'carer');--> statement-breakpoint
CREATE TYPE "public"."shift_assignment_notification_trigger" AS ENUM('assign', 'resend');--> statement-breakpoint
CREATE TYPE "public"."shift_assignment_notification_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "shift_assignment_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"assigned_staff_id" uuid NOT NULL,
	"recipient_type" "shift_assignment_notification_recipient_type" NOT NULL,
	"recipient_email" text DEFAULT '' NOT NULL,
	"trigger" "shift_assignment_notification_trigger" NOT NULL,
	"status" "shift_assignment_notification_status" NOT NULL,
	"provider_id" text,
	"failure_code" text,
	"failure_reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "shift_assignment_notifications" ADD CONSTRAINT "shift_assignment_notifications_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignment_notifications" ADD CONSTRAINT "shift_assignment_notifications_assigned_staff_id_staff_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignment_notifications" ADD CONSTRAINT "shift_assignment_notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_assignment_notifications_shift_idx" ON "shift_assignment_notifications" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_assignment_notifications_recipient_status_idx" ON "shift_assignment_notifications" USING btree ("recipient_type","status");--> statement-breakpoint
CREATE INDEX "shift_assignment_notifications_created_idx" ON "shift_assignment_notifications" USING btree ("created_at");
