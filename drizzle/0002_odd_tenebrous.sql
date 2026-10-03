CREATE TYPE "public"."candidate_status" AS ENUM('pending', 'linked', 'ignored');--> statement-breakpoint
CREATE TABLE "candidate_girls" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"source" text DEFAULT 'cityheaven' NOT NULL,
	"display_name" text NOT NULL,
	"girl_url" text NOT NULL,
	"shop_name" text NOT NULL,
	"shop_url" text DEFAULT '' NOT NULL,
	"pref_code" integer NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"genre" text DEFAULT '' NOT NULL,
	"status" "candidate_status" DEFAULT 'pending' NOT NULL,
	"linked_actress_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "candidate_girls" ADD CONSTRAINT "candidate_girls_linked_actress_id_actresses_id_fk" FOREIGN KEY ("linked_actress_id") REFERENCES "public"."actresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_girls" ADD CONSTRAINT "candidate_girls_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_girls_source_external_uq" ON "candidate_girls" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "candidate_girls_status_idx" ON "candidate_girls" USING btree ("status");