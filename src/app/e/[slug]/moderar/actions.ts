"use server";

/**
 * Ações de moderação (celular da cerimonialista).
 *
 * Toda ação confere o PIN antes de mexer em qualquer coisa — o PIN nunca sai
 * do lado do servidor, e a URL com ?pin= só serve para abrir a porta.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";

export async function alterarStatus(
  slug: string,
  pin: string,
  mediaId: string,
  status: "APPROVED" | "HIDDEN" | "PENDING",
) {
  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album) return;

  // Só o PIN da cerimonialista ou o dos noivos autorizam.
  if (pin !== album.moderatorPin && pin !== album.hostPin) return;

  await db.update(mediaItems).set({ status }).where(eq(mediaItems.id, mediaId));

  revalidatePath(`/e/${slug}/moderar`);
  revalidatePath(`/e/${slug}`);
  revalidatePath(`/e/${slug}/telao`);
}

export async function alternarDestaque(slug: string, pin: string, mediaId: string) {
  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album || (pin !== album.moderatorPin && pin !== album.hostPin)) return;

  const [atual] = await db
    .select({ isPinned: mediaItems.isPinned })
    .from(mediaItems)
    .where(eq(mediaItems.id, mediaId))
    .limit(1);

  await db
    .update(mediaItems)
    .set({ isPinned: !atual?.isPinned })
    .where(eq(mediaItems.id, mediaId));

  revalidatePath(`/e/${slug}/moderar`);
  revalidatePath(`/e/${slug}`);
}
