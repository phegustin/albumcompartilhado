"use client";

/**
 * Endereço público de um evento, no Super Admin.
 *
 * Antes era só um <p> com o texto da URL. Dois problemas:
 *
 *   1) Não dava para CLICAR — não era um link, era texto.
 *   2) Não dava para COPIAR selecionando, porque o globals.css aplica
 *      user-select: none no corpo inteiro (isso foi feito para matar o
 *      cursor piscando em tudo que não é texto).
 *
 * Então aqui o endereço é link de verdade E tem botão de copiar, que
 * funciona sem depender de selecionar texto com o dedo.
 */
import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function LinkEvento({ url }: { url: string }) {
  const [copiou, setCopiou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Navegador sem permissão de área de transferência (ou http sem
      // permissão): seleciona o texto para a pessoa copiar à moda antiga.
      const alvo = document.getElementById(`url-${cssId(url)}`);
      if (alvo) {
        const faixa = document.createRange();
        faixa.selectNodeContents(alvo);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(faixa);
        return;
      }
    }
    setCopiou(true);
    setTimeout(() => setCopiou(false), 1600);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-album-border bg-album-bg px-3 py-2">
      <ExternalLink className="size-3.5 shrink-0 text-album-muted" />

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="copia-sim min-w-0 flex-1 truncate text-[11px] text-album-text underline decoration-album-border underline-offset-2 hover:text-album-accent"
      >
        {url}
      </a>

      <button
        type="button"
        onClick={copiar}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-album-border px-2.5 py-1.5 text-[11px] font-medium text-album-muted transition-colors hover:border-album-accent hover:text-album-text"
        aria-label={`Copiar endereço do evento: ${url}`}
      >
        {copiou ? (
          <>
            <Check className="size-3 text-green-600" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="size-3" />
            Copiar
          </>
        )}
      </button>

      {/* Usado como alvo de seleção quando a área de transferência falha. */}
      <span id={`url-${cssId(url)}`} className="hidden">
        {url}
      </span>
    </div>
  );
}

/** Sufixo seguro para usar em id de HTML. */
function cssId(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, "");
}
