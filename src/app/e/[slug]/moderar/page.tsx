import { notFound } from "next/navigation";
import { desc, eq, or } from "drizzle-orm";
import { Check, EyeOff, Pin, RotateCcw } from "lucide-react";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { themeStyle } from "@/lib/themes";
import { BackButton } from "@/components/ui/back-button";
import { alterarStatus, alternarDestaque } from "./actions";

/**
 * Moderação no celular da cerimonialista: /e/[slug]/moderar?pin=1234
 *
 * O PIN vem pela URL justamente para ela abrir em 5 segundos, sem login.
 * Sem PIN (ou com PIN errado) a página mostra só o pedido de senha.
 */
export default async function ModerarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pin?: string }>;
}) {
  const { slug } = await params;
  const { pin } = await searchParams;

  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album) notFound();

  const liberado = Boolean(
    pin && (pin === album.moderatorPin || pin === album.hostPin),
  );

  /* ----------------------------- Porta ---------------------------- */
  if (!liberado) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6" style={themeStyle(album.theme)}>
        <div className="w-full max-w-sm">
          <BackButton destino={`/e/${slug}`} rotulo="Voltar" />
        </div>
        <div className="w-full max-w-sm rounded-3xl border border-album-border bg-album-surface p-7 text-center">
          <h1 className="font-display text-3xl font-semibold text-album-text">
            Moderação
          </h1>
          <p className="mt-1 text-sm text-album-muted">{album.title}</p>

          <form className="mt-6 space-y-3">
            <input
              name="pin"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN de 4 dígitos"
              className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-3 text-center text-2xl tracking-[0.5em] text-album-text focus:border-album-accent focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-album-primary px-4 py-3 text-sm font-semibold text-album-on-primary"
            >
              Entrar
            </button>
          </form>

          {pin && (
            <p className="mt-4 text-xs text-red-600">PIN incorreto.</p>
          )}
        </div>
      </main>
    );
  }

  /* --------------------------- Painel ---------------------------- */
  const midias = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.albumId, album.id))
    .orderBy(desc(mediaItems.createdAt));

  const pendentes = midias.filter((m) => m.status === "PENDING");
  const noAr = midias.filter((m) => m.status === "APPROVED");
  const ocultas = midias.filter((m) => m.status === "HIDDEN");

  function Cartao({
    midia,
  }: {
    midia: typeof midias[number];
  }) {
    return (
      <li className="overflow-hidden rounded-2xl border border-album-border bg-album-surface">
        <div className="relative aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={midia.thumbUrl ?? midia.originalUrl}
            alt={midia.caption ?? midia.uploaderName}
            className="h-full w-full object-cover"
          />
          {midia.isPinned && (
            <span className="absolute top-2 left-2 rounded-full bg-album-accent p-1.5">
              <Pin className="size-3 text-album-on-primary" />
            </span>
          )}
        </div>

        <div className="p-3">
          <p className="truncate text-xs font-medium text-album-text">
            {midia.uploaderName}
          </p>
          {midia.caption && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-album-muted">
              {midia.caption}
            </p>
          )}

          <div className="mt-3 flex gap-1.5">
            {midia.status !== "APPROVED" && (
              <form
                action={alterarStatus.bind(null, slug, pin!, midia.id, "APPROVED")}
              >
                <button className="flex items-center gap-1 rounded-lg bg-album-primary px-2.5 py-1.5 text-[11px] font-medium text-album-on-primary">
                  <Check className="size-3" />
                  Aprovar
                </button>
              </form>
            )}

            {midia.status !== "HIDDEN" && (
              <form
                action={alterarStatus.bind(null, slug, pin!, midia.id, "HIDDEN")}
              >
                <button className="flex items-center gap-1 rounded-lg border border-album-border px-2.5 py-1.5 text-[11px] font-medium text-album-text">
                  <EyeOff className="size-3" />
                  Ocultar
                </button>
              </form>
            )}

            {midia.status === "HIDDEN" && (
              <form
                action={alterarStatus.bind(null, slug, pin!, midia.id, "PENDING")}
              >
                <button className="flex items-center gap-1 rounded-lg border border-album-border px-2.5 py-1.5 text-[11px] font-medium text-album-text">
                  <RotateCcw className="size-3" />
                  Reabrir
                </button>
              </form>
            )}

            <form action={alternarDestaque.bind(null, slug, pin!, midia.id)}>
              <button className="flex items-center gap-1 rounded-lg border border-album-border px-2.5 py-1.5 text-[11px] font-medium text-album-text">
                <Pin className="size-3" />
                {midia.isPinned ? "Soltar" : "Destacar"}
              </button>
            </form>
          </div>
        </div>
      </li>
    );
  }

  return (
    <main className="min-h-dvh p-5" style={themeStyle(album.theme)}>
      <header className="mb-6">
        <BackButton destino={`/e/${slug}`} rotulo="Voltar para o álbum" />
        <h1 className="font-display mt-5 text-3xl font-semibold text-album-text">
          Moderação
        </h1>
        <p className="mt-0.5 text-sm text-album-muted">{album.title}</p>
      </header>

      {/* Pendentes primeiro: é a fila que ela precisa limpar. */}
      {pendentes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-album-muted uppercase">
            Pendentes ({pendentes.length})
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pendentes.map((m) => (
              <Cartao key={m.id} midia={m} />
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-album-muted uppercase">
          No ar ({noAr.length})
        </h2>
        {noAr.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-album-border py-10 text-center text-sm text-album-muted">
            Nada no ar ainda.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {noAr.map((m) => (
              <Cartao key={m.id} midia={m} />
            ))}
          </ul>
        )}
      </section>

      {ocultas.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-album-muted uppercase">
            Ocultas ({ocultas.length})
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ocultas.map((m) => (
              <Cartao key={m.id} midia={m} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
