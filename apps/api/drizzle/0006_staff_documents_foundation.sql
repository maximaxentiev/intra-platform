CREATE TYPE "public"."staff_document_type" AS ENUM('vulnerable_sector_check', 'first_aid_cpr', 'immunizations', 'covid19_vaccination');--> statement-breakpoint
CREATE TYPE "public"."staff_document_review_status" AS ENUM('pending_review', 'approved', 'issue_flagged');--> statement-breakpoint
CREATE TYPE "public"."staff_document_actor_type" AS ENUM('carer', 'ops_user');--> statement-breakpoint
CREATE TABLE "staff_document_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"document_type" "staff_document_type" NOT NULL,
	"reminders_enabled" boolean DEFAULT true NOT NULL,
	"current_submission_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_document_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_set_id" uuid NOT NULL,
	"review_status" "staff_document_review_status" NOT NULL,
	"processed_date" date,
	"expiry_date" date,
	"submitted_at" timestamp with time zone NOT NULL,
	"submitted_by_actor_type" "staff_document_actor_type" NOT NULL,
	"submitted_by_staff_account_id" uuid,
	"submitted_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"issue_note" text DEFAULT '' NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_document_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"checksum_sha256" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "document_share_token_hash" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "document_share_token_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "document_share_token_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD COLUMN "documents_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_document_sets" ADD CONSTRAINT "staff_document_sets_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_document_submissions" ADD CONSTRAINT "staff_document_submissions_document_set_id_staff_document_sets_id_fk" FOREIGN KEY ("document_set_id") REFERENCES "public"."staff_document_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_document_submissions" ADD CONSTRAINT "staff_document_submissions_submitted_by_staff_account_id_staff_accounts_id_fk" FOREIGN KEY ("submitted_by_staff_account_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_document_submissions" ADD CONSTRAINT "staff_document_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_document_submissions" ADD CONSTRAINT "staff_document_submissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_document_files" ADD CONSTRAINT "staff_document_files_submission_id_staff_document_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."staff_document_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_document_sets_staff_idx" ON "staff_document_sets" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_document_sets_staff_type_unique" ON "staff_document_sets" USING btree ("staff_id","document_type");--> statement-breakpoint
CREATE INDEX "staff_document_submissions_set_idx" ON "staff_document_submissions" USING btree ("document_set_id");--> statement-breakpoint
CREATE INDEX "staff_document_submissions_review_status_idx" ON "staff_document_submissions" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "staff_document_submissions_expiry_idx" ON "staff_document_submissions" USING btree ("expiry_date") WHERE "expiry_date" is not null;--> statement-breakpoint
CREATE INDEX "staff_document_files_submission_idx" ON "staff_document_files" USING btree ("submission_id");--> statement-breakpoint
ALTER TABLE "staff_document_sets" ADD CONSTRAINT "staff_document_sets_current_submission_id_staff_document_submissions_id_fk" FOREIGN KEY ("current_submission_id") REFERENCES "public"."staff_document_submissions"("id") ON DELETE set null ON UPDATE no action;
