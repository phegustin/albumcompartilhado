"use client";

/**
 * Botão de voltar, usado em todas as telas internas.
 *
 * A sacada aqui: se a pessoa ABRIU a página direto (escaneou o QR, clicou num
 * link do WhatsApp), não existe histórico do navegador pra voltar — dar
 * "voltar" nesse caso simplesmente fecha a aba e a pessoa se perde.
 *
 * Então: se existe histórico dentro do app -> volta de verdade.
 *         se não existe                    -> vai pro `destino` seguro.
 */
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Variante = "sobre-imagem" | "sobre-pagina";

export function BackButton({
  destino,
  rotulo,
  variante = "sobre-pagina",
  className = "",
}: {
  /** Para onde ir quando não existe histórico pra voltar. */
  destino: string;
  /** Se vier, o botão fica em formato de pílula com texto. */
  rotulo?: string;
  /** "sobre-imagem" = ícone branco sobre fundo escuro (usado em cima de foto). */
  variante?: Variante;
  className?: string;
}) {
  const router = useRouter();

  function voltar() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(destino);
    }
  }

  const escuro = variante === "sobre-imagem";

  const base =
    "inline-flex shrink-0 items-center transition active:scale-95 rounded-full";
  const cores = escuro
    ? "bg-black/35 text-white backdrop-blur-md"
    : "bg-[var(--album-surface)]/90 text-[var(--album-text)] shadow-sm ring-1 ring-black/5 backdrop-blur-md";
  const formato = rotulo ? "gap-1.5 px-3.5 py-2" : "size-10 justify-center";

  return (
    <button
      type="button"
      onClick={voltar}
      aria-label={rotulo ?? "Voltar"}
      className={`${base} ${cores} ${formato} ${className}`}
    >
      <ArrowLeft className="size-[18px]" />
      {rotulo && <span className="text-[13px] font-medium">{rotulo}</span>}
    </button>
  );
}
