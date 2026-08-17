CREATE TYPE "public"."shift_cancellation_request_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TABLE "shift_cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "shift_cancellation_request_status" NOT NULL DEFAULT 'pending',
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolution_note" text NOT NULL DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_cancellation_requests" ADD CONSTRAINT "shift_cancellation_requests_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_cancellation_requests" ADD CONSTRAINT "shift_cancellation_requests_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_cancellation_requests" ADD CONSTRAINT "shift_cancellation_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_cancellation_requests_one_pending_per_shift_staff_idx" ON "shift_cancellation_requests" USING btree ("shift_id","staff_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "shift_cancellation_requests_shift_idx" ON "shift_cancellation_requests" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_cancellation_requests_staff_idx" ON "shift_cancellation_requests" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "shift_cancellation_requests_pending_idx" ON "shift_cancellation_requests" USING btree ("status") WHERE "status" = 'pending';
