ALTER TYPE "public"."source_kind" ADD VALUE 'avzoku';--> statement-breakpoint
ALTER TABLE "data_sources" ALTER COLUMN "shop_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_sources" ADD COLUMN "max_pages" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "created_actresses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "created_shops" integer DEFAULT 0 NOT NULL;