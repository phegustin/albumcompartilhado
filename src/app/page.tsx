import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  Camera,
  Crown,
  QrCode,
  Settings,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
  Zap,
} from "lucide-react";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { themeStyle } from "@/lib/themes";
import { caminhoSecreto } from "@/lib/admin-auth";

/**
 * Vitrine comercial (/).
 *
 * É a página que você abre na reunião com a noiva ou a cerimonialista:
 * apresenta o produto e dá os links diretos para testar cada visão ao vivo.
 */

/**
 * Dinâmica de propósito. Sem isso o Next tenta pré-renderizar esta página
 * durante o build — e ela consulta o banco, o que (a) faz o build falhar
 * quando o banco não está alcançável e (b) congelaria a lista de eventos
 * na data do deploy. Aqui os dados precisam estar sempre frescos.
 */
export const dynamic = "force-dynamic";
export default async function Home() {
  /**
   * Só entra na vitrine quem está explicitamente marcado como showcase.
   *
   * Antes isso listava TODOS os álbuns do banco. Como a vitrine mostra o
   * link do painel de cada evento, um cliente que chegasse aqui via o evento
   * de todos os outros clientes. Agora o padrão é não aparecer: só eventos
   * de demonstração são marcados.
   */
  const eventos = await db
    .select()
    .from(albums)
    .where(eq(albums.showcase, true))
    .orderBy(desc(albums.createdAt));

  const contagens = await db
    .select({
      albumId: mediaItems.albumId,
      total: sql<number>`count(*)::int`,
    })
    .from(mediaItems)
    .groupBy(mediaItems.albumId);

  const totalPorAlbum = new Map(contagens.map((c) => [c.albumId, c.total]));

  return (
    <main
      className="min-h-dvh"
      style={{ ...themeStyle("OLIVE_GOLD"), background: "var(--album-bg)" }}
    >
      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-album-surface px-3.5 py-1.5 text-xs font-medium text-album-muted shadow-sm">
          <Sparkles className="size-3.5" style={{ color: "var(--album-accent)" }} />
          Galeria compartilhada por QR Code
        </span>

        <h1 className="font-display mt-7 text-[3.25rem] leading-[1.02] font-semibold text-album-text sm:text-6xl">
          Todas as fotos da festa,
          <br />
          <span className="italic" style={{ color: "var(--album-accent)" }}>
            na mão de todo mundo
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-album-muted">
          Os convidados escaneiam o QR Code da mesa e enviam fotos, vídeos e
          recados de voz — sem baixar aplicativo e sem criar senha. Tudo aparece
          ao vivo no telão.
        </p>

        {/* Três diferenciais, sem poluir */}
        <div className="mx-auto mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">
          {[
            {
              icone: QrCode,
              titulo: "Sem app",
              texto: "A câmera do celular resolve. Zero download.",
            },
            {
              icone: Zap,
              titulo: "Ao vivo",
              texto: "A foto aparece no telão em segundos.",
            },
            {
              icone: Users,
              titulo: "Sem limite",
              texto: "150 convidados enviando juntos.",
            },
          ].map((item) => (
            <div
              key={item.titulo}
              className="rounded-2xl bg-album-surface p-5 text-left shadow-sm"
            >
              <item.icone
                className="size-5"
                style={{ color: "var(--album-accent)" }}
              />
              <p className="mt-3 text-sm font-semibold text-album-text">
                {item.titulo}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-album-muted">
                {item.texto}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================== EVENTOS =========================== */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <Camera className="size-4 text-album-muted" />
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-album-muted uppercase">
            Eventos para testar
          </h2>
        </div>

        {eventos.length === 0 ? (
          <div className="rounded-3xl bg-album-surface p-12 text-center shadow-sm">
            <p className="text-sm text-album-muted">
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
                  className="overflow-hidden rounded-3xl bg-album-surface shadow-sm"
                  style={themeStyle(evento.theme)}
                >
                  <div className="relative h-48">
                    {evento.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={evento.coverUrl}
                        alt={evento.title}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-album-bg">
                        <Camera className="size-8 text-album-muted" />
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="font-display text-3xl leading-tight font-semibold text-album-text">
                      {evento.title}
                    </h3>
                    {evento.subtitle && (
                      <p className="mt-1 text-sm text-album-muted">
                        {evento.subtitle}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-album-muted">
                      {total} {total === 1 ? "mídia registrada" : "mídias registradas"}
                    </p>

                    <Link
                      href={`/e/${evento.slug}`}
                      className="mt-5 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-album-on-primary transition-transform active:scale-[.98]"
                      style={{ background: "var(--album-primary)" }}
                    >
                      <QrCode className="size-4" />
                      Abrir visão do convidado
                    </Link>

                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      {[
                        { href: `/e/${evento.slug}/telao`, icone: Tv, label: "Telão" },
                        {
                          href: `/e/${evento.slug}/moderar`,
                          icone: ShieldCheck,
                          label: "Moderar",
                        },
                        {
                          href: `/e/${evento.slug}/painel`,
                          icone: Crown,
                          label: "Noivos",
                        },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center justify-center gap-1.5 rounded-2xl bg-album-bg px-2 py-2.5 text-xs font-medium text-album-muted transition-colors hover:text-album-text"
                        >
                          <item.icone className="size-3.5" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/*
         * O atalho do Super Admin NÃO aparece na vitrine pública quando existe
         * um endereço secreto configurado (ADMIN_PATH).
         *
         * Motivo: esta página é aberta por convidados do evento. Deixar aqui um
         * botão "Super Admin" é como deixar a porta da gerência no meio do
         * salão — mostra onde fica a fechadura para quem não tem nada a ver
         * com isso. Em produção o painel é acessado só pelo endereço secreto.
         */}
        {!caminhoSecreto() && (
          <div className="mt-10 flex justify-center">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl bg-album-surface px-5 py-3.5 text-sm font-medium text-album-text shadow-sm"
            >
              <Settings className="size-4" />
              Super Admin multi-eventos
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
