CREATE TYPE "public"."album_theme" AS ENUM('OLIVE_GOLD', 'CLASSIC_NOIR', 'TERRACOTTA', 'ROSE_QUARTZ', 'MIDNIGHT_PARTY');--> statement-breakpoint
CREATE TYPE "public"."category_tag" AS ENUM('MAKING_OF', 'CERIMONIA', 'RECEPCAO', 'PISTA', 'RECADOS');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('WEDDING', 'SWEET_15', 'GRADUATION', 'BIRTHDAY', 'CORPORATE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('PENDING', 'APPROVED', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('PHOTO', 'VIDEO', 'AUDIO');--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"event_type" "event_type" DEFAULT 'WEDDING' NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"event_date" timestamp with time zone,
	"cover_url" text,
	"theme" "album_theme" DEFAULT 'OLIVE_GOLD' NOT NULL,
	"capsule_mode" boolean DEFAULT false NOT NULL,
	"reveal_at" timestamp with time zone,
	"require_moderation" boolean DEFAULT false NOT NULL,
	"host_pin" text NOT NULL,
	"moderator_pin" text NOT NULL,
	"studio_brand_name" text,
	"studio_whatsapp" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "albums_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"uploader_name" text NOT NULL,
	"uploader_device_id" text,
	"media_type" "media_type" DEFAULT 'PHOTO' NOT NULL,
	"category_tag" "category_tag" DEFAULT 'RECEPCAO' NOT NULL,
	"original_path" text,
	"original_url" text NOT NULL,
	"thumb_url" text,
	"caption" text,
	"duration_sec" integer,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" "media_status" DEFAULT 'APPROVED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_media_id_media_items_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_likes" ADD CONSTRAINT "media_likes_media_id_media_items_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_comments_media_created_idx" ON "media_comments" USING btree ("media_id","created_at");--> statement-breakpoint
CREATE INDEX "media_items_album_status_created_idx" ON "media_items" USING btree ("album_id","status","created_at");--> statement-breakpoint
CREATE INDEX "media_items_album_category_idx" ON "media_items" USING btree ("album_id","category_tag");--> statement-breakpoint
CREATE INDEX "media_items_album_pinned_idx" ON "media_items" USING btree ("album_id","is_pinned","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_likes_media_device_uq" ON "media_likes" USING btree ("media_id","device_id");