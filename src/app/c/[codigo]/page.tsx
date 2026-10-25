import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { albums } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Endereço curto dos CONVIDADOS: /c/HX7K2P  ->  /e/<slug>
 *
 * Bom para mandar no WhatsApp em vez do endereço gigante, e para imprimir
 * embaixo do QR Code na plaquinha de mesa: se o celular de alguém não
 * conseguir ler o QR (câmera ruim, vidro em cima da mesa), a pessoa ainda
 * tem o código para digitar.
 *
 * O código não é segredo: leva exatamente à mesma galeria do endereço
 * longo. Não dá acesso ao painel dos noivos nem à moderação.
 */
export default async function AtalhoConvidado({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const alvo = await buscarSlug(codigo);
  if (!alvo) notFound();
  redirect(`/e/${alvo}`);
}

/** Procura ignorando maiúsculas e espaços (o código é impresso com espaço). */
async function buscarSlug(codigo: string): Promise<string | null> {
  const limpo = codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!limpo) return null;

  const [album] = await db
    .select({ slug: albums.slug })
    .from(albums)
    .where(eq(albums.shortCode, limpo))
    .limit(1);

  return album?.slug ?? null;
}
