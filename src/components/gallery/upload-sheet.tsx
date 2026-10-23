"use client";

/**
 * Painel de envio do convidado.
 *
 * Fluxo por arquivo:
 *   1) pede URLs assinadas em /api/gallery/presign
 *   2) gera a miniatura WebP no próprio celular
 *   3) faz PUT direto no storage (original + miniatura), com progresso real
 *   4) confirma em /api/gallery/confirm para gravar no banco
 */
import { useRef, useState } from "react";
import { AlertCircle, Check, Loader2, RotateCcw, Upload, X } from "lucide-react";

import { gerarMiniaturaWebp } from "@/lib/client/thumb";

export type CategoriaEnvio =
  | "MAKING_OF"
  | "CERIMONIA"
  | "RECEPCAO"
  | "PISTA"
  | "RECADOS";

const CATEGORIAS: { valor: CategoriaEnvio; rotulo: string }[] = [
  { valor: "MAKING_OF", rotulo: "Pré-Festa" },
  { valor: "CERIMONIA", rotulo: "Cerimônia" },
  { valor: "RECEPCAO", rotulo: "Recepção" },
  { valor: "PISTA", rotulo: "Pista" },
  { valor: "RECADOS", rotulo: "Recados" },
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
  onFechar,
  onConcluido,
}: {
  slug: string;
  guestName: string;
  deviceId: string;
  categoriaInicial?: CategoriaEnvio;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [categoria, setCategoria] = useState<CategoriaEnvio>(categoriaInicial);
  const [legenda, setLegenda] = useState("");
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

    const pendentes = fila.filter((i) => i.status !== "ok");
    // Um por vez: evita sobrecarregar o 4G do salão.
    for (const item of pendentes) {
      await processar(item);
    }

    setOcupado(false);

    if (fila.some((i) => i.status === "ok")) {
      onConcluido();
    }
  }

  const concluidos = fila.filter((i) => i.status === "ok").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-album-border bg-album-surface p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-album-text">
            Enviar lembranças
          </h3>
          <button
            onClick={onFechar}
            className="rounded-full p-2 text-album-muted hover:bg-album-bg"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-album-muted">
          Enviando como <strong className="text-album-text">{guestName}</strong>
        </p>

        {/* Seletor de momento */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium tracking-wider text-album-muted uppercase">
            Momento
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c.valor}
                onClick={() => setCategoria(c.valor)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  categoria === c.valor
                    ? "border-album-primary text-album-on-primary"
                    : "border-album-border text-album-text hover:bg-album-bg"
                }`}
                style={
                  categoria === c.valor
                    ? { background: "var(--album-primary)" }
                    : undefined
                }
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <input
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          placeholder="Legenda carinhosa (opcional)"
          className="mb-4 w-full rounded-xl border border-album-border bg-album-bg px-3 py-2.5 text-sm text-album-text placeholder:text-album-muted focus:border-album-accent focus:outline-none"
        />

        {/* Botão de escolher arquivos */}
        <button
          onClick={() => inputRef.current?.click()}
          className="mb-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-album-border py-8 text-album-muted hover:border-album-accent hover:text-album-text"
        >
          <Upload className="size-6" />
          <span className="text-sm font-medium">
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

        {/* Fila com progresso individual */}
        {fila.length > 0 && (
          <ul className="mb-4 space-y-2">
            {fila.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-album-border bg-album-bg p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-album-text">
                      {item.arquivo.name}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-album-border">
                      <div
                        className="h-full rounded-full transition-all"
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
                      className="shrink-0 rounded-full p-1 text-album-muted hover:bg-album-surface"
                      aria-label="Tentar novamente"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  )}
                </div>

                {item.status === "erro" && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600">
                    <AlertCircle className="size-3" />
                    {item.erro} — toque em tentar novamente
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={enviarTudo}
          disabled={ocupado || fila.length === 0 || concluidos === fila.length}
          className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-album-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--album-primary)" }}
        >
          {ocupado
            ? "Enviando..."
            : fila.length === 0
              ? "Escolha os arquivos primeiro"
              : `Enviar ${fila.length} ${fila.length === 1 ? "arquivo" : "arquivos"}`}
        </button>
      </div>
    </div>
  );
}
