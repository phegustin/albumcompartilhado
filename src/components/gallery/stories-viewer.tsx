"use client";

/**
 * Visualizador em modo "stories" (igual Instagram).
 *
 * A pessoa toca numa foto da grade e entra numa tela cheia preta, com:
 *   - barra de progresso no topo, uma para cada mídia (vai enchendo sozinha)
 *   - toque do lado direito -> próxima / lado esquerdo -> anterior
 *   - arrastar para o lado -> passa também
 *   - pressionar e segurar -> pausa (para olhar com calma)
 *   - setas do teclado / Esc para fechar
 *
 * Duas decisões que valem explicar:
 *
 * 1) POR QUE FOTO TEM TEMPO FIXO E VÍDEO NÃO
 *    Foto não tem duração, então usa 5 segundos — tempo de olhar sem pressa.
 *    Vídeo e áudio usam a duração REAL do arquivo: o progresso é
 *    currentTime/duration. Se a gente cravasse 5 s num vídeo de 40 s, ele
 *    cortaria no meio — e cortar o vídeo do convidado é justamente o que
 *    não pode acontecer.
 *
 * 2) POR QUE O PROGRESSO NÃO ZERA SOZINHO NO FIM
 *    Quando a última mídia termina, o visualizador fecha. Fica preso numa
 *    tela preta parada se a gente só zerar a barra.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Pause, Play, Volume2, X } from "lucide-react";

export type MidiaStory = {
  id: string;
  uploaderName: string;
  mediaType: "PHOTO" | "VIDEO" | "AUDIO";
  categoryTag: string;
  categoryCustom: string | null;
  originalUrl: string;
  thumbUrl: string | null;
  caption: string | null;
  likesCount: number;
  createdAt: string;
};

/** Quanto tempo uma FOTO fica na tela (ms). Vídeo/áudio usam a própria duração. */
const DURACAO_FOTO_MS = 5000;

/** A partir de quantos px de arraste a gente considera "passou de fase". */
const LIMIAR_ARRASTO = 60;

/** Quanto tempo segurando para pausar (ms). */
const TEMPO_PAUSA_MS = 180;

const ROTULO_CATEGORIA: Record<string, string> = {
  MAKING_OF: "Pré-Festa",
  CERIMONIA: "Cerimônia",
  RECEPCAO: "Recepção",
  PISTA: "Pista",
  RECADOS: "Recados",
};

function iniciais(nome: string): string {
  return (
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** "há 3 min", "há 2 h", "há 5 dias" — curto, para caber no topo. */
function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

type Props = {
  midias: MidiaStory[];
  indiceInicial: number;
  curtidas: Record<string, boolean>;
  onAlternarCurtida: (id: string) => void;
  onFechar: () => void;
};

export function StoriesViewer({
  midias,
  indiceInicial,
  curtidas,
  onAlternarCurtida,
  onFechar,
}: Props) {
  const [indice, setIndice] = useState(indiceInicial);
  const [progresso, setProgresso] = useState(0); // 0 → 1
  const [pausado, setPausado] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const pausadoRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toqueRef = useRef<{ x: number; y: number; tempo: number } | null>(null);
  const timerPausaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrastouRef = useRef(false);

  /**
   * Dedos na tela agora.
   *
   * Existe por causa da pinça (zoom): quando dois dedos tocam, NÃO é um toque
   * para avançar nem um toque para pausar — é a pessoa abrindo zoom na foto.
   * Sem esse controle, o segundo dedo valia como "toque na direita" e a foto
   * pulava para a próxima justamente quando a pessoa queria examinar aquela.
   */
  const dedosRef = useRef(new Set<number>());
  const ignorarToqueRef = useRef(false);

  /**
   * A pausa foi pedida de propósito (botão ou pinça) e não só "dedo
   * segurando"?
   *
   * Faz diferença na hora de soltar: se a pessoa pausou de propósito, um
   * toque simples RETOMA. Se ela só estava segurando, soltar já retoma
   * sozinho. Sem essa distinção, a pessoa dava zoom, tocava para sair do
   * zoom e a foto pulava para a próxima.
   */
  const pausaManualRef = useRef(false);

  /** Limpa qualquer interação em andamento (sem despausar). */
  const cancelarInteracao = useCallback(() => {
    if (timerPausaRef.current) {
      clearTimeout(timerPausaRef.current);
      timerPausaRef.current = null;
    }
    toqueRef.current = null;
    setArrastando(false);
  }, []);

  const atual = midias[indice];
  const tipo = atual?.mediaType;

  const pausar = useCallback((valor: boolean, manual = false) => {
    pausadoRef.current = valor;
    setPausado(valor);
    pausaManualRef.current = manual ? valor : false;

    // Pausar a barra sem pausar o vídeo deixaria os dois fora de sintonia:
    // a barra pararia e o vídeo continuaria rodando. Então vale para os dois.
    const video = videoRef.current;
    if (video) {
      if (valor && !video.paused) void video.pause();
      if (!valor && video.paused) void video.play().catch(() => {});
    }
  }, []);

  /* ---------------- navegação ---------------- */

  const irPara = useCallback(
    (novo: number) => {
      if (novo < 0) {
        setProgresso(0); // já na primeira: só reinicia a barra
        return;
      }
      if (novo >= midias.length) {
        onFechar(); // passou da última: fecha
        return;
      }
      setIndice(novo);
      setProgresso(0);
    },
    [midias.length, onFechar],
  );

  const proxima = useCallback(() => irPara(indice + 1), [indice, irPara]);
  const anterior = useCallback(() => irPara(indice - 1), [indice, irPara]);

  /* ---------------- progresso ---------------- */

  // Foto: relógio próprio. Vídeo/áudio: o próprio elemento avisa o tempo.
  useEffect(() => {
    if (tipo !== "PHOTO") return;
    setProgresso(0);
    let raf = 0;
    let ultimo = performance.now();

    const loop = (agora: number) => {
      const dt = agora - ultimo;
      ultimo = agora;
      if (!pausadoRef.current) {
        setProgresso((p) => Math.min(1, p + dt / DURACAO_FOTO_MS));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [indice, tipo]);

  // Quando a barra enche, avança sozinho.
  useEffect(() => {
    if (progresso >= 1) proxima();
  }, [progresso, proxima]);

  /* ---------------- teclado ---------------- */

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      else if (e.key === "ArrowRight") proxima();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === " ") {
        e.preventDefault();
        pausar(!pausadoRef.current);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [proxima, anterior, onFechar, pausar]);

  /* ---------------- trava o scroll do fundo ---------------- */

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  /* ---------------- já vai buscando a próxima ---------------- */

  useEffect(() => {
    if (tipo !== "PHOTO") return;
    const prox = midias[indice + 1];
    if (prox?.mediaType === "PHOTO") {
      const img = new Image();
      img.src = prox.originalUrl;
    }
  }, [indice, midias, tipo]);

  /* ---------------- toque / arraste ---------------- */

  const aoPressionar = (e: React.PointerEvent) => {
    dedosRef.current.add(e.pointerId);

    // Segundo dedo na tela: é pinça. Sai da frente e deixa o navegador
    // fazer o zoom.
    if (dedosRef.current.size > 1) {
      ignorarToqueRef.current = true;
      cancelarInteracao();
      // E pausa: quem abre zoom quer olhar a foto, não que ela passe.
      // Sem isso, dava zoom e a foto continuava correndo embaixo.
      pausar(true, true);
      return;
    }

    ignorarToqueRef.current = false;
    toqueRef.current = { x: e.clientX, y: e.clientY, tempo: Date.now() };
    arrastouRef.current = false;
    setArrastando(true);
    timerPausaRef.current = setTimeout(() => pausar(true), TEMPO_PAUSA_MS);
  };

  const aoMover = (e: React.PointerEvent) => {
    if (ignorarToqueRef.current) return;
    const inicio = toqueRef.current;
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    if (Math.abs(dx) > 10) {
      arrastouRef.current = true;
      if (timerPausaRef.current) {
        clearTimeout(timerPausaRef.current);
        timerPausaRef.current = null;
      }
      pausar(true);
    }
  };

  const aoSoltar = (e: React.PointerEvent) => {
    dedosRef.current.delete(e.pointerId);

    if (ignorarToqueRef.current) {
      // Só volta a aceitar toque quando o último dedo sair da tela.
      // Nem avança, nem despausa — a pessoa estava dando zoom.
      if (dedosRef.current.size === 0) ignorarToqueRef.current = false;
      return;
    }

    if (timerPausaRef.current) {
      clearTimeout(timerPausaRef.current);
      timerPausaRef.current = null;
    }
    const inicio = toqueRef.current;
    toqueRef.current = null;
    setArrastando(false);
    if (!inicio) return;

    // Pausou de propósito (botão ou zoom): toque simples retoma.
    // Se não fizesse isso, dar zoom e tocar para sair pulava a foto.
    if (pausaManualRef.current && !arrastouRef.current && Math.abs(e.clientX - inicio.x) <= LIMIAR_ARRASTO) {
      pausar(false);
      return;
    }

    const dx = e.clientX - inicio.x;

    if (Math.abs(dx) > LIMIAR_ARRASTO) {
      if (dx < 0) proxima();
      else anterior();
    } else if (!arrastouRef.current) {
      // Foi um toque simples: decide pelo lado da tela.
      const lado = e.clientX / window.innerWidth;
      if (lado < 0.35) anterior();
      else proxima();
    }
    pausar(false);
  };

  const curtido = atual ? Boolean(curtidas[atual.id]) : false;

  const curtidasExibidas = useMemo(
    () => (atual ? atual.likesCount + (curtido ? 1 : 0) : 0),
    [atual, curtido],
  );

  if (!atual) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] select-none bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Stories do evento"
    >
      {/* barras de progresso — uma para cada mídia */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3">
        {midias.map((m, i) => (
          <div
            key={m.id}
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white"
              style={{
                width:
                  i < indice ? "100%" : i === indice ? `${progresso * 100}%` : "0%",
                transition: arrastando ? "none" : "width 80ms linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* cabeçalho: quem enviou + fechar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 px-4 pb-4 pt-7">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
          {iniciais(atual.uploaderName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {atual.uploaderName}
          </p>
          <p className="truncate text-xs text-white/60">
            {atual.categoryTag === "OUTROS"
              ? atual.categoryCustom || "Outros"
              : (ROTULO_CATEGORIA[atual.categoryTag] ?? "Momento")}{" "}
            · {tempoRelativo(atual.createdAt)}
          </p>
        </div>
        <button
          onClick={onFechar}
          className="rounded-full p-2 text-white/80 active:bg-white/10"
          aria-label="Fechar stories"
        >
          <X className="size-6" />
        </button>
      </div>

      {/*
        Zona de toque: esquerda volta, direita avança.

        Duas defesas contra o comportamento padrão do navegador:

        1) onContextMenu + `-webkit-touch-callout: none`
           Sem isso, segurar o dedo abre o menu do navegador ("Salvar
           imagem", "Copiar link") em vez de pausar — era impossível pausar
           para olhar a foto com calma.

        2) `touch-action: pan-y pinch-zoom`
           Devolve a pinça para o navegador (sem isso o zoom não abre), e
           ao mesmo tempo libera o arraste HORIZONTAL para a gente
           controlar. Se fosse só `pinch-zoom`, o gesto de arrastar para
           passar a foto deixaria de funcionar.
           Junto com a checagem de múltiplos dedos acima, dá para abrir
           zoom sem que a foto pule para a próxima.
      */}
      <div
        className="absolute inset-0 z-10"
        style={{
          touchAction: "pan-y pinch-zoom",
          WebkitTouchCallout: "none",
        }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onContextMenu={(e) => e.preventDefault()}
      >
        {tipo === "PHOTO" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={atual.id}
            src={atual.originalUrl}
            alt={atual.caption ?? atual.uploaderName}
            draggable={false}
            className="h-full w-full object-contain"
          />
        )}

        {tipo === "VIDEO" && (
          <video
            key={atual.id}
            ref={videoRef}
            src={atual.originalUrl}
            poster={atual.thumbUrl ?? undefined}
            autoPlay
            playsInline
            onEnded={proxima}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0) setProgresso(v.currentTime / v.duration);
            }}
            className="h-full w-full object-contain"
          />
        )}

        {tipo === "AUDIO" && (
          <div className="flex h-full w-full items-center justify-center px-8">
            <div className="w-full max-w-sm rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
              <Volume2 className="mx-auto size-12 text-white" />
              <p className="mt-4 text-base font-semibold text-white">
                Recado de voz
              </p>
              {atual.caption && (
                <p className="mt-1 text-sm text-white/70">{atual.caption}</p>
              )}
              <audio
                key={atual.id}
                ref={audioRef}
                src={atual.originalUrl}
                autoPlay
                onEnded={proxima}
                onTimeUpdate={(e) => {
                  const a = e.currentTarget;
                  if (a.duration > 0) setProgresso(a.currentTime / a.duration);
                }}
                className="mt-5 w-full"
                controls
              />
            </div>
          </div>
        )}
      </div>

      {/* rodapé: legenda, curtida e dica de uso */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5 pb-7">
        {atual.caption && (
          <p className="mb-4 text-center text-[15px] leading-snug text-white drop-shadow">
            {atual.caption}
          </p>
        )}

        <div className="pointer-events-auto flex items-center justify-center gap-3">
          <button
            onClick={() => onAlternarCurtida(atual.id)}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur active:bg-white/25"
            aria-pressed={curtido}
          >
            <Heart
              className={`size-4 ${curtido ? "fill-rose-500 text-rose-500" : ""}`}
            />
            {curtidasExibidas}
          </button>

          <button
            onClick={() => pausar(!pausado, true)}
            className="rounded-full bg-white/15 p-2.5 text-white backdrop-blur active:bg-white/25"
            aria-label={pausado ? "Retomar" : "Pausar"}
          >
            {pausado ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-white/40">
          Toque na direita para avançar · segure para pausar · belisque para
          dar zoom
        </p>
      </div>
    </motion.div>
  );
}
