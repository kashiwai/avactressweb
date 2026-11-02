ALTER TYPE "public"."source_kind" ADD VALUE 'adultinfo';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE 'fuuav';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE 'koukyuderi';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE 'avfuuzoku';--> statement-breakpoint
ALTER TABLE "actresses" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;