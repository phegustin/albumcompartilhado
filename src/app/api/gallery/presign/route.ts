import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { albums } from "@/db/schema";
import { createSignedUpload } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * POST /api/gallery/presign
 *
 * Devolve as URLs assinadas para o celular do convidado enviar o arquivo
 * DIRETO para o storage (Supabase/R2/local). O binário nunca passa por aqui.
 */
export async function POST(request: Request) {
  let corpo: { slug?: string; ext?: string; contentType?: string };

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { slug, ext, contentType } = corpo;

  if (!slug || !ext || !contentType) {
    return NextResponse.json(
      { error: "slug, ext e contentType são obrigatórios" },
      { status: 400 },
    );
  }

  // Confere que o álbum existe antes de assinar qualquer coisa.
  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album) {
    return NextResponse.json({ error: "álbum não encontrado" }, { status: 404 });
  }

  const [original, thumb] = await Promise.all([
    createSignedUpload({ albumSlug: slug, kind: "original", ext, contentType }),
    createSignedUpload({ albumSlug: slug, kind: "thumb", ext: "webp", contentType: "image/webp" }),
  ]);

  return NextResponse.json({ original, thumb });
}
