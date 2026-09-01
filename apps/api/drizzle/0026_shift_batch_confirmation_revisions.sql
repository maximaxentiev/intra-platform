-- Batch Centre confirmation revisions: track stale state after post-confirmation child changes.
ALTER TABLE "shift_batches"
  ADD COLUMN IF NOT EXISTS "confirmation_revision" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pending_change_revision" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_confirmation_scheduled_at" timestamptz;

-- Existing completed batches had an initial confirmation; treat as revision 1 and current.
UPDATE "shift_batches"
SET
  "confirmation_revision" = 1,
  "pending_change_revision" = 0,
  "last_confirmation_scheduled_at" = COALESCE("request_completed_at", "last_confirmation_scheduled_at")
WHERE "request_completed_at" IS NOT NULL
  AND "confirmation_revision" = 0;
