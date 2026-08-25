ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "password_reset_token_hash" text;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "password_reset_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "password_reset_requested_at" timestamp with time zone;
