"use client";

/**
 * Visão do convidado (/e/[slug]).
 *
 * Referência de design: Dots. Memories — app de galeria minimalista.
 * princípios aplicados aqui:
 *   - muito respiro (espaçamento generoso, poucos elementos na tela)
 *   - cantos bem suaves e sombra leve, quase nada de borda
 *   - serifa só no nome do evento; todo o resto em sans moderna
 *   - grade com ritmo (nem tudo do mesmo tamanho) para não parecer tabela
 *   - sensação de app nativo: barra fixa em baixo, na zona do polegar
 *
 * Regra de UX: ZERO atrito. Sem login, sem senha, sem cadastro.
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Mic, Pin, Plus, Video, X } from "lucide-react";

import { themeStyle } from "@/lib/themes";
import { alternarCurtida } from "@/app/e/[slug]/actions";
import { UploadSheet, type CategoriaEnvio } from "./upload-sheet";

export type MidiaGaleria = {
  id: string;
  uploaderName: string;
  mediaType: "PHOTO" | "VIDEO" | "AUDIO";
  categoryTag: CategoriaEnvio;
  originalUrl: string;
  thumbUrl: string | null;
  caption: string | null;
  likesCount: number;
  isPinned: boolean;
  createdAt: string;
};

export type AlbumGaleria = {
  slug: string;
  title: string;
  subtitle: string | null;
  eventType: string;
  theme: string;
  coverUrl: string | null;
  studioBrandName: string | null;
  studioWhatsapp: string | null;
};

const ROTULO_EVENTO: Record<string, string> = {
  WEDDING: "Casamento",
  SWEET_15: "15 Anos",
  GRADUATION: "Formatura",
  BIRTHDAY: "Aniversário",
  CORPORATE: "Evento Corporativo",
  OTHER: "Evento",
};

const ROTULO_CATEGORIA: Record<string, string> = {
  MAKING_OF: "Pré-Festa",
  CERIMONIA: "Cerimônia",
  RECEPCAO: "Recepção",
  PISTA: "Pista",
  RECADOS: "Recados",
};

const FILTROS = [
  { valor: "TODOS", rotulo: "Tudo" },
  { valor: "MAKING_OF", rotulo: "Pré-Festa" },
  { valor: "CERIMONIA", rotulo: "Cerimônia" },
  { valor: "RECEPCAO", rotulo: "Recepção" },
  { valor: "PISTA", rotulo: "Pista" },
  { valor: "RECADOS", rotulo: "Recados" },
];

/**
 * Cria ritmo visual na grade.
 * Sem isso todas as fotos ficam idênticas e a galeria parece uma tabela.
 */
function ritmoDaGrade(indice: number): string {
  const posicao = indice % 6;
  if (posicao === 0) return "col-span-2 aspect-[3/2]"; // panorâmica
  if (posicao === 3) return "aspect-[4/5]"; // retrato
  if (posicao === 5) return "aspect-[4/5]"; // retrato
  return "aspect-square"; // quadrada
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function GuestView({
  album,
  midias,
}: {
  album: AlbumGaleria;
  midias: MidiaGaleria[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const chaveNome = `ac:nome:${album.slug}`;

  const [nomeConvidado, setNomeConvidado] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pedindoNome, setPedindoNome] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [filtro, setFiltro] = useState("TODOS");
  const [autorFiltro, setAutorFiltro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<MidiaGaleria | null>(null);
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({});

  /* ---------------------------------------------------------------------- */
  /* localStorage                                                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let device = localStorage.getItem("ac:device");
    if (!device) {
      device = crypto.randomUUID();
      localStorage.setItem("ac:device", device);
    }
    setDeviceId(device);
    setNomeConvidado(localStorage.getItem(chaveNome));
  }, [chaveNome]);

  const salvarNome = useCallback(() => {
    const nome = nomeDigitado.trim();
    if (!nome) return;
    localStorage.setItem(chaveNome, nome);
    setNomeConvidado(nome);
    setPedindoNome(false);
    setEnviando(true);
  }, [nomeDigitado, chaveNome]);

  function clicouEmEnviar() {
    if (!nomeConvidado) {
      setPedindoNome(true);
      return;
    }
    setEnviando(true);
  }

  /* ---------------------------------------------------------------------- */
  /* Dados derivados                                                         */
  /* ---------------------------------------------------------------------- */
  const contagem = useMemo(() => {
    const base = { PHOTO: 0, VIDEO: 0, AUDIO: 0 };
    for (const m of midias) base[m.mediaType] += 1;
    return base;
  }, [midias]);

  // Convidados mais ativos, para a barra de stories.
  const autores = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; total: number; capa: string | null }
    >();

    for (const m of midias) {
      const atual = mapa.get(m.uploaderName);
      if (atual) {
        atual.total += 1;
      } else {
        mapa.set(m.uploaderName, {
          nome: m.uploaderName,
          total: 1,
          capa: m.mediaType === "PHOTO" ? (m.thumbUrl ?? m.originalUrl) : null,
        });
      }
    }

    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [midias]);

  const visiveis = useMemo(() => {
    let lista = midias;

    if (filtro !== "TODOS") {
      lista = lista.filter((m) => m.categoryTag === filtro);
    }
    if (autorFiltro) {
      lista = lista.filter((m) => m.uploaderName === autorFiltro);
    }

    return [...lista].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [midias, filtro, autorFiltro]);

  /* ---------------------------------------------------------------------- */
  /* Curtidas                                                                */
  /* ---------------------------------------------------------------------- */
  function curtir(midia: MidiaGaleria) {
    if (!deviceId) return;
    const jaCurtiu = curtidas[midia.id] ?? false;

    setCurtidas((atual) => ({ ...atual, [midia.id]: !jaCurtiu }));

    startTransition(async () => {
      await alternarCurtida(midia.id, deviceId);
      router.refresh();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */
  return (
    <main
      className="min-h-dvh pb-28"
      style={{ ...themeStyle(album.theme), background: "var(--album-bg)" }}
    >
      {/* ============================ CAPA ============================ */}
      <section className="relative h-[62dvh] w-full overflow-hidden">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.coverUrl}
            alt={album.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-album-border" />
        )}

        {/* Degradê para o texto ficar legível sobre qualquer foto */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.35) 38%, rgba(0,0,0,.05) 70%, transparent 100%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 px-6 pb-8">
          <p className="text-[11px] font-medium tracking-[0.22em] text-white/70 uppercase">
            {ROTULO_EVENTO[album.eventType] ?? "Evento"}
          </p>

          <h1 className="font-display mt-2 text-[2.75rem] leading-[1.05] font-semibold text-white">
            {album.title}
          </h1>

          {album.subtitle && (
            <p className="mt-1.5 text-sm text-white/75">{album.subtitle}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              { n: contagem.PHOTO, t: "fotos" },
              { n: contagem.VIDEO, t: "vídeos" },
              { n: contagem.AUDIO, t: "recados" },
            ]
              .filter((i) => i.n > 0)
              .map((item) => (
                <span
                  key={item.t}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
                >
                  {item.n} {item.t}
                </span>
              ))}
          </div>
        </div>
      </section>

      {/* ========================== STORIES ========================== */}
      {autores.length > 0 && (
        <section className="pt-6">
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-6">
            {autores.map((autor) => {
              const ativo = autorFiltro === autor.nome;
              return (
                <button
                  key={autor.nome}
                  onClick={() =>
                    setAutorFiltro(ativo ? null : autor.nome)
                  }
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span
                    className="rounded-full p-[2px]"
                    style={{
                      background: ativo
                        ? "var(--album-accent)"
                        : "transparent",
                      boxShadow: ativo
                        ? "none"
                        : "inset 0 0 0 1.5px var(--album-border)",
                    }}
                  >
                    <span className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-album-border">
                      {autor.capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={autor.capa}
                          alt={autor.nome}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-lg text-album-muted">
                          {iniciais(autor.nome)}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="w-full truncate text-center text-[11px] text-album-muted">
                    {autor.nome.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================== FILTROS ========================== */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto px-6">
        {FILTROS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
              style={{
                background: ativo ? "var(--album-primary)" : "transparent",
                color: ativo ? "var(--album-on-primary)" : "var(--album-muted)",
                boxShadow: ativo
                  ? "none"
                  : "inset 0 0 0 1px var(--album-border)",
              }}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>

      {/* Filtro ativo por autor: mostra um jeito fácil de limpar */}
      {autorFiltro && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setAutorFiltro(null)}
            className="flex items-center gap-1.5 rounded-full bg-album-surface px-3 py-1.5 text-xs text-album-muted shadow-sm"
          >
            Só de {autorFiltro}
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* =========================== GRADE =========================== */}
      <section className="mt-6 px-5">
        {visiveis.length === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-album-surface shadow-sm">
              <Plus className="size-6 text-album-muted" />
            </div>
            <p className="font-display mt-4 text-2xl text-album-text">
              Nada por aqui ainda
            </p>
            <p className="mt-1 max-w-xs text-sm text-album-muted">
              Seja a primeira pessoa a registrar esse momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visiveis.map((midia, i) => (
              <button
                key={midia.id}
                onClick={() => setAberta(midia)}
                className={`group relative overflow-hidden rounded-2xl bg-album-surface shadow-sm transition-transform active:scale-[.98] ${ritmoDaGrade(i)}`}
              >
                {midia.mediaType === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={midia.thumbUrl ?? midia.originalUrl}
                    alt={midia.caption ?? midia.uploaderName}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-2 bg-album-bg">
                    {midia.mediaType === "VIDEO" ? (
                      <Video className="size-8 text-album-muted" />
                    ) : (
                      <Mic className="size-8 text-album-muted" />
                    )}
                    <span className="text-xs text-album-muted">
                      {ROTULO_CATEGORIA[midia.categoryTag]}
                    </span>
                  </span>
                )}

                {/* Legenda em sobreposição — mais limpo que barrinha embaixo */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,.65), transparent)",
                  }}
                />

                {midia.isPinned && (
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 p-1.5 shadow-sm">
                    <Pin className="size-3 text-album-text" />
                  </span>
                )}

                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-medium text-white">
                      {midia.uploaderName}
                    </span>
                    {midia.caption && (
                      <span className="mt-0.5 block truncate text-[11px] text-white/80">
                        {midia.caption}
                      </span>
                    )}
                  </span>

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      curtir(midia);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        curtir(midia);
                      }
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
                  >
                    <Heart
                      className="size-3"
                      style={{
                        fill: curtidas[midia.id] ? "#fff" : "transparent",
                      }}
                    />
                    {midia.likesCount}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* =========================== RODAPÉ ========================== */}
      {album.studioBrandName && (
        <footer className="mt-16 px-6 text-center">
          <p className="text-xs leading-relaxed text-album-muted">
            Memórias ao vivo por{" "}
            <strong className="font-semibold text-album-text">
              {album.studioBrandName}
            </strong>
            {album.studioWhatsapp && (
              <>
                {" • "}
                <a
                  href={`https://wa.me/${album.studioWhatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener"
                  className="underline underline-offset-2"
                >
                  Quer ter no seu evento?
                </a>
              </>
            )}
          </p>
        </footer>
      )}

      {/* ===================== BOTÃO FLUTUANTE ======================= */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <button
          onClick={clicouEmEnviar}
          disabled={pending}
          className="pointer-events-auto flex items-center gap-2 rounded-full px-6 py-4 text-sm font-semibold shadow-xl transition-transform active:scale-95"
          style={{
            background: "var(--album-primary)",
            color: "var(--album-on-primary)",
          }}
        >
          <Plus className="size-4" />
          Enviar fotos, vídeos ou áudio
        </button>
      </div>

      {/* ====================== SHEET: SEU NOME ====================== */}
      <AnimatePresence>
        {pedindoNome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="w-full max-w-lg rounded-t-3xl bg-album-surface p-6 shadow-2xl"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
              <h3 className="font-display text-2xl font-semibold text-album-text">
                Como você quer assinar suas fotos?
              </h3>
              <p className="mt-1.5 text-sm text-album-muted">
                Ex: Tia Márcia, Primo Lucas, Turma da Faculdade
              </p>

              <input
                autoFocus
                value={nomeDigitado}
                onChange={(e) => setNomeDigitado(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarNome()}
                placeholder="Seu nome"
                className="mt-5 w-full rounded-2xl bg-album-bg px-4 py-3.5 text-base text-album-text placeholder:text-album-muted focus:ring-2 focus:ring-album-accent focus:outline-none"
              />

              <button
                onClick={salvarNome}
                disabled={!nomeDigitado.trim()}
                className="mt-3 w-full rounded-2xl px-4 py-4 text-sm font-semibold text-album-on-primary disabled:opacity-40"
                style={{ background: "var(--album-primary)" }}
              >
                Salvar e continuar
              </button>

              <button
                onClick={() => setPedindoNome(false)}
                className="mt-1 w-full rounded-2xl px-4 py-2.5 text-xs text-album-muted"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================= SHEET: ENVIO ======================== */}
      {enviando && nomeConvidado && deviceId && (
        <UploadSheet
          slug={album.slug}
          guestName={nomeConvidado}
          deviceId={deviceId}
          onFechar={() => setEnviando(false)}
          onConcluido={() => {
            router.refresh();
            setEnviando(false);
          }}
        />
      )}

      {/* ========================= LIGHTBOX ========================== */}
      <AnimatePresence>
        {aberta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 p-4"
          >
            <button
              onClick={() => setAberta(null)}
              className="absolute top-5 right-5 rounded-full bg-white/10 p-2.5 text-white"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            {aberta.mediaType === "PHOTO" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={aberta.originalUrl}
                alt={aberta.caption ?? aberta.uploaderName}
                className="max-h-[72dvh] w-auto rounded-2xl object-contain"
              />
            ) : (
              <video
                src={aberta.originalUrl}
                controls
                autoPlay
                className="max-h-[72dvh] w-auto rounded-2xl"
              />
            )}

            <div className="mt-5 max-w-lg text-center">
              <p className="text-sm font-semibold text-white">
                {aberta.uploaderName}
              </p>
              {aberta.caption && (
                <p className="mt-1 text-sm text-white/70">{aberta.caption}</p>
              )}
              <p className="mt-2 text-xs text-white/40">
                {ROTULO_CATEGORIA[aberta.categoryTag]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
