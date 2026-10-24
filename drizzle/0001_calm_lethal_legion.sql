ALTER TYPE "public"."category_tag" ADD VALUE 'OUTROS';--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "showcase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "category_custom" text;