"use client";

/**
 * Botão de excluir evento, com confirmação.
 *
 * Excluir derruba o evento inteiro — mídias, curtidas e comentários vão
 * junto (o banco faz isso sozinho via ON DELETE CASCADE). Então o clique
 * precisa pedir confirmação antes de mandar.
 *
 * É client component só por causa do `confirm()`. A ação em si
 * (`excluirAlbum`) continua sendo server action — o client nunca recebe
 * a regra de negócio.
 */
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

function Rotulo() {
  const { pending } = useFormStatus();
  return (
    <>
      <Trash2 className="size-3.5" />
      {pending ? "Excluindo…" : "Excluir"}
    </>
  );
}

export function ExcluirEvento({
  id,
  titulo,
  totalMidias,
  action,
}: {
  id: string;
  titulo: string;
  totalMidias: number;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const plural = totalMidias === 1 ? "mídia" : "mídias";
        const ok = window.confirm(
          `Excluir "${titulo}"?\n\n` +
            `Isso apaga o evento e todas as ${totalMidias} ${plural} dele, ` +
            `com curtidas e comentários. Não dá para desfazer.\n\n` +
            `Tem certeza?`
        );
        if (!ok) e.preventDefault();
      }}
      className="inline-flex"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        <Rotulo />
      </button>
    </form>
  );
}
