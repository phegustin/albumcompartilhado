"use client";

/**
 * Painel de envio do convidado.
 *
 * Fluxo por arquivo:
 *   1) pede URLs assinadas em /api/gallery/presign
 *   2) gera a miniatura WebP no próprio celular
 *   3) faz PUT direto no storage (original + miniatura), com progresso real
 *   4) confirma em /api/gallery/confirm para gravar no banco
 *
 * Visual segue a mesma linguagem do resto do app: sem bordas pesadas,
 * cantos suaves, sombra leve e muito respiro.
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, Loader2, RotateCcw, Upload, X } from "lucide-react";

import { gerarMiniaturaWebp } from "@/lib/client/thumb";

export type CategoriaEnvio =
  | "MAKING_OF"
  | "CERIMONIA"
  | "RECEPCAO"
  | "PISTA"
  | "RECADOS"
  // "Outros": a pessoa escreve o momento. Existe porque a lista fixa nunca
  // vai cobrir tudo — valsa, banquete e drinks são exemplos reais que não
  // cabiam. Em vez de inflar o enum com dezenas de opções, deixamos escrever.
  | "OUTROS";

const CATEGORIAS: { valor: CategoriaEnvio; rotulo: string }[] = [
  { valor: "MAKING_OF", rotulo: "Pré-Festa" },
  { valor: "CERIMONIA", rotulo: "Cerimônia" },
  { valor: "RECEPCAO", rotulo: "Recepção" },
  { valor: "PISTA", rotulo: "Pista" },
  { valor: "RECADOS", rotulo: "Recados" },
  { valor: "OUTROS", rotulo: "Outros" },
];

/**
 * Sugestões que aparecem para quem escolhe "Outros".
 *
 * São momentos que aparecem em praticamente toda festa e que a lista fixa
 * não cobre. Servem de atalho: a pessoa clica em vez de digitar — mas pode
 * escrever qualquer coisa diferente, e o que ela escrever passa a ser
 * sugerido para os próximos convidados do mesmo evento.
 */
const MOMENTOS_SUGERIDOS = [
  "Valsa",
  "Banquete",
  "Drinks",
  "Hora do bolo",
  "Mesa de doces",
  "Saída da noiva",
  "Família",
  "Amigos",
];

type ItemFila = {
  id: string;
  arquivo: File;
  progresso: number;
  status: "aguardando" | "enviando" | "ok" | "erro";
  erro?: string;
};

/** PUT com barra de progresso real (fetch não expõe progresso de upload). */
function enviarComProgresso(
  url: string,
  corpo: Blob,
  contentType: string,
  onProgresso: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", contentType);

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) {
        onProgresso(Math.round((evento.loaded / evento.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgresso(100);
        resolve();
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("falha de rede"));
    xhr.send(corpo);
  });
}

export function UploadSheet({
  slug,
  guestName,
  deviceId,
  categoriaInicial = "RECEPCAO",
  momentosUsados = [],
  onFechar,
  onConcluido,
}: {
  slug: string;
  guestName: string;
  deviceId: string;
  categoriaInicial?: CategoriaEnvio;
  /** Momentos que outros convidados já escreveram neste evento. */
  momentosUsados?: string[];
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [categoria, setCategoria] = useState<CategoriaEnvio>(categoriaInicial);
  const [momentoLivre, setMomentoLivre] = useState("");
  const [legenda, setLegenda] = useState("");

  /**
   * Sugestões = as que já vêm prontas + as que os convidados deste evento
   * já escreveram. Sem repetir e sem diferença de maiúscula/minúscula.
   */
  const sugestoes = Array.from(
    new Set(
      [...momentosUsados, ...MOMENTOS_SUGERIDOS].map((m) => m.trim()).filter(Boolean),
    ),
  ).filter(
    (m, i, todos) =>
      todos.findIndex((o) => o.toLowerCase() === m.toLowerCase()) === i,
  );

  const momentoFinal =
    categoria === "OUTROS" ? momentoLivre.trim() || null : null;
  const [ocupado, setOcupado] = useState(false);

  function atualizar(id: string, mudanca: Partial<ItemFila>) {
    setFila((atual) =>
      atual.map((item) => (item.id === id ? { ...item, ...mudanca } : item)),
    );
  }

  function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
    const novos: ItemFila[] = Array.from(arquivos)
      .slice(0, 25) // limite do .md: 25 por vez
      .map((arquivo) => ({
        id: crypto.randomUUID(),
        arquivo,
        progresso: 0,
        status: "aguardando" as const,
      }));
    setFila((atual) => [...atual, ...novos]);
  }

  async function processar(item: ItemFila) {
    atualizar(item.id, { status: "enviando", progresso: 0 });

    try {
      const extensao = item.arquivo.name.split(".").pop()?.toLowerCase() || "jpg";

      const presign = await fetch("/api/gallery/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          ext: extensao,
          contentType: item.arquivo.type || "application/octet-stream",
        }),
      });

      if (!presign.ok) throw new Error("não consegui liberar o envio");
      const { original, thumb } = await presign.json();

      // Envia o ORIGINAL primeiro (é o que o cliente pagou para ter).
      await enviarComProgresso(
        original.uploadUrl,
        item.arquivo,
        item.arquivo.type || "application/octet-stream",
        (pct) => atualizar(item.id, { progresso: pct }),
      );

      // Miniatura: se falhar, seguimos sem ela — o original já subiu.
      let thumbUrl: string | null = null;
      try {
        const miniatura = await gerarMiniaturaWebp(item.arquivo);
        if (miniatura) {
          await enviarComProgresso(
            thumb.uploadUrl,
            miniatura,
            "image/webp",
            () => {},
          );
          thumbUrl = thumb.publicUrl;
        }
      } catch {
        thumbUrl = null;
      }

      const tipo = item.arquivo.type.startsWith("video/")
        ? "VIDEO"
        : item.arquivo.type.startsWith("audio/")
          ? "AUDIO"
          : "PHOTO";

      const confirmacao = await fetch("/api/gallery/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          uploaderName: guestName,
          uploaderDeviceId: deviceId,
          mediaType: tipo,
          categoryTag: categoria,
          categoryCustom: momentoFinal,
          originalPath: original.path,
          originalUrl: original.publicUrl,
          thumbUrl,
          caption: legenda || null,
        }),
      });

      if (!confirmacao.ok) throw new Error("falhou ao salvar");

      atualizar(item.id, { status: "ok", progresso: 100 });
    } catch (erro) {
      atualizar(item.id, {
        status: "erro",
        erro: erro instanceof Error ? erro.message : "erro desconhecido",
      });
    }
  }

  async function enviarTudo() {
    if (ocupado) return;
    setOcupado(true);

    // Um por vez: evita sobrecarregar o 4G do salão.
    for (const item of fila.filter((i) => i.status !== "ok")) {
      await processar(item);
    }

    setOcupado(false);
    if (fila.some((i) => i.status === "ok")) onConcluido();
  }

  const concluidos = fila.filter((i) => i.status === "ok").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-album-surface p-6 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-semibold text-album-text">
              Enviar lembranças
            </h3>
            <p className="mt-0.5 text-sm text-album-muted">
              Como <strong className="text-album-text">{guestName}</strong>
            </p>
          </div>
          <button
            onClick={onFechar}
            className="rounded-full bg-album-bg p-2 text-album-muted"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Seletor de momento */}
        <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-album-muted uppercase">
          Momento
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => {
            const ativo = categoria === c.valor;
            return (
              <button
                key={c.valor}
                onClick={() => setCategoria(c.valor)}
                className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors"
                style={{
                  background: ativo ? "var(--album-primary)" : "transparent",
                  color: ativo ? "var(--album-on-primary)" : "var(--album-muted)",
                  boxShadow: ativo
                    ? "none"
                    : "inset 0 0 0 1px var(--album-border)",
                }}
              >
                {c.rotulo}
              </button>
            );
          })}
        </div>

        {/*
          "Outros": a pessoa escreve o momento com as próprias palavras.
          As sugestões abaixo são atalhos — clicar preenche o campo, mas ela
          pode apagar e escrever qualquer coisa. O que ela escrever fica
          salvo e passa a ser sugerido para os próximos convidados.
        */}
        {categoria === "OUTROS" && (
          <div className="mb-5 rounded-2xl bg-album-bg p-3.5">
            <input
              value={momentoLivre}
              onChange={(e) => setMomentoLivre(e.target.value)}
              placeholder="Qual momento? Ex.: valsa, banquete, drinks"
              maxLength={40}
              className="w-full rounded-xl bg-album-surface px-4 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:ring-2 focus:ring-album-accent focus:outline-none"
            />

            {sugestoes.length > 0 && (
              <>
                <p className="mt-3 mb-1.5 text-[11px] text-album-muted">
                  Toque para usar:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sugestoes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMomentoLivre(s)}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium text-album-text transition-colors"
                      style={{ boxShadow: "inset 0 0 0 1px var(--album-border)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <input
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          placeholder="Legenda carinhosa (opcional)"
          className="mb-4 w-full rounded-2xl bg-album-bg px-4 py-3.5 text-sm text-album-text placeholder:text-album-muted focus:ring-2 focus:ring-album-accent focus:outline-none"
        />

        <button
          onClick={() => inputRef.current?.click()}
          className="mb-5 flex w-full flex-col items-center gap-2 rounded-3xl bg-album-bg py-9 text-album-muted transition-colors hover:text-album-text"
          style={{ boxShadow: "inset 0 0 0 1.5px var(--album-border)" }}
        >
          <Upload className="size-6" />
          <span className="text-sm font-medium text-album-text">
            Escolher fotos, vídeos ou áudio
          </span>
          <span className="text-xs">até 25 arquivos por vez</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => adicionarArquivos(e.target.files)}
        />

        {fila.length > 0 && (
          <ul className="mb-5 space-y-2">
            {fila.map((item) => (
              <li key={item.id} className="rounded-2xl bg-album-bg p-3.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-album-text">
                      {item.arquivo.name}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-album-border">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${item.progresso}%`,
                          background:
                            item.status === "erro"
                              ? "#c0392b"
                              : "var(--album-accent)",
                        }}
                      />
                    </div>
                  </div>

                  {item.status === "enviando" && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-album-muted" />
                  )}
                  {item.status === "ok" && (
                    <Check className="size-4 shrink-0 text-green-600" />
                  )}
                  {item.status === "erro" && (
                    <button
                      onClick={() => processar(item)}
                      className="shrink-0 rounded-full bg-album-surface p-1.5 text-album-muted"
                      aria-label="Tentar novamente"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  )}
                </div>

                {item.status === "erro" && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600">
                    <AlertCircle className="size-3" />
                    {item.erro} — toque para tentar de novo
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={enviarTudo}
          disabled={ocupado || fila.length === 0 || concluidos === fila.length}
          className="w-full rounded-2xl px-4 py-4 text-sm font-semibold text-album-on-primary transition-transform active:scale-[.98] disabled:opacity-40"
          style={{ background: "var(--album-primary)" }}
        >
          {ocupado
            ? "Enviando..."
            : fila.length === 0
              ? "Escolha os arquivos primeiro"
              : `Enviar ${fila.length} ${fila.length === 1 ? "arquivo" : "arquivos"}`}
        </button>
      </motion.div>
    </div>
  );
}
