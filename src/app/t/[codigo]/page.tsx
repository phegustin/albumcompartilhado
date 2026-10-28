import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { albums } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Endereço curto do TELÃO: /t/HX7K2P  ->  /e/<slug>/telao
 *
 * Existe porque o endereço completo tem mais de 90 caracteres e ninguém
 * digita isso no controle remoto da TV. Com o código curto, ligar o telão
 * na festa é digitar seis caracteres.
 *
 * O código não é segredo: ele só aponta para uma tela que qualquer pessoa
 * do evento já poderia abrir pelo endereço longo. Não expõe PIN nenhum.
 */
export default async function AtalhoTelao({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const alvo = await buscarSlug(codigo);
  if (!alvo) notFound();
  redirect(`/e/${alvo}/telao`);
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
