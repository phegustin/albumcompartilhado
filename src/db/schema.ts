/**
 * Schema do banco (Drizzle ORM).
 *
 * Espelha as tabelas pedidas no .md da galeria:
 *   albums, media_items, media_likes, media_comments
 *
 * Regras:
 *  - Nomes de tabela/coluna em snake_case no Postgres.
 *  - Todo vínculo usa onDelete: 'cascade' (apagar um álbum apaga suas mídias).
 *  - media_likes tem unique (media_id, device_id): impede curtida duplicada
 *    do mesmo celular.
 */
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/** Tipos de evento atendidos pela plataforma. */
export const eventTypeEnum = pgEnum("event_type", [
  "WEDDING", // Casamento
  "SWEET_15", // 15 Anos
  "GRADUATION", // Formatura
  "BIRTHDAY", // Aniversário
  "CORPORATE", // Evento Corporativo
  "OTHER",
]);

/** Paletas visuais selecionáveis pelo anfitrião. */
export const albumThemeEnum = pgEnum("album_theme", [
  "OLIVE_GOLD",
  "CLASSIC_NOIR",
  "TERRACOTTA",
  "ROSE_QUARTZ",
  "MIDNIGHT_PARTY",
]);

export const mediaTypeEnum = pgEnum("media_type", ["PHOTO", "VIDEO", "AUDIO"]);

/** "Momento" da festa em que a mídia foi registrada. */
export const categoryTagEnum = pgEnum("category_tag", [
  "MAKING_OF",
  "CERIMONIA",
  "RECEPCAO",
  "PISTA",
  "RECADOS",
  // "Outros": o convidado escreve o momento com as próprias palavras
  // (valsa, banquete, drinks...). O texto vai em media_items.category_custom.
  // Existe para a gente não precisar inflar esta lista com dezenas de
  // momentos que variam de festa pra festa.
  "OUTROS",
]);

export const mediaStatusEnum = pgEnum("media_status", [
  "PENDING",
  "APPROVED",
  "HIDDEN",
]);

/* -------------------------------------------------------------------------- */
/* Tabelas                                                                    */
/* -------------------------------------------------------------------------- */

/** Um evento (casamento, 15 anos, formatura…). Cada um tem seu próprio slug. */
export const albums = pgTable("albums", {
  id: uuid("id").primaryKey().defaultRandom(),

  slug: text("slug").notNull().unique(),
  eventType: eventTypeEnum("event_type").notNull().default("WEDDING"),
  title: text("title").notNull(), // Ex: "Helena & Gabriel"
  subtitle: text("subtitle"),
  eventDate: timestamp("event_date", { withTimezone: true }),
  coverUrl: text("cover_url"),
  theme: albumThemeEnum("theme").notNull().default("OLIVE_GOLD"),

  // Modo Cápsula do Tempo: convidados enviam durante a festa, mas o álbum só
  // é revelado para todos a partir de revealAt.
  capsuleMode: boolean("capsule_mode").notNull().default(false),
  revealAt: timestamp("reveal_at", { withTimezone: true }),

  // Se true, nada aparece no telão antes de ser aprovado.
  requireModeration: boolean("require_moderation").notNull().default(false),

  // PINs numéricos de 4 dígitos (acesso por link + PIN, sem login).
  hostPin: text("host_pin").notNull(),
  moderatorPin: text("moderator_pin").notNull(),

  // Marca white-label do rodapé viral.
  studioBrandName: text("studio_brand_name"),
  studioWhatsapp: text("studio_whatsapp"),

  /**
   * Só álbuns com showcase = true aparecem na vitrine (/).
   *
   * Por que existe: a vitrine listava TODOS os álbuns do banco. Bastava
   * alguém tocar no botão voltar dentro de um evento para cair numa lista
   * com os eventos de todos os outros clientes — inclusive o link do painel
   * de cada um. Vazamento de cliente na cara de outro cliente.
   *
   * Com isso, o padrão é NÃO aparecer: evento de cliente real fica invisível
   * na home, e só eventos de demonstração entram na vitrine.
   */
  showcase: boolean("showcase").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Uma foto, vídeo ou recado de voz enviado por um convidado. */
export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),

    uploaderName: text("uploader_name").notNull(), // Ex: "Tia Márcia"
    uploaderDeviceId: text("uploader_device_id"),

    mediaType: mediaTypeEnum("media_type").notNull().default("PHOTO"),
    categoryTag: categoryTagEnum("category_tag").notNull().default("RECEPCAO"),

    /**
     * Texto livre do momento, usado quando categoryTag = "OUTROS".
     *
     * Exemplos reais que não cabem na lista fixa: valsa, banquete, drinks,
     * hora do bolo, saída da noiva, mesa de doces. Cada festa tem os seus,
     * então em vez de inflar o enum deixamos a pessoa escrever — e o que ela
     * escrever fica salvo aqui e passa a ser sugerido para os próximos.
     */
    categoryCustom: text("category_custom"),

    // originalPath = caminho no bucket; originalUrl = URL do arquivo 100%
    // original (sem perda) para download dos anfitriões.
    originalPath: text("original_path"),
    originalUrl: text("original_url").notNull(),
    thumbUrl: text("thumb_url"), // WebP leve p/ feed e telão

    caption: text("caption"),
    durationSec: integer("duration_sec"), // vídeos e recados de voz

    likesCount: integer("likes_count").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    status: mediaStatusEnum("status").notNull().default("APPROVED"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("media_items_album_status_created_idx").on(t.albumId, t.status, t.createdAt),
    index("media_items_album_category_idx").on(t.albumId, t.categoryTag),
    index("media_items_album_pinned_idx").on(t.albumId, t.isPinned, t.createdAt),
  ],
);

/** Curtida. A unique (media_id, device_id) impede curtida duplicada. */
export const mediaLikes = pgTable(
  "media_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("media_likes_media_device_uq").on(t.mediaId, t.deviceId)],
);

/** Comentário curto deixado por um convidado em uma mídia. */
export const mediaComments = pgTable(
  "media_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_comments_media_created_idx").on(t.mediaId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Relations (usado pelo query builder relacional do Drizzle)                  */
/* -------------------------------------------------------------------------- */

export const albumsRelations = relations(albums, ({ many }) => ({
  mediaItems: many(mediaItems),
}));

export const mediaItemsRelations = relations(mediaItems, ({ one, many }) => ({
  album: one(albums, { fields: [mediaItems.albumId], references: [albums.id] }),
  likes: many(mediaLikes),
  comments: many(mediaComments),
}));

export const mediaLikesRelations = relations(mediaLikes, ({ one }) => ({
  media: one(mediaItems, { fields: [mediaLikes.mediaId], references: [mediaItems.id] }),
}));

export const mediaCommentsRelations = relations(mediaComments, ({ one }) => ({
  media: one(mediaItems, { fields: [mediaComments.mediaId], references: [mediaItems.id] }),
}));

/* -------------------------------------------------------------------------- */
/* Tipos inferidos                                                            */
/* -------------------------------------------------------------------------- */

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
export type MediaComment = typeof mediaComments.$inferSelect;
