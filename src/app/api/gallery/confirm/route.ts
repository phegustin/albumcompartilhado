import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";

export const runtime = "nodejs";

/**
 * POST /api/gallery/confirm
 *
 * Chamado DEPOIS que o arquivo já subiu para o storage. Só grava a linha no
 * banco. Se o álbum exigir moderação, a mídia entra como PENDING (não aparece
 * no telão até a cerimonialista aprovar).
 */
export async function POST(request: Request) {
  let corpo: {
    slug?: string;
    uploaderName?: string;
    uploaderDeviceId?: string;
    mediaType?: "PHOTO" | "VIDEO" | "AUDIO";
    categoryTag?: "MAKING_OF" | "CERIMONIA" | "RECEPCAO" | "PISTA" | "RECADOS";
    originalPath?: string;
    originalUrl?: string;
    thumbUrl?: string;
    caption?: string;
    durationSec?: number;
  };

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { slug, uploaderName, originalUrl } = corpo;

  if (!slug || !uploaderName || !originalUrl) {
    return NextResponse.json(
      { error: "slug, uploaderName e originalUrl são obrigatórios" },
      { status: 400 },
    );
  }

  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album) {
    return NextResponse.json({ error: "álbum não encontrado" }, { status: 404 });
  }

  const [criada] = await db
    .insert(mediaItems)
    .values({
      albumId: album.id,
      uploaderName: uploaderName.slice(0, 60),
      uploaderDeviceId: corpo.uploaderDeviceId ?? null,
      mediaType: corpo.mediaType ?? "PHOTO",
      categoryTag: corpo.categoryTag ?? "RECEPCAO",
      originalPath: corpo.originalPath ?? null,
      originalUrl,
      thumbUrl: corpo.thumbUrl ?? null,
      caption: corpo.caption?.slice(0, 300) ?? null,
      durationSec: corpo.durationSec ?? null,
      // Com moderação ligada, só aparece depois de aprovado.
      status: album.requireModeration ? "PENDING" : "APPROVED",
    })
    .returning();

  return NextResponse.json({ ok: true, media: criada }, { status: 201 });
}
