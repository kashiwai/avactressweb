ALTER TABLE "actresses" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "bust" integer;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "waist" integer;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "hip" integer;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "cup" text;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "birthplace" text;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "debut_year" integer;--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "genres" jsonb DEFAULT '[]'::jsonb NOT NULL;