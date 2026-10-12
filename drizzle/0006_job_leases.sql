CREATE TABLE "job_leases" (
	"name" text PRIMARY KEY NOT NULL,
	"locked_until" timestamp with time zone NOT NULL
);
