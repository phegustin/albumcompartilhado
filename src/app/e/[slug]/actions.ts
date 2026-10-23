"use server";

/**
 * Server actions da galeria do convidado.
 *
 * Curtir precisa passar pelo servidor por dois motivos:
 *   1) o contador (likes_count) precisa ser atualizado junto;
 *   2) a regra "um celular curte a mesma mídia só uma vez" é garantida por
 *      uma constraint UNIQUE no banco — não dá pra confiar só no navegador.
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { mediaItems, mediaLikes } from "@/db/schema";

export type ResultadoCurtida = {
  ok: boolean;
  curtido: boolean;
  total: number;
};

/**
 * Marca ou desmarca a curtida de um celular numa mídia.
 * `deviceId` vem do localStorage do convidado (nenhum login envolvido).
 */
export async function alternarCurtida(
  mediaId: string,
  deviceId: string,
): Promise<ResultadoCurtida> {
  if (!mediaId || !deviceId) {
    return { ok: false, curtido: false, total: 0 };
  }

  // Já curtiu? Então é para remover.
  const [existente] = await db
    .select({ id: mediaLikes.id })
    .from(mediaLikes)
    .where(and(eq(mediaLikes.mediaId, mediaId), eq(mediaLikes.deviceId, deviceId)))
    .limit(1);

  if (existente) {
    await db.delete(mediaLikes).where(eq(mediaLikes.id, existente.id));
    const atualizada = await db
      .update(mediaItems)
      .set({ likesCount: sql`greatest(${mediaItems.likesCount} - 1, 0)` })
      .where(eq(mediaItems.id, mediaId))
      .returning({ likesCount: mediaItems.likesCount });

    return {
      ok: true,
      curtido: false,
      total: atualizada[0]?.likesCount ?? 0,
    };
  }

  // onConflictDoNothing: se o mesmo celular mandar duas vezes muito rápido,
  // a constraint UNIQUE absorve o duplo sem estourar erro.
  await db
    .insert(mediaLikes)
    .values({ mediaId, deviceId })
    .onConflictDoNothing();

  const atualizada = await db
    .update(mediaItems)
    .set({ likesCount: sql`${mediaItems.likesCount} + 1` })
    .where(eq(mediaItems.id, mediaId))
    .returning({ likesCount: mediaItems.likesCount });

  return {
    ok: true,
    curtido: true,
    total: atualizada[0]?.likesCount ?? 0,
  };
}
