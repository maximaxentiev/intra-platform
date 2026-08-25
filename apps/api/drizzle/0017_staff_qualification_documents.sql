ALTER TYPE "public"."staff_document_type" ADD VALUE IF NOT EXISTS 'eca_diploma';--> statement-breakpoint
ALTER TYPE "public"."staff_document_type" ADD VALUE IF NOT EXISTS 'ece_diploma';--> statement-breakpoint
ALTER TYPE "public"."staff_document_type" ADD VALUE IF NOT EXISTS 'rece_proof';--> statement-breakpoint
CREATE TYPE "public"."centre_ece_qualification_requirement" AS ENUM('ece_or_rece', 'rece_required');--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN IF NOT EXISTS "requires_qualification_for_matching" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN IF NOT EXISTS "ece_qualification_requirement" "centre_ece_qualification_requirement" DEFAULT 'ece_or_rece' NOT NULL;
