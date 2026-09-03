-- Ops-only centre notes; never included in Carer/Centre communications.
ALTER TABLE "centres" ADD COLUMN IF NOT EXISTS "internal_ops_notes" text;
