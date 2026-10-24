"use client";

/**
 * Download das mídias do evento, com seleção.
 *
 * Os noivos escolhem o que querem levar: tudo de uma vez, só a cerimônia,
 * ou foto por foto. O arquivo sai em ZIP organizado por momento
 * (01-Pre-Festa/, 02-Cerimonia/, 03-Recepcao/, 04-Pista/, 05-Recados/).
 *
 * POR QUE O ZIP É MONTADO NO NAVEGADOR, e não no servidor:
 *   - Vercel/Supabase cobram por tempo e memória de função. Um evento com
 *     300 fotos de 5 MB são 1,5 GB passando pela lambda, com limite de 300 s
 *     e risco real de estourar.
 *   - No navegador, cada arquivo vem direto do Storage (CDN) e o ZIP é
 *     montado na memória do aparelho de quem está baixando. Não passa pelo
 *     servidor e não tem limite de tempo.
 *
 * Busca os ORIGINAIS (originalUrl), não os thumbs: o download sai em 100% de
 * qualidade, que é o que os noivos realmente querem guardar.
 */
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Check, Download, Loader2, Music2, Images, Video } from "lucide-react";

export type MidiaParaDownload = {
  id: string;
  thumbUrl: string | null;
  originalUrl: string;
  uploaderName: string;
  mediaType: "PHOTO" | "VIDEO" | "AUDIO";
  categoryTag:
    | "MAKING_OF"
    | "CERIMONIA"
    | "RECEPCAO"
    | "PISTA"
    | "RECADOS"
    | "OUTROS";
  /** Preenchido quando categoryTag = "OUTROS" (ex.: "valsa", "banquete"). */
  categoryCustom: string | null;
  caption: string | null;
};

/** Pastas na ordem em que a festa acontece. */
const PASTAS: Record<MidiaParaDownload["categoryTag"], string> = {
  MAKING_OF: "01-Pre-Festa",
  CERIMONIA: "02-Cerimonia",
  RECEPCAO: "03-Recepcao",
  PISTA: "04-Pista",
  RECADOS: "05-Recados-de-Voz",
  OUTROS: "06-Outros",
};

const ROTULO_MOMENTO: Record<MidiaParaDownload["categoryTag"], string> = {
  MAKING_OF: "Pré-Festa",
  CERIMONIA: "Cerimônia",
  RECEPCAO: "Recepção",
  PISTA: "Pista",
  RECADOS: "Recados",
  OUTROS: "Outros",
};

/**
 * Cada momento escrito pelos convidados ("valsa", "drinks") vira um grupo
 * próprio — com pasta própria no ZIP. Se a gente misturasse tudo numa pasta
 * "Outros", o download perderia justamente a organização que é o objetivo.
 */
function chaveMomento(m: MidiaParaDownload): string {
  return m.categoryTag === "OUTROS"
    ? `OUTROS:${(m.categoryCustom || "Outros").trim().toLowerCase()}`
    : m.categoryTag;
}

function rotuloMomento(chave: string, exemplo: MidiaParaDownload): string {
  if (chave.startsWith("OUTROS:")) return (exemplo.categoryCustom || "Outros").trim();
  return ROTULO_MOMENTO[exemplo.categoryTag] ?? "Outros";
}

function pastaMomento(m: MidiaParaDownload): string {
  if (m.categoryTag === "OUTROS") {
    const nome = limparNome(m.categoryCustom || "Outros") || "outros";
    return `06-Outros/${nome}`;
  }
  return PASTAS[m.categoryTag];
}

const EXTENSAO: Record<MidiaParaDownload["mediaType"], string> = {
  PHOTO: "jpg",
  VIDEO: "mp4",
  AUDIO: "webm",
};

/** Tira acentos e caracteres que atrapalham em nome de arquivo. */
function limparNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function IconePorTipo({ tipo }: { tipo: MidiaParaDownload["mediaType"] }) {
  if (tipo === "VIDEO") return <Video className="size-3.5" />;
  if (tipo === "AUDIO") return <Music2 className="size-3.5" />;
  return <Images className="size-3.5" />;
}

export function DownloadSelecao({
  midias,
  nomeEvento,
}: {
  midias: MidiaParaDownload[];
  nomeEvento: string;
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [erro, setErro] = useState<string | null>(null);

  const todasSelecionadas =
    midias.length > 0 && selecionadas.size === midias.length;
  const algunhasSelecionadas = selecionadas.size > 0;

  /** Agrupa por momento para os botões "baixar só a cerimônia" etc. */
  const porMomento = useMemo(() => {
    const mapa = new Map<string, MidiaParaDownload[]>();
    for (const m of midias) {
      const chave = chaveMomento(m);
      const lista = mapa.get(chave) ?? [];
      lista.push(m);
      mapa.set(chave, lista);
    }
    return Array.from(mapa.entries());
  }, [midias]);

  function alternar(id: string) {
    setSelecionadas((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarTodas() {
    setSelecionadas(new Set(midias.map((m) => m.id)));
  }

  function limparSelecao() {
    setSelecionadas(new Set());
  }

  function selecionarMomento(chave: string) {
    const doMomento = midias.filter((m) => chaveMomento(m) === chave);
    const todasMarcadas = doMomento.every((m) => selecionadas.has(m.id));
    setSelecionadas((antes) => {
      const novo = new Set(antes);
      for (const m of doMomento) {
        if (todasMarcadas) novo.delete(m.id);
        else novo.add(m.id);
      }
      return novo;
    });
  }

  async function baixarZip(lista: MidiaParaDownload[]) {
    if (lista.length === 0 || baixando) return;

    setBaixando(true);
    setErro(null);
    setProgresso({ atual: 0, total: lista.length });

    try {
      const zip = new JSZip();
      const usados = new Map<string, number>();

      for (let i = 0; i < lista.length; i += 1) {
        const m = lista[i];
        setProgresso({ atual: i + 1, total: lista.length });

        try {
          const resposta = await fetch(m.originalUrl);
          if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
          const blob = await resposta.blob();

          const pasta = pastaMomento(m);
          const base = `${limparNome(m.uploaderName) || "convidado"}-${m.id.slice(0, 8)}`;
          const nome = `${base}.${EXTENSAO[m.mediaType]}`;
          const chave = `${pasta}/${nome}`;

          // Se dois arquivos caírem no mesmo nome, numera o segundo.
          const vezes = usados.get(chave) ?? 0;
          usados.set(chave, vezes + 1);
          const final =
            vezes === 0 ? chave : chave.replace(/\.([a-z0-9]+)$/, `-${vezes + 1}.$1`);

          zip.file(final, blob);
        } catch {
          // Uma foto que falha não pode derrubar o ZIP inteiro.
          setErro(
            `Alguns arquivos não puderam ser baixados. O ZIP sairá com o que deu certo.`
          );
        }
      }

      const conteudo = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(conteudo);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${limparNome(nomeEvento) || "album"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(
        `Não foi possível montar o ZIP: ${e instanceof Error ? e.message : "erro desconhecido"}`
      );
    } finally {
      setBaixando(false);
      setProgresso({ atual: 0, total: 0 });
    }
  }

  const listaSelecionada = midias.filter((m) => selecionadas.has(m.id));

  if (midias.length === 0) {
    return (
      <p className="text-sm text-album-muted">
        Nenhuma mídia enviada ainda. Assim que os convidados começarem a mandar
        fotos, elas aparecem aqui para download.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---------------- Atalhos por momento ---------------- */}
      <div className="flex flex-wrap gap-2">
        {porMomento.map(([chave, lista]) => {
          const marcadas = lista.filter((m) => selecionadas.has(m.id)).length;
          return (
            <button
              key={chave}
              type="button"
              onClick={() => selecionarMomento(chave)}
              className="rounded-full border border-album-border px-3 py-1.5 text-xs text-album-muted transition-colors hover:border-album-accent hover:text-album-text"
            >
              {rotuloMomento(chave, lista[0])} ({lista.length})
              {marcadas > 0 && (
                <span className="ml-1 font-semibold text-album-accent">
                  · {marcadas}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------------- Selecionar tudo / limpar ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={todasSelecionadas ? limparSelecao : selecionarTodas}
            className="rounded-xl border border-album-border px-3 py-2 text-xs font-medium text-album-text hover:bg-album-bg"
          >
            {todasSelecionadas ? "Desmarcar todas" : "Selecionar todas"}
          </button>
          {algunhasSelecionadas && !todasSelecionadas && (
            <button
              type="button"
              onClick={limparSelecao}
              className="rounded-xl border border-album-border px-3 py-2 text-xs text-album-muted hover:text-album-text"
            >
              Limpar seleção
            </button>
          )}
        </div>

        <p className="text-xs text-album-muted">
          {selecionadas.size} de {midias.length} selecionadas
        </p>
      </div>

      {/* ---------------- Grade com checkboxes ---------------- */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {midias.map((m) => {
          const marcada = selecionadas.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => alternar(m.id)}
              aria-pressed={marcada}
              className="group relative aspect-square overflow-hidden rounded-xl border-2 bg-album-bg transition-all"
              style={{
                borderColor: marcada ? "var(--album-accent)" : "transparent",
              }}
            >
              {m.thumbUrl ? (
                //thumb vem de domínio externo (Supabase Storage)
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumbUrl}
                  alt={m.caption ?? m.uploaderName}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-album-muted">
                  <IconePorTipo tipo={m.mediaType} />
                </span>
              )}

              {marcada && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="flex size-7 items-center justify-center rounded-full bg-album-accent text-white">
                    <Check className="size-4" />
                  </span>
                </span>
              )}

              <span className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[10px] text-white">
                {m.uploaderName}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------------- Erro / progresso ---------------- */}
      {erro && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          {erro}
        </p>
      )}

      {baixando && (
        <div className="rounded-xl border border-album-border bg-album-bg px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-album-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Preparando {progresso.atual} de {progresso.total}…
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-album-border">
            <div
              className="h-full rounded-full bg-album-accent transition-all"
              style={{
                width: `${Math.round((progresso.atual / progresso.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ---------------- Botão de download ---------------- */}
      <button
        type="button"
        disabled={!algunhasSelecionadas || baixando}
        onClick={() => baixarZip(listaSelecionada)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-album-primary px-4 py-3.5 text-sm font-semibold text-album-on-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {baixando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {baixando
          ? "Preparando ZIP…"
          : algunhasSelecionadas
            ? `Baixar ${selecionadas.size} ${selecionadas.size === 1 ? "arquivo" : "arquivos"} em ZIP`
            : "Selecione o que quer baixar"}
      </button>

      <p className="text-[11px] leading-relaxed text-album-muted">
        Os arquivos saem em <strong>qualidade original</strong>, organizados em
        pastas por momento da festa. O ZIP é montado no seu aparelho, então
        eventos com muitas fotos podem levar alguns minutos — vale fazer isso no
        Wi-Fi.
      </p>
    </div>
  );
}
