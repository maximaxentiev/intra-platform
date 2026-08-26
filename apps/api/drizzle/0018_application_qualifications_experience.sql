ALTER TYPE "public"."application_document_category" ADD VALUE IF NOT EXISTS 'eca_diploma';--> statement-breakpoint
ALTER TYPE "public"."application_document_category" ADD VALUE IF NOT EXISTS 'ece_diploma';--> statement-breakpoint
ALTER TYPE "public"."application_document_category" ADD VALUE IF NOT EXISTS 'rece_proof';--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "childcare_experience" text DEFAULT '' NOT NULL;
