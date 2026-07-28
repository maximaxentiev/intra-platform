CREATE TYPE "public"."application_document_category" AS ENUM('training_proof', 'qualification_certificate', 'vulnerable_sector_check', 'first_aid_cpr', 'immunization_records', 'covid19_vaccination');--> statement-breakpoint
CREATE TYPE "public"."application_role" AS ENUM('eca', 'ece_rece', 'nanny');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('new', 'contacted', 'hired', 'rejected');--> statement-breakpoint
CREATE TABLE "application_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text NOT NULL,
	"event_type" text NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status",
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"category" "application_document_category" NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"checksum_sha256" text DEFAULT '' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"role" "application_role" NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text DEFAULT '' NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"gender" text DEFAULT '' NOT NULL,
	"gta_eligible" boolean,
	"status_in_canada" text DEFAULT '' NOT NULL,
	"experience_duration" text DEFAULT '' NOT NULL,
	"nanny_experience_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualification_status" text DEFAULT '' NOT NULL,
	"nanny_training_completed" boolean,
	"nanny_training_description" text DEFAULT '' NOT NULL,
	"vsc_status" text DEFAULT '' NOT NULL,
	"vsc_issue_or_request_date" date,
	"first_aid_cpr_status" text DEFAULT '' NOT NULL,
	"first_aid_cpr_expiry" date,
	"immunization_status" text DEFAULT '' NOT NULL,
	"covid_vaccination_status" text DEFAULT '' NOT NULL,
	"english_proficiency" text DEFAULT '' NOT NULL,
	"additional_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"form_id" text DEFAULT '' NOT NULL,
	"source_page" text DEFAULT '' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"consent_accepted" boolean DEFAULT false NOT NULL,
	"consent_policy_version" text DEFAULT '' NOT NULL,
	"consent_accepted_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contacted_at" timestamp with time zone,
	"contacted_by_user_id" uuid,
	"hired_at" timestamp with time zone,
	"hired_by_user_id" uuid,
	"hired_staff_id" uuid,
	"rejected_at" timestamp with time zone,
	"rejected_by_user_id" uuid,
	"rejection_email_sent_at" timestamp with time zone,
	"payload_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_hired_staff_id_unique" UNIQUE("hired_staff_id")
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "source_application_id" uuid;--> statement-breakpoint
ALTER TABLE "application_activity" ADD CONSTRAINT "application_activity_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_activity" ADD CONSTRAINT "application_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_contacted_by_user_id_users_id_fk" FOREIGN KEY ("contacted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_hired_by_user_id_users_id_fk" FOREIGN KEY ("hired_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_hired_staff_id_staff_id_fk" FOREIGN KEY ("hired_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_rejected_by_user_id_users_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_activity_application_idx" ON "application_activity" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "application_documents_application_idx" ON "application_documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_documents_category_idx" ON "application_documents" USING btree ("application_id","category");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_role_idx" ON "applications" USING btree ("role");--> statement-breakpoint
CREATE INDEX "applications_submitted_at_idx" ON "applications" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "applications_email_idx" ON "applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "applications_name_idx" ON "applications" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "applications_hired_staff_id_idx" ON "applications" USING btree ("hired_staff_id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_source_application_id_applications_id_fk" FOREIGN KEY ("source_application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_source_application_id_idx" ON "staff" USING btree ("source_application_id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_source_application_id_unique" UNIQUE("source_application_id");