ALTER TABLE "applications" ADD COLUMN "external_submission_id" text;--> statement-breakpoint
UPDATE "applications" SET "external_submission_id" = "id"::text WHERE "external_submission_id" IS NULL;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "external_submission_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "applications_external_submission_id_idx" ON "applications" USING btree ("external_submission_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_external_submission_id_unique" UNIQUE("external_submission_id");
