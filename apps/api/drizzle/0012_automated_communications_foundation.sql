-- Phase 7C: durable automated communications schedule + delivery history.
CREATE TABLE IF NOT EXISTS "scheduled_communications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "communication_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "recipient_type" text NOT NULL,
  "recipient_entity_id" uuid,
  "scheduled_for" timestamptz NOT NULL,
  "status" text NOT NULL DEFAULT 'scheduled',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error_code" text,
  "last_error_reason" text,
  "cancelled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_communications_idempotency_key_idx" ON "scheduled_communications" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_communications_status_scheduled_for_idx" ON "scheduled_communications" ("status", "scheduled_for");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_communications_entity_idx" ON "scheduled_communications" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scheduled_communication_id" uuid NOT NULL REFERENCES "scheduled_communications"("id") ON DELETE RESTRICT,
  "idempotency_key" text NOT NULL,
  "attempt_number" integer NOT NULL,
  "recipient_email" text NOT NULL DEFAULT '',
  "status" text NOT NULL,
  "provider_id" text,
  "failure_code" text,
  "failure_reason" text,
  "attempted_at" timestamptz NOT NULL DEFAULT now(),
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_deliveries_scheduled_communication_idx" ON "communication_deliveries" ("scheduled_communication_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_deliveries_idempotency_key_idx" ON "communication_deliveries" ("idempotency_key");
