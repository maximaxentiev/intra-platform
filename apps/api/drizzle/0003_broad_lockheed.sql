CREATE TYPE "public"."staff_account_status" AS ENUM('invited', 'incomplete', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "staff_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"status" "staff_account_status" DEFAULT 'invited' NOT NULL,
	"invite_token_hash" text,
	"invite_token_expires_at" timestamp with time zone,
	"invite_sent_at" timestamp with time zone,
	"onboarding_step" smallint DEFAULT 1 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_accounts_staff_id_unique" UNIQUE("staff_id"),
	CONSTRAINT "staff_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "hourly_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "legal_first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "legal_last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "document_slug" text;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_accounts_email_idx" ON "staff_accounts" USING btree ("email");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_document_slug_unique" UNIQUE("document_slug");--> statement-breakpoint
-- Backfill split legal names from the existing single legal_name column.
UPDATE "staff"
SET "legal_first_name" = split_part(trim("legal_name"), ' ', 1),
    "legal_last_name"  = COALESCE(regexp_replace(trim("legal_name"), '^\S+\s*', ''), '')
WHERE "legal_first_name" = '' AND trim("legal_name") <> '';
