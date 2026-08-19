-- Phase 8A: shift hours adjustment foundation (current state, history, capability schema).

DO $$ BEGIN
  CREATE TYPE "shift_hours_source" AS ENUM('centre', 'ops');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "actual_start_time" time;
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "actual_end_time" time;
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "actual_total_minutes" integer;
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "hours_finalized_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "hours_finalized_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "current_hours_source" "shift_hours_source";
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "current_hours_adjustment_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_hours_finalized_by_user_id_users_id_fk"
    FOREIGN KEY ("hours_finalized_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_actual_hours_all_or_none_chk"
    CHECK (
      (
        "actual_start_time" IS NULL
        AND "actual_end_time" IS NULL
        AND "actual_total_minutes" IS NULL
      )
      OR (
        "actual_start_time" IS NOT NULL
        AND "actual_end_time" IS NOT NULL
        AND "actual_total_minutes" IS NOT NULL
        AND "actual_total_minutes" > 0
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_hours_capabilities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL,
  "public_slug" text NOT NULL,
  "token_hash" text NOT NULL,
  "assignment_epoch" integer NOT NULL DEFAULT 1,
  "assigned_staff_id" uuid NOT NULL,
  "revoked_at" timestamptz,
  "finalized_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "rotated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_hours_capabilities"
    ADD CONSTRAINT "shift_hours_capabilities_shift_id_shifts_id_fk"
    FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_hours_capabilities"
    ADD CONSTRAINT "shift_hours_capabilities_assigned_staff_id_staff_id_fk"
    FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shift_hours_capabilities_shift_id_idx" ON "shift_hours_capabilities" ("shift_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shift_hours_capabilities_public_slug_idx" ON "shift_hours_capabilities" ("public_slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_hours_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL,
  "assigned_staff_id" uuid NOT NULL,
  "source" "shift_hours_source" NOT NULL,
  "actor_user_id" uuid,
  "scheduled_shift_date" date NOT NULL,
  "scheduled_start_time" time NOT NULL,
  "scheduled_end_time" time NOT NULL,
  "scheduled_total_minutes" integer NOT NULL,
  "actual_start_time" time NOT NULL,
  "actual_end_time" time NOT NULL,
  "actual_total_minutes" integer NOT NULL,
  "assignment_epoch" integer NOT NULL,
  "capability_id" uuid,
  "idempotency_key" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "superseded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "shift_hours_adjustments_scheduled_total_positive_chk" CHECK ("scheduled_total_minutes" > 0),
  CONSTRAINT "shift_hours_adjustments_actual_total_positive_chk" CHECK ("actual_total_minutes" > 0),
  CONSTRAINT "shift_hours_adjustments_ops_actor_chk" CHECK (
    ("source" = 'centre' AND "actor_user_id" IS NULL)
    OR ("source" = 'ops' AND "actor_user_id" IS NOT NULL)
  )
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_hours_adjustments"
    ADD CONSTRAINT "shift_hours_adjustments_shift_id_shifts_id_fk"
    FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_hours_adjustments"
    ADD CONSTRAINT "shift_hours_adjustments_assigned_staff_id_staff_id_fk"
    FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_hours_adjustments"
    ADD CONSTRAINT "shift_hours_adjustments_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_hours_adjustments"
    ADD CONSTRAINT "shift_hours_adjustments_capability_id_shift_hours_capabilities_id_fk"
    FOREIGN KEY ("capability_id") REFERENCES "shift_hours_capabilities"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shift_hours_adjustments_idempotency_key_idx" ON "shift_hours_adjustments" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_hours_adjustments_shift_created_idx" ON "shift_hours_adjustments" ("shift_id", "created_at");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_current_hours_adjustment_id_shift_hours_adjustments_id_fk"
    FOREIGN KEY ("current_hours_adjustment_id") REFERENCES "shift_hours_adjustments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
