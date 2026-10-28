import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/albums/[slug]/midias
 *
 * Devolve a lista de mídias aprovadas de um evento.
 *
 * Existe para o TELÃO conseguir puxar o que chegou depois que a página
 * carregou. Sem isso, o telão era "ao vivo" só no nome: ele recebia as
 * fotos uma única vez, na abertura, e o que fosse enviado durante a festa
 * não aparecia sem alguém recarregar a página.
 *
 * Só devolve status APPROVED — se o evento exigir moderação, o que está
 * PENDING fica de fora até a cerimonialista aprovar, exatamente como na
 * página do telão.
 *
 * Não expõe nada sensível: é o mesmo recorte que qualquer convidado já vê
 * na galeria.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [album] = await db
    .select({ id: albums.id })
    .from(albums)
    .where(eq(albums.slug, slug))
    .limit(1);

  if (!album) {
    return NextResponse.json({ error: "álbum não encontrado" }, { status: 404 });
  }

  const midias = await db
    .select({
      id: mediaItems.id,
      uploaderName: mediaItems.uploaderName,
      mediaType: mediaItems.mediaType,
      originalUrl: mediaItems.originalUrl,
      thumbUrl: mediaItems.thumbUrl,
      caption: mediaItems.caption,
      createdAt: mediaItems.createdAt,
    })
    .from(mediaItems)
    .where(
      and(eq(mediaItems.albumId, album.id), eq(mediaItems.status, "APPROVED")),
    )
    .orderBy(desc(mediaItems.createdAt));

  return NextResponse.json(
    {
      total: midias.length,
      midias: midias.map((m) => ({
        id: m.id,
        uploaderName: m.uploaderName,
        mediaType: m.mediaType,
        originalUrl: m.originalUrl,
        thumbUrl: m.thumbUrl,
        caption: m.caption,
        createdAt: m.createdAt.toISOString(),
      })),
    },
    {
      headers: {
        // O telão consulta a cada poucos segundos; não faz sentido servir
        // resposta cacheada por minutos.
        "cache-control": "no-store",
      },
    },
  );
}
