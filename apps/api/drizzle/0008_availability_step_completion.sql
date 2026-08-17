ALTER TABLE "staff_accounts" ADD COLUMN "availability_completed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "staff_accounts"
SET "availability_completed_at" = "onboarding_completed_at"
WHERE "onboarding_completed_at" IS NOT NULL
  AND "availability_completed_at" IS NULL;
