"use client";

/**
 * Modo Telão (/e/[slug]/telao) — tela 16:9 para o DJ plugar no HDMI.
 *
 * Vai trocando de mídia sozinho, dá prioridade ao que acabou de chegar e
 * mantém um QR Code gigante fixo na lateral para o salão inteiro participar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { themeStyle } from "@/lib/themes";
import { BackButton } from "@/components/ui/back-button";
import {
  INTERVALO_VIGIA_MS,
  PRAZO_CONSULTA_MS,
  decidirAoVoltarOnline,
  decidirAoVoltarVisivel,
  decidirDepoisDaSondagem,
  decidirPorSilencio,
} from "@/lib/vigia-telao";

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
 *
 * As outras constantes (prazo da consulta, limite do vigia, ausência longa)
 * e as REGRAS de quando recarregar moram em src/lib/vigia-telao.ts, longe do
 * React, onde podem ser testadas com um comando.
 */
const INTERVALO_ATUALIZACAO_MS = 8000;

/**
 * Recarrega a página uma única vez.
 *
 * Dois vigias diferentes podem querer recarregar no mesmo instante (a
 * internet voltou E a tela acendeu, por exemplo). Sem esta trava, o segundo
 * `reload()` interromperia o primeiro no meio do carregamento.
 */
let recarregando = false;
function recarregar() {
  if (recarregando) return;
  recarregando = true;
  window.location.reload();
}

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

  /**
   * Desde quando o servidor respondeu com sucesso pela última vez.
   *
   * Serve de termômetro para o vigia. Começa em 0 e é carimbado no início do
   * efeito abaixo: ler o relógio durante a renderização deixaria o componente
   * não-determinístico (o mesmo render daria resultados diferentes).
   */
  const ultimoContatoRef = useRef(0);

  useEffect(() => {
    // A página acabou de vir do servidor, então agora conta como contato.
    ultimoContatoRef.current = Date.now();

    let cancelado = false;
    let timerChegou: ReturnType<typeof setTimeout>;
    let emVoo: AbortController | null = null;

    async function buscar(): Promise<boolean> {
      // Uma consulta por vez. Se o vigia pedir uma agora, a anterior (que já
      // estourou o prazo) é descartada em vez de competir com a nova.
      emVoo?.abort();
      const controle = new AbortController();
      emVoo = controle;

      const prazo = setTimeout(() => controle.abort(), PRAZO_CONSULTA_MS);

      try {
        const resposta = await fetch(`/api/albums/${slug}/midias`, {
          cache: "no-store",
          signal: controle.signal,
        });
        if (!resposta.ok || cancelado) return false;

        const dados = (await resposta.json()) as { midias: MidiaTelao[] };
        if (cancelado || !Array.isArray(dados.midias)) return false;

        ultimoContatoRef.current = Date.now();

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

        return true;
      } catch {
        // Festa com Wi-Fi instável: uma consulta que falha não pode derrubar
        // o telão. Ele segue com o que já tem e tenta de novo no próximo
        // ciclo.
        return false;
      } finally {
        clearTimeout(prazo);
        if (emVoo === controle) emVoo = null;
      }
    }

    // ---------------- VIGIA 1: a página travou? ----------------
    //
    // Pergunta de tempos em tempos "quando foi a última vez que deu certo?".
    // Se faz muito tempo, é porque o laço de consulta morreu (ou travou).
    // Aí sonda o servidor com uma consulta normal: se responder, o problema
    // era a página e recarregar resolve; se não responder, o problema é a
    // rede, e recarregar só trocaria as fotos por uma tela de erro.
    const vigia = setInterval(async () => {
      if (cancelado) return;

      const decisao = decidirPorSilencio({
        silencioMs: Date.now() - ultimoContatoRef.current,
        online: navigator.onLine,
      });
      if (decisao === "esperar") return;

      const respondeu = await buscar();
      if (cancelado) return;

      if (decidirDepoisDaSondagem(respondeu) === "recarregar") {
        recarregar();
        return;
      }

      // Continua sem resposta: empurra o relógio para tentar de novo daqui
      // a pouco, sem recarregar.
      ultimoContatoRef.current = Date.now();
    }, INTERVALO_VIGIA_MS);

    // ---------------- VIGIA 2: a tela apagou / o notebook dormiu? ----------------
    //
    // Quando a aba fica escondida (tela bloqueada, notebook suspenso, outra
    // janela em primeiro plano), o navegador congela os timers. Ao voltar, o
    // telão pode dar a impressão de estar vivo mas estar parado há horas.
    let escondidoDesde = document.visibilityState === "hidden" ? Date.now() : 0;

    function aoTrocarVisibilidade() {
      if (document.visibilityState === "hidden") {
        escondidoDesde = Date.now();
        return;
      }

      const sumiuPor = escondidoDesde ? Date.now() - escondidoDesde : 0;
      escondidoDesde = 0;

      if (decidirAoVoltarVisivel(sumiuPor) === "recarregar") {
        recarregar();
        return;
      }

      // Ausência curta (alguém trocou de janela e voltou): só sincroniza.
      void buscar();
    }

    // ---------------- VIGIA 3: a internet caiu e voltou? ----------------
    let ficouOfflineEm = 0;

    function aoFicarOffline() {
      ficouOfflineEm = Date.now();
    }

    function aoVoltarOnline() {
      const foraPor = ficouOfflineEm ? Date.now() - ficouOfflineEm : 0;
      ficouOfflineEm = 0;

      if (decidirAoVoltarOnline(foraPor) === "recarregar") {
        recarregar();
        return;
      }

      // Oscilação curta: retoma na hora, sem esperar o próximo ciclo de 8s.
      void buscar();
    }

    const timer = setInterval(buscar, INTERVALO_ATUALIZACAO_MS);

    // Primeira consulta já na chegada, em vez de esperar 8 segundos.
    void buscar();

    document.addEventListener("visibilitychange", aoTrocarVisibilidade);
    window.addEventListener("offline", aoFicarOffline);
    window.addEventListener("online", aoVoltarOnline);

    return () => {
      cancelado = true;
      clearInterval(timer);
      clearInterval(vigia);
      clearTimeout(timerChegou);
      emVoo?.abort();
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
      window.removeEventListener("offline", aoFicarOffline);
      window.removeEventListener("online", aoVoltarOnline);
    };
  }, [slug]);

  /**
   * Impede a TV/notebook de apagar a tela por inatividade.
   *
   * É a proteção de verdade: os vigias acima consertam a página DEPOIS que
   * ela quebrou; esta impede que ela quebre. Num telão de festa ninguém mexe
   * no mouse durante horas, então sem isto o sistema decide que o computador
   * está ocioso e apaga a tela no meio da recepção.
   *
   * Detalhe importante: o navegador SOLTA a trava sozinha toda vez que a aba
   * perde o foco. Por isso é preciso pedir de novo a cada volta.
   *
   * Navegadores sem suporte (Safari antigo, Firefox) simplesmente ignoram —
   * aí sobra o vigia 2, que recarrega a página quando a tela voltar.
   */
  useEffect(() => {
    type Trava = { released: boolean; release: () => Promise<void> };
    const nav = navigator as unknown as {
      wakeLock?: { request: (tipo: "screen") => Promise<Trava> };
    };

    if (!nav.wakeLock) return;

    let cancelado = false;
    let trava: Trava | null = null;

    async function pedir() {
      if (cancelado || document.visibilityState !== "visible") return;
      try {
        trava = await nav.wakeLock!.request("screen");
        // Se desmontou enquanto o pedido estava no ar, solta.
        if (cancelado) {
          void trava.release();
          trava = null;
        }
      } catch {
        // Recusado (bateria fraca, política do navegador). Não é fatal:
        // o vigia 2 ainda recarrega a página quando a tela voltar.
      }
    }

    function aoVoltarVisivel() {
      if (document.visibilityState === "visible") void pedir();
    }

    void pedir();
    document.addEventListener("visibilitychange", aoVoltarVisivel);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoVoltarVisivel);
      if (trava && !trava.released) void trava.release();
    };
  }, []);

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
