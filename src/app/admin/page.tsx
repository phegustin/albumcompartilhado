import { cookies } from "next/headers";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import {
  ChevronDown,
  Crown,
  LogOut,
  PencilLine,
  QrCode,
  ShieldCheck,
  Tv,
} from "lucide-react";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { themeStyle } from "@/lib/themes";
import { BackButton } from "@/components/ui/back-button";
import { LinkEvento } from "@/components/admin/link-evento";
import { LinksCurtos } from "@/components/ui/links-curtos";
import { COOKIE_ADMIN, tokenValido } from "@/lib/admin-auth";
import { ExcluirEvento } from "@/components/admin/excluir-evento";
import {
  criarAlbum,
  editarAlbum,
  entrarAdmin,
  excluirAlbum,
  sairAdmin,
} from "./actions";

/**
 * Mensagens amigáveis para cada código de erro.
 *
 * Antes só "senha-errada" e "senha-nao-configurada" tinham mensagem. Os
 * outros códigos voltavam para a tela e ninguém via nada — era exatamente a
 * sensação de "cliquei e não aconteceu nada".
 */
const MENSAGENS_ERRO: Record<string, string> = {
  "senha-errada": "Senha incorreta.",
  "senha-nao-configurada":
    "A variável ADMIN_PASSWORD não está definida no servidor. Sem ela o painel não abre.",
  "muitas-tentativas":
    "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.",
  "dados-invalidos":
    "Preencha o título e um endereço válido (use letras e números, sem acento).",
  "erro-ao-criar":
    "Não foi possível criar o evento. Pode ser um endereço (slug) já usado — tente outro nome.",
  "erro-ao-editar": "Não foi possível salvar as alterações. Tente de novo.",
  "erro-ao-excluir": "Não foi possível excluir. Tente de novo.",
  "evento-nao-encontrado":
    "Esse evento não existe mais — talvez já tenha sido excluído.",
};

/**
 * Super Admin multi-eventos.
 *
 * Painel comercial: cria os eventos e copia os 4 links prontos para mandar
 * no WhatsApp do cliente.
 *
 * O endereço real é secreto (ADMIN_PATH). `/admin` só responde quando nenhum
 * caminho secreto está configurado — ver src/middleware.ts.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    criado?: string;
    editado?: string;
    excluido?: string;
  }>;
}) {
  const { erro, criado, editado, excluido } = await searchParams;
  const store = await cookies();
  /*
   * Antes isso era `=== "1"`, e o cookie era forjável por qualquer pessoa.
   * Agora o valor é um token assinado com a própria senha do admin.
   */
  const autorizado = tokenValido(store.get(COOKIE_ADMIN)?.value);
  const senhaConfigurada = Boolean(process.env.ADMIN_PASSWORD);

  /* ------------------------------------------------------------------ */
  /* Tela de senha                                                       */
  /* ------------------------------------------------------------------ */
  if (!autorizado) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6" style={themeStyle("CLASSIC_NOIR")}>
        <div className="w-full max-w-sm">
          <BackButton destino="/" rotulo="Voltar" />
        </div>
        <div className="w-full max-w-sm rounded-3xl border border-album-border bg-album-surface p-7">
          <h1 className="font-display text-3xl font-semibold text-album-text">
            Super Admin
          </h1>
          <p className="mt-1 text-sm text-album-muted">
            Painel comercial multi-eventos
          </p>

          {!senhaConfigurada && (
            <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              A variável <code>ADMIN_PASSWORD</code> não está definida no .env.
              Defina ela e reinicie o servidor para liberar o acesso.
            </p>
          )}

          {erro && (
            <p className="mt-5 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              {MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente de novo."}
            </p>
          )}

          <form action={entrarAdmin} className="mt-6 space-y-3">
            <input
              type="password"
              name="senha"
              placeholder="Senha do admin"
              className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-3 text-sm text-album-text focus:border-album-accent focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-album-primary px-4 py-3 text-sm font-semibold text-album-on-primary"
            >
              Entrar
            </button>
          </form>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Painel                                                              */
  /* ------------------------------------------------------------------ */
  const eventos = await db.select().from(albums).orderBy(desc(albums.createdAt));

  const contagens = await db
    .select({
      albumId: mediaItems.albumId,
      total: sql<number>`count(*)::int`,
    })
    .from(mediaItems)
    .groupBy(mediaItems.albumId);

  const totalPorAlbum = new Map(contagens.map((c) => [c.albumId, c.total]));
  const base = await getBaseUrl();

  return (
    <main className="min-h-dvh p-6" style={themeStyle("CLASSIC_NOIR")}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <BackButton destino="/" rotulo="Voltar para a vitrine" />
            <h1 className="font-display mt-5 text-4xl font-semibold text-album-text">
              Super Admin
            </h1>
            <p className="mt-1 text-sm text-album-muted">
              {eventos.length} {eventos.length === 1 ? "evento" : "eventos"} cadastrados
            </p>
          </div>
          <form action={sairAdmin}>
            <button className="flex items-center gap-2 rounded-xl border border-album-border px-3 py-2 text-xs text-album-muted hover:text-album-text">
              <LogOut className="size-3.5" />
              Sair
            </button>
          </form>
        </div>

        {erro && (
          <p className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {MENSAGENS_ERRO[erro] ?? "Algo deu errado. Tente de novo."}
          </p>
        )}

        {criado && (
          <p className="mt-5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            Evento <strong>{criado}</strong> criado com sucesso.
          </p>
        )}

        {editado && (
          <p className="mt-5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            Alterações salvas.
          </p>
        )}

        {excluido && (
          <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Evento <strong>{excluido}</strong> excluído, junto com as mídias,
            curtidas e comentários dele.
          </p>
        )}

        {/* ---------------------- Criar evento --------------------- */}
        <section className="mt-8 rounded-3xl border border-album-border bg-album-surface p-6">
          <h2 className="text-sm font-semibold tracking-[0.2em] text-album-muted uppercase">
            Criar novo evento
          </h2>

          <form action={criarAlbum} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              name="titulo"
              placeholder="Título (ex: Helena & Gabriel)"
              required
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
            />
            <input
              name="slug"
              placeholder="slug (ex: helena-e-gabriel)"
              required
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
            />
            <input
              name="subtitle"
              placeholder="Subtítulo (opcional)"
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
            />
            <select
              name="eventType"
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text"
            >
              <option value="WEDDING">Casamento</option>
              <option value="SWEET_15">15 Anos</option>
              <option value="GRADUATION">Formatura</option>
              <option value="BIRTHDAY">Aniversário</option>
              <option value="CORPORATE">Corporativo</option>
              <option value="OTHER">Outro</option>
            </select>
            <select
              name="theme"
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text"
            >
              <option value="OLIVE_GOLD">Olive & Gold</option>
              <option value="CLASSIC_NOIR">Classic Noir</option>
              <option value="TERRACOTTA">Terracotta</option>
              <option value="ROSE_QUARTZ">Rose Quartz</option>
              <option value="MIDNIGHT_PARTY">Midnight Party</option>
            </select>
            <input
              name="studioBrandName"
              placeholder="Sua marca (rodapé viral)"
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
            />
            <input
              name="studioWhatsapp"
              placeholder="WhatsApp (com DDD)"
              className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
            />
            <label className="flex items-start gap-2.5 rounded-xl border border-album-border bg-album-bg px-4 py-3 sm:col-span-2">
              <input
                type="checkbox"
                name="showcase"
                className="mt-0.5 size-4 shrink-0 accent-album-accent"
              />
              <span className="text-sm text-album-text">
                Mostrar na vitrine (/)
                <span className="mt-0.5 block text-xs text-album-muted">
                  Só marque para eventos de demonstração. A vitrine é pública e
                  lista o link do painel de cada evento — um cliente não deve
                  ver o evento de outro.
                </span>
              </span>
            </label>
            <button
              type="submit"
              className="rounded-xl bg-album-primary px-4 py-2.5 text-sm font-semibold text-album-on-primary"
            >
              Criar evento
            </button>
          </form>
        </section>

        {/* ---------------------- Lista --------------------------- */}
        <section className="mt-8 space-y-4">
          {eventos.map((evento) => (
            <article
              key={evento.id}
              className="rounded-3xl border border-album-border bg-album-surface p-6"
              style={themeStyle(evento.theme)}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl font-semibold text-album-text">
                  {evento.title}
                </h3>
                <span className="text-xs text-album-muted">
                  {totalPorAlbum.get(evento.id) ?? 0} mídias
                </span>
              </div>

              <p className="mt-1 text-xs text-album-muted">
                /e/{evento.slug} · PIN noivos <strong>{evento.hostPin}</strong> ·
                PIN cerimonialista <strong>{evento.moderatorPin}</strong>
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Link
                  href={`/e/${evento.slug}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                >
                  <QrCode className="size-3.5" />
                  Convidados
                </Link>
                <Link
                  href={`/e/${evento.slug}/telao`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                >
                  <Tv className="size-3.5" />
                  Telão
                </Link>
                <Link
                  href={`/e/${evento.slug}/moderar?pin=${evento.moderatorPin}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                >
                  <ShieldCheck className="size-3.5" />
                  Cerimonialista
                </Link>
                <Link
                  href={`/e/${evento.slug}/painel?pin=${evento.hostPin}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-3 py-2.5 text-xs font-medium text-album-text hover:bg-album-bg"
                >
                  <Crown className="size-3.5" />
                  Noivos
                </Link>
              </div>

              {base && (
                <>
                  {/*
                   * O endereço principal deste cartão é o dos NOIVOS, não o
                   * dos convidados.
                   *
                   * Motivo: é este endereço que o fotógrafo/cerimonialista
                   * copia e manda no WhatsApp para quem CONTRATOU o evento.
                   * Mandar /e/slug (visão do convidado) para o casal entrega
                   * a tela errada: é a tela de quem vai enviar foto, não a de
                   * quem vai baixar o álbum, personalizar e ver os números.
                   *
                   * Os dois endereços abaixo já levam o PIN embutido, para a
                   * pessoa abrir com um toque em vez de digitar 4 números no
                   * celular.
                   */}
                  <LinkEvento
                    rotulo="Noivos"
                    url={`${base}/e/${evento.slug}/painel?pin=${evento.hostPin}`}
                  />
                  <LinkEvento
                    rotulo="Cerimonialista"
                    url={`${base}/e/${evento.slug}/moderar?pin=${evento.moderatorPin}`}
                  />
                  <p className="mt-2 text-[11px] leading-snug text-album-muted">
                    Os dois links já vão com o PIN junto — quem abrir entra
                    direto, sem digitar senha. Mande só para quem é do evento:
                    quem tiver o link tem acesso.
                  </p>
                  {evento.shortCode && (
                    <LinksCurtos base={base} codigo={evento.shortCode} />
                  )}
                </>
              )}

              {/* -------- Editar / excluir (só o criador vê) -------- */}
              <details className="group mt-4 border-t border-album-border pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-album-muted hover:text-album-text">
                  <PencilLine className="size-3.5" />
                  Editar este evento
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                </summary>

                <form
                  action={editarAlbum}
                  className="mt-4 grid gap-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="id" value={evento.id} />

                  <input
                    name="titulo"
                    defaultValue={evento.title}
                    placeholder="Título"
                    required
                    className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
                  />
                  <input
                    name="subtitle"
                    defaultValue={evento.subtitle ?? ""}
                    placeholder="Subtítulo (opcional)"
                    className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
                  />
                  <select
                    name="eventType"
                    defaultValue={evento.eventType}
                    className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text"
                  >
                    <option value="WEDDING">Casamento</option>
                    <option value="SWEET_15">15 Anos</option>
                    <option value="GRADUATION">Formatura</option>
                    <option value="BIRTHDAY">Aniversário</option>
                    <option value="CORPORATE">Corporativo</option>
                    <option value="OTHER">Outro</option>
                  </select>
                  <select
                    name="theme"
                    defaultValue={evento.theme}
                    className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text"
                  >
                    <option value="OLIVE_GOLD">Olive & Gold</option>
                    <option value="CLASSIC_NOIR">Classic Noir</option>
                    <option value="TERRACOTTA">Terracotta</option>
                    <option value="ROSE_QUARTZ">Rose Quartz</option>
                    <option value="MIDNIGHT_PARTY">Midnight Party</option>
                  </select>
                  <input
                    name="studioBrandName"
                    defaultValue={evento.studioBrandName ?? ""}
                    placeholder="Sua marca (rodapé viral)"
                    className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
                  />
                  <input
                    name="studioWhatsapp"
                    defaultValue={evento.studioWhatsapp ?? ""}
                    placeholder="WhatsApp (com DDD)"
                    className="rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
                  />

                  <label className="flex items-start gap-2.5 rounded-xl border border-album-border bg-album-bg px-4 py-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      name="showcase"
                      defaultChecked={evento.showcase}
                      className="mt-0.5 size-4 shrink-0 accent-album-accent"
                    />
                    <span className="text-sm text-album-text">
                      Mostrar na vitrine (/)
                      <span className="mt-0.5 block text-xs text-album-muted">
                        Só marque para eventos de demonstração. A vitrine é
                        pública e lista o link do painel de cada evento — um
                        cliente não deve ver o evento de outro.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-album-primary px-4 py-2.5 text-sm font-semibold text-album-on-primary"
                    >
                      Salvar alterações
                    </button>
                    <span className="text-[11px] text-album-muted">
                      O endereço <code>/e/{evento.slug}</code> e os PINs não mudam.
                    </span>
                  </div>
                </form>
              </details>

              <div className="mt-4 flex justify-end">
                <ExcluirEvento
                  id={evento.id}
                  titulo={evento.title}
                  totalMidias={totalPorAlbum.get(evento.id) ?? 0}
                  action={excluirAlbum}
                />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
