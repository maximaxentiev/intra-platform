ALTER TABLE "staff_accounts" ADD COLUMN "availability_onboarding_week1_start" date;--> statement-breakpoint
CREATE TABLE "staff_availability_unavailable_days" (
	"staff_id" uuid NOT NULL,
	"calendar_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_availability_unavailable_days_staff_id_calendar_date_pk" PRIMARY KEY("staff_id","calendar_date")
);
--> statement-breakpoint
ALTER TABLE "staff_availability_unavailable_days" ADD CONSTRAINT "staff_availability_unavailable_days_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_availability_unavailable_days_staff_idx" ON "staff_availability_unavailable_days" USING btree ("staff_id");
