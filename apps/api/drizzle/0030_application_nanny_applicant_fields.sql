ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "preferred_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "postal_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "accuracy_confirmed" boolean;
