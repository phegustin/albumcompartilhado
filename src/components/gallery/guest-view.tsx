"use client";

/**
 * Visão do convidado (/e/[slug]) — a tela que abre quando a pessoa aponta a
 * câmera para o QR Code da mesa.
 *
 * Regra de ouro da UX aqui: ZERO atrito. Nada de login, senha ou cadastro.
 * O nome é pedido uma única vez e guardado no localStorage do celular.
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
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "MAKING_OF", rotulo: "Pré-Festa" },
  { valor: "CERIMONIA", rotulo: "Cerimônia" },
  { valor: "RECEPCAO", rotulo: "Recepção" },
  { valor: "PISTA", rotulo: "Pista" },
  { valor: "RECADOS", rotulo: "Recados" },
];

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
  const chaveDevice = "ac:device";

  const [nomeConvidado, setNomeConvidado] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pedindoNome, setPedindoNome] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [filtro, setFiltro] = useState("TODOS");
  const [aberta, setAberta] = useState<MidiaGaleria | null>(null);
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({});

  /* ---------------------------------------------------------------------- */
  /* localStorage: nome do convidado + id do aparelho                        */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let device = localStorage.getItem(chaveDevice);
    if (!device) {
      device = crypto.randomUUID();
      localStorage.setItem(chaveDevice, device);
    }
    setDeviceId(device);
    setNomeConvidado(localStorage.getItem(chaveNome));
  }, [chaveDevice, chaveNome]);

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
  /* Contadores e filtros                                                    */
  /* ---------------------------------------------------------------------- */
  const contagem = useMemo(() => {
    const base = { PHOTO: 0, VIDEO: 0, AUDIO: 0 };
    for (const m of midias) base[m.mediaType] += 1;
    return base;
  }, [midias]);

  const visiveis = useMemo(() => {
    const lista =
      filtro === "TODOS"
        ? midias
        : midias.filter((m) => m.categoryTag === filtro);

    // Fotos fixadas pelos noivos sobem para o topo.
    return [...lista].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [midias, filtro]);

  /* ---------------------------------------------------------------------- */
  /* Curtidas                                                                */
  /* ---------------------------------------------------------------------- */
  function curtir(midia: MidiaGaleria) {
    if (!deviceId) return;

    const jaCurtiu = curtidas[midia.id] ?? false;

    // Atualização otimista: a interface responde na hora.
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
    <main className="min-h-dvh pb-32" style={themeStyle(album.theme)}>
      {/* ---------------------------- Capa ---------------------------- */}
      <section className="relative">
        <div className="relative h-[52dvh] w-full overflow-hidden">
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
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--album-bg) 2%, color-mix(in srgb, var(--album-bg) 55%, transparent) 35%, transparent 75%)",
            }}
          />
        </div>

        <div className="relative -mt-24 px-5 text-center">
          <p className="text-[11px] tracking-[0.3em] text-album-muted uppercase">
            {ROTULO_EVENTO[album.eventType] ?? "Evento"}
          </p>
          <h1 className="font-display mt-2 text-5xl leading-tight font-semibold text-album-text">
            {album.title}
          </h1>
          {album.subtitle && (
            <p className="mt-1.5 text-sm text-album-muted">{album.subtitle}</p>
          )}

          <p className="mt-4 text-xs text-album-muted">
            {contagem.PHOTO} {contagem.PHOTO === 1 ? "foto" : "fotos"} ·{" "}
            {contagem.VIDEO} {contagem.VIDEO === 1 ? "vídeo" : "vídeos"} ·{" "}
            {contagem.AUDIO} {contagem.AUDIO === 1 ? "recado" : "recados"}
          </p>
        </div>
      </section>

      {/* --------------------------- Filtros -------------------------- */}
      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto px-5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              filtro === f.valor
                ? "border-album-primary text-album-on-primary"
                : "border-album-border text-album-muted hover:bg-album-surface"
            }`}
            style={
              filtro === f.valor
                ? { background: "var(--album-primary)" }
                : undefined
            }
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {/* --------------------------- Grade ---------------------------- */}
      <section className="mt-5 px-4">
        {visiveis.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-album-border py-16 text-center">
            <p className="font-display text-2xl text-album-text">
              Nada por aqui ainda
            </p>
            <p className="mt-1.5 text-sm text-album-muted">
              Seja a primeira pessoa a registrar esse momento ✨
            </p>
          </div>
        ) : (
          <div className="columns-2 gap-2 md:columns-3 lg:columns-4">
            {visiveis.map((midia) => (
              <figure
                key={midia.id}
                className="mb-2 break-inside-avoid overflow-hidden rounded-xl border border-album-border bg-album-surface"
              >
                <button
                  onClick={() => setAberta(midia)}
                  className="relative block w-full"
                >
                  {midia.mediaType === "PHOTO" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={midia.thumbUrl ?? midia.originalUrl}
                      alt={midia.caption ?? midia.uploaderName}
                      loading="lazy"
                      className="w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-album-bg">
                      {midia.mediaType === "VIDEO" ? (
                        <Video className="size-7 text-album-muted" />
                      ) : (
                        <Mic className="size-7 text-album-muted" />
                      )}
                      <span className="text-[10px] text-album-muted">
                        {ROTULO_CATEGORIA[midia.categoryTag]}
                      </span>
                    </div>
                  )}

                  {midia.isPinned && (
                    <span className="absolute top-2 left-2 rounded-full bg-album-accent p-1">
                      <Pin className="size-3 text-album-on-primary" />
                    </span>
                  )}
                </button>

                <figcaption className="flex items-center gap-2 px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-album-muted">
                    {midia.uploaderName}
                  </span>
                  <button
                    onClick={() => curtir(midia)}
                    disabled={pending}
                    className="flex shrink-0 items-center gap-1 text-[11px] text-album-muted hover:text-album-text"
                    aria-label="Curtir"
                  >
                    <Heart
                      className="size-3.5"
                      style={{
                        fill: curtidas[midia.id]
                          ? "var(--album-accent)"
                          : "transparent",
                        color: curtidas[midia.id]
                          ? "var(--album-accent)"
                          : "currentColor",
                      }}
                    />
                    {midia.likesCount}
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------- Rodapé ---------------------------- */}
      {album.studioBrandName && (
        <footer className="mt-14 px-6 text-center">
          <p className="text-[11px] leading-relaxed text-album-muted">
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

      {/* --------------- Botão fixo na zona do polegar ---------------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-6">
        <button
          onClick={clicouEmEnviar}
          className="animate-pulse-ring pointer-events-auto flex items-center gap-2 rounded-full px-6 py-4 text-sm font-semibold shadow-lg"
          style={{
            background: "var(--album-primary)",
            color: "var(--album-on-primary)",
          }}
        >
          <Plus className="size-4" />
          Enviar Fotos, Vídeos ou Áudio
        </button>
      </div>

      {/* ---------------------- Sheet: seu nome ---------------------- */}
      <AnimatePresence>
        {pedindoNome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="w-full max-w-lg rounded-t-3xl border border-album-border bg-album-surface p-6"
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
                className="mt-5 w-full rounded-xl border border-album-border bg-album-bg px-4 py-3 text-base text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
              />

              <button
                onClick={salvarNome}
                disabled={!nomeDigitado.trim()}
                className="mt-3 w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-album-on-primary disabled:opacity-40"
                style={{ background: "var(--album-primary)" }}
              >
                Salvar e continuar
              </button>

              <button
                onClick={() => setPedindoNome(false)}
                className="mt-2 w-full rounded-xl px-4 py-2.5 text-xs text-album-muted hover:text-album-text"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------- Sheet: envio ------------------------- */}
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

      {/* ------------------------- Lightbox -------------------------- */}
      <AnimatePresence>
        {aberta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAberta(null)}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/92 p-4"
          >
            <button
              onClick={() => setAberta(null)}
              className="absolute top-5 right-5 rounded-full p-2 text-white/80 hover:bg-white/10"
              aria-label="Fechar"
            >
              <X className="size-6" />
            </button>

            {aberta.mediaType === "PHOTO" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={aberta.originalUrl}
                alt={aberta.caption ?? aberta.uploaderName}
                className="max-h-[75dvh] w-auto rounded-lg object-contain"
              />
            ) : (
              <video
                src={aberta.originalUrl}
                controls
                autoPlay
                className="max-h-[75dvh] w-auto rounded-lg"
              />
            )}

            <div className="mt-4 max-w-xl text-center">
              <p className="text-sm font-medium text-white">
                {aberta.uploaderName}
              </p>
              {aberta.caption && (
                <p className="mt-1 text-sm text-white/70">{aberta.caption}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
