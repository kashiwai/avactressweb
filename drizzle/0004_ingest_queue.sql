CREATE TYPE "public"."queue_status" AS ENUM('pending', 'done', 'error');--> statement-breakpoint
CREATE TABLE "ingest_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"run_id" integer,
	"run_date" date NOT NULL,
	"url" text NOT NULL,
	"status" "queue_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_queue" ADD CONSTRAINT "ingest_queue_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_queue" ADD CONSTRAINT "ingest_queue_run_id_ingest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingest_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_queue_source_date_url_uq" ON "ingest_queue" USING btree ("source_id","run_date","url");--> statement-breakpoint
CREATE INDEX "ingest_queue_status_idx" ON "ingest_queue" USING btree ("status","run_date");