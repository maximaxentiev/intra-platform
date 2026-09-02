-- Batch-level cancellation state (distinct from child shift cancellations).
ALTER TABLE "shift_batches"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
