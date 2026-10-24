import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { GuestView } from "@/components/gallery/guest-view";

/**
 * Página do convidado: /e/[slug]
 *
 * É a tela que abre quando a pessoa aponta a câmera do celular para o QR Code
 * da mesa. Zero login, zero senha, zero download.
 */
export default async function EventoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [album] = await db
    .select()
    .from(albums)
    .where(eq(albums.slug, slug))
    .limit(1);

  if (!album) notFound();

  const midias = await db
    .select()
    .from(mediaItems)
    .where(
      and(eq(mediaItems.albumId, album.id), eq(mediaItems.status, "APPROVED")),
    )
    .orderBy(asc(mediaItems.createdAt));

  // Converte Date para string: o componente é client e só recebe dados
  // serializáveis.
  const midiasSerializadas = midias.map((m) => ({
    id: m.id,
    uploaderName: m.uploaderName,
    mediaType: m.mediaType,
    categoryTag: m.categoryTag,
    categoryCustom: m.categoryCustom,
    originalUrl: m.originalUrl,
    thumbUrl: m.thumbUrl,
    caption: m.caption,
    likesCount: m.likesCount,
    isPinned: m.isPinned,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <GuestView
      album={{
        slug: album.slug,
        title: album.title,
        subtitle: album.subtitle,
        eventType: album.eventType,
        theme: album.theme,
        coverUrl: album.coverUrl,
        studioBrandName: album.studioBrandName,
        studioWhatsapp: album.studioWhatsapp,
      }}
      midias={midiasSerializadas}
    />
  );
}
