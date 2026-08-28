ALTER TABLE "staff_accounts" ADD COLUMN "onboarding_started_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "staff_accounts"
SET "onboarding_started_at" = COALESCE(
  "profile_completed_at",
  "documents_completed_at",
  "availability_completed_at",
  "created_at"
)
WHERE "onboarding_completed_at" IS NULL
  AND (
    "profile_completed_at" IS NOT NULL
    OR "documents_completed_at" IS NOT NULL
    OR "availability_completed_at" IS NOT NULL
    OR "availability_onboarding_week1_start" IS NOT NULL
  );
