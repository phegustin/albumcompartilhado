"use client";

/**
 * Os dois endereços curtos de um evento.
 *
 *   /t/<codigo>  telão       — para digitar na TV
 *   /c/<codigo>  convidados  — para mandar no WhatsApp e imprimir na mesa
 *
 * Por que existe: o endereço completo passa de 90 caracteres. Ninguém digita
 * isso no controle remoto, e numa plaquinha de mesa fica ilegível.
 *
 * O "abrir" e o "copiar" valem para os dois, porque os dois usos acontecem:
 * abrir para conferir se está certo, copiar para mandar.
 */
import { useState } from "react";
import { Copy, ExternalLink, MonitorPlay, Users } from "lucide-react";

export function LinksCurtos({
  base,
  codigo,
}: {
  /** Endereço público (ex.: https://seudominio.com.br). */
  base: string;
  /** Código curto do evento (ex.: "93JW82"). */
  codigo: string;
}) {
  if (!codigo) return null;

  const telao = `${base}/t/${codigo}`;
  const convidados = `${base}/c/${codigo}`;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <Linha
        url={telao}
        rotulo="Telão (TV)"
        dica="Digite na TV"
        destaque={codigo}
        icone={<MonitorPlay className="size-3.5" />}
      />
      <Linha
        url={convidados}
        rotulo="Convidados"
        dica="Mande no WhatsApp"
        destaque={codigo}
        icone={<Users className="size-3.5" />}
      />
    </div>
  );
}

function Linha({
  url,
  rotulo,
  dica,
  destaque,
  icone,
}: {
  url: string;
  rotulo: string;
  dica: string;
  destaque: string;
  icone: React.ReactNode;
}) {
  const [copiou, setCopiou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiou(true);
      setTimeout(() => setCopiou(false), 1600);
    } catch {
      // Sem permissão de área de transferência: abre o endereço, a pessoa
      // copia da barra do navegador.
      window.open(url, "_blank", "noreferrer");
    }
  }

  return (
    <div className="rounded-xl border border-album-border bg-album-bg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-album-muted">
        {icone}
        <span className="font-medium">{rotulo}</span>
        <span className="text-album-muted/60">· {dica}</span>
      </div>

      <p className="copia-sim mt-1.5 font-mono text-base font-semibold tracking-wider text-album-text">
        {destaque}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-lg border border-album-border px-2 py-1 text-[11px] text-album-muted hover:border-album-accent hover:text-album-text"
        >
          <ExternalLink className="size-3" />
          Abrir
        </a>
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1 rounded-lg border border-album-border px-2 py-1 text-[11px] text-album-muted hover:border-album-accent hover:text-album-text"
        >
          <Copy className="size-3" />
          {copiou ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
