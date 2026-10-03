CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'left');--> statement-breakpoint
CREATE TYPE "public"."link_provider" AS ENUM('fanza', 'myfans', 'other');--> statement-breakpoint
CREATE TYPE "public"."removal_status" AS ENUM('new', 'in_progress', 'done', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."requester_type" AS ENUM('actress', 'agency', 'shop', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'shop');--> statement-breakpoint
CREATE TYPE "public"."schedule_origin" AS ENUM('manual', 'shop', 'ingest');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('working', 'off');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('json_feed');--> statement-breakpoint
CREATE TABLE "actresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kana" text DEFAULT '' NOT NULL,
	"dmm_actress_id" text,
	"image_url" text DEFAULT '' NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"actress_id" integer NOT NULL,
	"provider" "link_provider" NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "source_kind" DEFAULT 'json_feed' NOT NULL,
	"url" text NOT NULL,
	"shop_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"terms_confirmed" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"actress_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"shop_display_name" text NOT NULL,
	"source_url" text NOT NULL,
	"source_note" text DEFAULT '' NOT NULL,
	"verified_at" date NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean DEFAULT false NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"unmatched_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "removal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_type" "requester_type" NOT NULL,
	"requester_name" text NOT NULL,
	"contact" text NOT NULL,
	"target_actress_id" integer,
	"target_text" text NOT NULL,
	"reason" text NOT NULL,
	"status" "removal_status" DEFAULT 'new' NOT NULL,
	"admin_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"status" "schedule_status" NOT NULL,
	"origin" "schedule_origin" DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pref_code" integer NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"genre" text DEFAULT '' NOT NULL,
	"official_url" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"business_hours" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"anonymous_av_count" integer DEFAULT 0 NOT NULL,
	"anonymous_av_source_url" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"shop_id" integer,
	"display_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_actress_id_actresses_id_fk" FOREIGN KEY ("actress_id") REFERENCES "public"."actresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_actress_id_actresses_id_fk" FOREIGN KEY ("actress_id") REFERENCES "public"."actresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_target_actress_id_actresses_id_fk" FOREIGN KEY ("target_actress_id") REFERENCES "public"."actresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actresses_name_idx" ON "actresses" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_actress_shop_uq" ON "enrollments" USING btree ("actress_id","shop_id");--> statement-breakpoint
CREATE INDEX "enrollments_shop_idx" ON "enrollments" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "ingest_runs_source_idx" ON "ingest_runs" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_enrollment_date_uq" ON "schedules" USING btree ("enrollment_id","work_date");--> statement-breakpoint
CREATE INDEX "schedules_date_idx" ON "schedules" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "shops_pref_idx" ON "shops" USING btree ("pref_code");