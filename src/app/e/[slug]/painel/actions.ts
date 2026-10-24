"use server";

/** Ações do painel dos noivos (sempre conferem o PIN antes de salvar). */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { albums } from "@/db/schema";

export async function salvarConfiguracoes(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const pin = String(formData.get("pin") ?? "");

  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album || pin !== album.hostPin) return;

  const tema = String(formData.get("theme") ?? album.theme);
  const titulo = String(formData.get("title") ?? album.title).trim();
  const subtitulo = String(formData.get("subtitle") ?? "").trim();

  await db
    .update(albums)
    .set({
      theme: tema as typeof album.theme,
      title: titulo || album.title,
      subtitle: subtitulo || null,
      capsuleMode: formData.get("capsuleMode") === "on",
      requireModeration: formData.get("requireModeration") === "on",
      /*
       * Marca e WhatsApp do estúdio NÃO entram aqui de propósito.
       *
       * Esse campo alimenta o rodapé viral ("Memórias ao vivo por [Marca] •
       * Quer ter no seu evento? [WhatsApp]"), que é divulgação de quem
       * presta o serviço — não do cliente. Deixar os noivos editarem
       * permitiria trocar a marca do estúdio pela deles. Só o Super Admin
       * mexe nisso.
       */
      updatedAt: new Date(),
    })
    .where(eq(albums.id, album.id));

  revalidatePath(`/e/${slug}/painel`);
  revalidatePath(`/e/${slug}`);
  revalidatePath(`/e/${slug}/telao`);
}
