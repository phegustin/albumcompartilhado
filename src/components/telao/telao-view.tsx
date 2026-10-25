"use client";

/**
 * Modo Telão (/e/[slug]/telao) — tela 16:9 para o DJ plugar no HDMI.
 *
 * Vai trocando de mídia sozinho, dá prioridade ao que acabou de chegar e
 * mantém um QR Code gigante fixo na lateral para o salão inteiro participar.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { themeStyle } from "@/lib/themes";
import { BackButton } from "@/components/ui/back-button";

export type MidiaTelao = {
  id: string;
  uploaderName: string;
  mediaType: "PHOTO" | "VIDEO" | "AUDIO";
  originalUrl: string;
  thumbUrl: string | null;
  caption: string | null;
  createdAt: string;
};

/**
 * De quantos em quantos segundos o telão pergunta ao servidor se chegou
 * alguma mídia nova.
 *
 * 8 segundos: rápido o bastante para parecer ao vivo na festa, lento o
 * bastante para não castigar o Wi-Fi do salão nem o plano da Vercel.
 */
const INTERVALO_ATUALIZACAO_MS = 8000;

export function TelaoView({
  slug,
  titulo,
  tema,
  midias,
  qrCodeDataUrl,
  intervaloMs = 7000,
}: {
  slug: string;
  titulo: string;
  tema: string;
  midias: MidiaTelao[];
  qrCodeDataUrl: string;
  intervaloMs?: number;
}) {
  const [indice, setIndice] = useState(0);

  /**
   * A lista de mídias agora é ESTADO, não só propriedade.
   *
   * Antes vinha pronta do servidor uma única vez e morria ali — foto nova
   * não aparecia sem recarregar a página. Agora o telão consulta o servidor
   * de poucos em poucos segundos e acrescenta o que chegou.
   */
  const [lista, setLista] = useState(midias);

  /** Bandeja de "acabou de chegar", para o selo AO VIVO. */
  const [chegouAgora, setChegouAgora] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let timerChegou: ReturnType<typeof setTimeout>;

    async function buscar() {
      try {
        const resposta = await fetch(`/api/albums/${slug}/midias`, {
          cache: "no-store",
        });
        if (!resposta.ok || cancelado) return;

        const dados = (await resposta.json()) as { midias: MidiaTelao[] };
        if (cancelado || !Array.isArray(dados.midias)) return;

        setLista((atual) => {
          const conhecidas = new Set(atual.map((m) => m.id));
          const novas = dados.midias.filter((m) => !conhecidas.has(m.id));

          // Nada mudou: mantém a MESMA referência, para não re-renderizar
          // nem reiniciar o slideshow à toa.
          if (novas.length === 0) return atual;

          if (!cancelado) {
            setChegouAgora(true);
            clearTimeout(timerChegou);
            timerChegou = setTimeout(() => setChegouAgora(false), 4000);
          }

          return dados.midias;
        });
      } catch {
        // Festa com Wi-Fi instável: uma consulta que falha não pode derrubar
        // o telão. Ele segue com o que já tem e tenta de novo no próximo
        // ciclo.
      }
    }

    const timer = setInterval(buscar, INTERVALO_ATUALIZACAO_MS);
    return () => {
      cancelado = true;
      clearInterval(timer);
      clearTimeout(timerChegou);
    };
  }, [slug]);

  // Recém-chegadas primeiro: o que acabou de ser enviado aparece logo.
  const ordenadas = useMemo(
    () =>
      [...lista].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [lista],
  );

  useEffect(() => {
    if (ordenadas.length <= 1) return;
    const timer = setInterval(() => {
      setIndice((i) => (i + 1) % ordenadas.length);
    }, intervaloMs);
    return () => clearInterval(timer);
  }, [ordenadas.length, intervaloMs]);

  // Lista mudou (alguém mandou foto nova): volta para a mais recente.
  useEffect(() => {
    setIndice(0);
  }, [ordenadas.length]);

  const atual = ordenadas[indice];

  /**
   * O telão fica projetado no salão, então um botão fixo ali atrapalharia a
   * festa. Ele só aparece quando alguém mexe o mouse / toca na tela, e some
   * de novo depois de 3s parado.
   */
  const [controlesVisiveis, setControlesVisiveis] = useState(true);
  useEffect(() => {
    let someEm: ReturnType<typeof setTimeout>;

    function mostrar() {
      setControlesVisiveis(true);
      clearTimeout(someEm);
      someEm = setTimeout(() => setControlesVisiveis(false), 3000);
    }

    mostrar();
    window.addEventListener("mousemove", mostrar);
    window.addEventListener("touchstart", mostrar);
    return () => {
      clearTimeout(someEm);
      window.removeEventListener("mousemove", mostrar);
      window.removeEventListener("touchstart", mostrar);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ ...themeStyle(tema), background: "#07080d" }}
    >
      <div
        className={`absolute top-0 left-0 z-30 transition-opacity duration-500 ${
          controlesVisiveis ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ padding: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}
      >
        <BackButton destino={`/e/${slug}`} variante="sobre-imagem" />
      </div>

      {atual ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={atual.id}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {atual.mediaType === "VIDEO" ? (
              <video
                src={atual.originalUrl}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={atual.thumbUrl ?? atual.originalUrl}
                alt={atual.caption ?? atual.uploaderName}
                className="h-full w-full object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <p className="font-display text-4xl text-white/70">
            Aguardando as primeiras fotos…
          </p>
        </div>
      )}

      {/* Vinheta escura para o texto ficar legível de longe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 35%, transparent 70%, rgba(0,0,0,.45) 100%)",
        }}
      />

      {/* Crédito da mídia atual */}
      {atual && (
        <motion.div
          key={`info-${atual.id}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-8 left-8 max-w-[55%]"
        >
          <p className="flex items-center gap-2 text-sm tracking-wide text-white/60 uppercase">
            <Sparkles className="size-4" style={{ color: "var(--album-accent)" }} />
            {chegouAgora ? (
              <>
                <motion.span
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="font-semibold"
                  style={{ color: "var(--album-accent)" }}
                >
                  ✨ AO VIVO AGORA ·
                </motion.span>{" "}
                enviado por
              </>
            ) : (
              "Enviado agora por"
            )}
          </p>
          <p className="font-display mt-1 text-5xl leading-tight font-semibold text-white">
            {atual.uploaderName}
          </p>
          {atual.caption && (
            <p className="mt-2 max-w-2xl text-2xl leading-snug text-white/85">
              {atual.caption}
            </p>
          )}
        </motion.div>
      )}

      {/* Card fixo com o QR Code */}
      <div className="absolute top-8 right-8 w-64 rounded-3xl bg-white/95 p-5 text-center shadow-2xl">
        <p className="font-display text-2xl leading-tight font-semibold text-neutral-900">
          {titulo}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCodeDataUrl}
          alt="QR Code da galeria"
          className="mt-3 w-full"
        />
        <p className="mt-2 text-sm leading-snug font-medium text-neutral-700">
          Aponte a câmera do celular e
          <br />
          apareça no telão agora!
        </p>
        <p className="mt-3 text-[11px] text-neutral-500">/e/{slug}</p>
      </div>

      {/* Contador discreto */}
      <p className="absolute top-8 left-8 text-xs tracking-widest text-white/40 uppercase">
        {ordenadas.length} {ordenadas.length === 1 ? "mídia" : "mídias"} · telão
        ao vivo
      </p>
    </div>
  );
}
