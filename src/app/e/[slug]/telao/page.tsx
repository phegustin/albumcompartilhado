import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import QRCode from "qrcode";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { TelaoView } from "@/components/telao/telao-view";

/**
 * Telão ao vivo: /e/[slug]/telao
 *
 * Só entram aqui mídias APPROVED — se o álbum exigir moderação, o que está
 * PENDING fica de fora até a cerimonialista aprovar no celular dela.
 */
export default async function TelaoPage({
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

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const qrCodeDataUrl = await QRCode.toDataURL(`${base}/e/${slug}`, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#FFFFFF" },
  });

  const midias = await db
    .select()
    .from(mediaItems)
    .where(
      and(eq(mediaItems.albumId, album.id), eq(mediaItems.status, "APPROVED")),
    )
    .orderBy(desc(mediaItems.createdAt));

  return (
    <TelaoView
      slug={album.slug}
      titulo={album.title}
      tema={album.theme}
      qrCodeDataUrl={qrCodeDataUrl}
      midias={midias.map((m) => ({
        id: m.id,
        uploaderName: m.uploaderName,
        mediaType: m.mediaType,
        originalUrl: m.originalUrl,
        thumbUrl: m.thumbUrl,
        caption: m.caption,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
