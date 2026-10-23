import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Camera, Crown, QrCode, Settings, ShieldCheck, Tv, ArrowRight } from "lucide-react";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { themeStyle } from "@/lib/themes";

/**
 * Vitrine comercial (/).
 *
 * É a página que você abre na reunião com a noiva ou a cerimonialista:
 * apresenta o produto e dá os links diretos para testar cada visão ao vivo.
 */
export default async function Home() {
  const eventos = await db.select().from(albums).orderBy(desc(albums.createdAt));

  const contagens = await db
    .select({
      albumId: mediaItems.albumId,
      total: sql<number>`count(*)::int`,
    })
    .from(mediaItems)
    .groupBy(mediaItems.albumId);

  const totalPorAlbum = new Map(contagens.map((c) => [c.albumId, c.total]));

  return (
    <main className="min-h-dvh" style={themeStyle("OLIVE_GOLD")}>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--album-accent) 22%, transparent), transparent 70%)",
          }}
        />

        <p className="text-xs tracking-[0.28em] text-album-muted uppercase">
          Galeria compartilhada por QR Code
        </p>

        <h1 className="font-display mt-5 text-5xl leading-[1.05] font-semibold text-album-text sm:text-6xl">
          Todas as fotos da festa,
          <br />
          <span className="italic" style={{ color: "var(--album-accent)" }}>
            na mão de todo mundo
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-album-muted">
          Os convidados escaneiam o QR Code da mesa e enviam fotos, vídeos e
          recados de voz — <strong className="font-semibold text-album-text">sem baixar aplicativo e sem criar senha</strong>.
          Tudo aparece ao vivo no telão do DJ.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-album-border bg-album-surface px-4 py-1.5 text-xs text-album-muted">
            Casamentos · 15 Anos · Formaturas
          </span>
          <span className="rounded-full border border-album-border bg-album-surface px-4 py-1.5 text-xs text-album-muted">
            Aniversários · Corporativo
          </span>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Eventos cadastrados                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <Camera className="size-4 text-album-muted" />
          <h2 className="text-sm font-semibold tracking-[0.2em] text-album-muted uppercase">
            Eventos para testar
          </h2>
        </div>

        {eventos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-album-border bg-album-surface p-10 text-center">
            <p className="text-album-muted">
              Nenhum evento ainda. Rode{" "}
              <code className="rounded bg-album-bg px-1.5 py-0.5 text-album-text">
                npm run db:seed
              </code>{" "}
              para criar o evento de demonstração.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {eventos.map((evento) => {
              const total = totalPorAlbum.get(evento.id) ?? 0;
              return (
                <article
                  key={evento.id}
                  className="overflow-hidden rounded-3xl border border-album-border bg-album-surface"
                  style={themeStyle(evento.theme)}
                >
                  {evento.coverUrl ? (
                    // Imagem local: usa <img> porque a URL é dinâmica.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={evento.coverUrl}
                      alt={evento.title}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-44 w-full items-center justify-center"
                      style={{ background: "var(--album-bg)" }}
                    >
                      <Camera className="size-8 text-album-muted" />
                    </div>
                  )}

                  <div className="p-5">
                    <h3 className="font-display text-2xl font-semibold text-album-text">
                      {evento.title}
                    </h3>
                    {evento.subtitle && (
                      <p className="mt-0.5 text-sm text-album-muted">{evento.subtitle}</p>
                    )}
                    <p className="mt-3 text-xs text-album-muted">
                      {total} {total === 1 ? "mídia registrada" : "mídias registradas"}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <Link
                        href={`/e/${evento.slug}`}
                        className="col-span-2 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-album-on-primary transition-opacity hover:opacity-90"
                        style={{ background: "var(--album-primary)" }}
                      >
                        <QrCode className="size-4" />
                        Visão do convidado
                      </Link>

                      <Link
                        href={`/e/${evento.slug}/telao`}
                        className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                      >
                        <Tv className="size-3.5" />
                        Telão ao vivo
                      </Link>

                      <Link
                        href={`/e/${evento.slug}/moderar`}
                        className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                      >
                        <ShieldCheck className="size-3.5" />
                        Moderação
                      </Link>

                      <Link
                        href={`/e/${evento.slug}/painel`}
                        className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                      >
                        <Crown className="size-3.5" />
                        Painel dos noivos
                      </Link>

                      <Link
                        href={`/e/${evento.slug}`}
                        className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                      >
                        <ArrowRight className="size-3.5" />
                        Abrir galeria
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-album-border px-5 py-3 text-sm font-medium text-album-text hover:bg-album-surface"
          >
            <Settings className="size-4" />
            Super Admin multi-eventos
          </Link>
        </div>
      </section>
    </main>
  );
}
