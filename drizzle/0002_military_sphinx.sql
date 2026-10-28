ALTER TABLE "albums" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_short_code_unique" UNIQUE("short_code");