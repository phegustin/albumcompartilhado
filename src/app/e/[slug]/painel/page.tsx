import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { Crown, Download, Tv, ShieldCheck, QrCode as QrIcon } from "lucide-react";

import { db } from "@/db";
import { albums, mediaItems } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { themeStyle } from "@/lib/themes";
import { BackButton } from "@/components/ui/back-button";
import { salvarConfiguracoes } from "./actions";

/**
 * Painel dos noivos: /e/[slug]/painel?pin=1234
 *
 * Acesso por link + PIN de 4 dígitos, sem criar conta.
 */
export default async function PainelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pin?: string; salvo?: string }>;
}) {
  const { slug } = await params;
  const { pin, salvo } = await searchParams;

  const [album] = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);
  if (!album) notFound();

  const liberado = Boolean(pin && pin === album.hostPin);

  /* ----------------------------- Porta ---------------------------- */
  if (!liberado) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6" style={themeStyle(album.theme)}>
        <div className="w-full max-w-sm">
          <BackButton destino={`/e/${slug}`} rotulo="Voltar" />
        </div>
        <div className="w-full max-w-sm rounded-3xl border border-album-border bg-album-surface p-7 text-center">
          <Crown className="mx-auto size-7 text-album-accent" />
          <h1 className="font-display mt-3 text-3xl font-semibold text-album-text">
            Painel dos noivos
          </h1>
          <p className="mt-1 text-sm text-album-muted">{album.title}</p>

          <form className="mt-6 space-y-3">
            <input
              name="pin"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN de 4 dígitos"
              className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-3 text-center text-2xl tracking-[0.5em] text-album-text focus:border-album-accent focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-album-primary px-4 py-3 text-sm font-semibold text-album-on-primary"
            >
              Entrar
            </button>
          </form>

          {pin && <p className="mt-4 text-xs text-red-600">PIN incorreto.</p>}
        </div>
      </main>
    );
  }

  /* --------------------------- Painel ---------------------------- */
  const midias = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.albumId, album.id))
    .orderBy(desc(mediaItems.createdAt));

  const contagem = {
    PHOTO: midias.filter((m) => m.mediaType === "PHOTO").length,
    VIDEO: midias.filter((m) => m.mediaType === "VIDEO").length,
    AUDIO: midias.filter((m) => m.mediaType === "AUDIO").length,
  };

  const base = await getBaseUrl();
  const qrPlaquinha = await QRCode.toDataURL(`${base}/e/${slug}`, {
    width: 800,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#1a1a1a", light: "#FFFFFF" },
  });

  return (
    <main className="min-h-dvh p-5" style={themeStyle(album.theme)}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <BackButton destino={`/e/${slug}`} rotulo="Voltar para o álbum" />
          <h1 className="font-display mt-5 text-4xl font-semibold text-album-text">
            {album.title}
          </h1>
          <p className="mt-1 text-sm text-album-muted">Painel dos anfitriões</p>
        </header>

        {salvo === "1" && (
          <p className="mb-6 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            Configurações salvas.
          </p>
        )}

        {/* ---------------------- Números ---------------------- */}
        <section className="mb-7 grid grid-cols-3 gap-3">
          {[
            { rotulo: "Fotos", valor: contagem.PHOTO },
            { rotulo: "Vídeos", valor: contagem.VIDEO },
            { rotulo: "Recados", valor: contagem.AUDIO },
          ].map((item) => (
            <div
              key={item.rotulo}
              className="rounded-2xl border border-album-border bg-album-surface p-4 text-center"
            >
              <p className="font-display text-3xl font-semibold text-album-text">
                {item.valor}
              </p>
              <p className="mt-0.5 text-[11px] tracking-wider text-album-muted uppercase">
                {item.rotulo}
              </p>
            </div>
          ))}
        </section>

        {/* ------------------ Plaquinha de mesa ----------------- */}
        <section className="mb-7 rounded-3xl border border-album-border bg-album-surface p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-album-muted uppercase">
            <QrIcon className="size-4" />
            Plaquinha de mesa
          </h2>

          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
            <div className="w-48 shrink-0 rounded-2xl border border-album-border bg-white p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrPlaquinha} alt="QR Code do evento" className="w-full" />
              <p className="font-display mt-2 text-lg leading-tight font-semibold text-neutral-900">
                {album.title}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-600">
                Aponte a câmera e mande suas fotos
              </p>
            </div>

            <div className="flex-1">
              <p className="text-sm leading-relaxed text-album-muted">
                Essa arte já sai pronta para imprimir. Mandando para a gráfica,
                use 10×15 cm. Para imprimir em casa, salve a imagem e coloque
                em papel fotográfico.
              </p>
              <a
                href={qrPlaquinha}
                download={`plaquinha-${slug}.png`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-album-primary px-4 py-2.5 text-sm font-semibold text-album-on-primary"
              >
                <Download className="size-4" />
                Baixar plaquinha em PNG
              </a>
            </div>
          </div>
        </section>

        {/* ------------------ Configurações -------------------- */}
        <section className="mb-7 rounded-3xl border border-album-border bg-album-surface p-6">
          <h2 className="mb-5 text-sm font-semibold tracking-[0.2em] text-album-muted uppercase">
            Personalização
          </h2>

          <form action={salvarConfiguracoes} className="space-y-4">
            <input type="hidden" name="slug" value={album.slug} />
            <input type="hidden" name="pin" value={pin} />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-album-muted">Título</span>
                <input
                  name="title"
                  defaultValue={album.title}
                  className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text focus:border-album-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-album-muted">
                  Subtítulo
                </span>
                <input
                  name="subtitle"
                  defaultValue={album.subtitle ?? ""}
                  className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text focus:border-album-accent focus:outline-none"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-album-muted">Paleta</span>
              <select
                name="theme"
                defaultValue={album.theme}
                className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text"
              >
                <option value="OLIVE_GOLD">Olive & Gold</option>
                <option value="CLASSIC_NOIR">Classic Noir</option>
                <option value="TERRACOTTA">Terracotta</option>
                <option value="ROSE_QUARTZ">Rose Quartz</option>
                <option value="MIDNIGHT_PARTY">Midnight Party</option>
              </select>
            </label>

            <div className="space-y-2.5 rounded-xl border border-album-border bg-album-bg p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="requireModeration"
                  defaultChecked={album.requireModeration}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="block text-sm font-medium text-album-text">
                    Moderar antes do telão
                  </span>
                  <span className="block text-xs text-album-muted">
                    Fotos ficam na fila até você ou a cerimonialista aprovar.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="capsuleMode"
                  defaultChecked={album.capsuleMode}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="block text-sm font-medium text-album-text">
                    Modo cápsula surpresa
                  </span>
                  <span className="block text-xs text-album-muted">
                    Convidados enviam na festa e o álbum revela tudo depois.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-album-muted">
                  Sua marca (rodapé)
                </span>
                <input
                  name="studioBrandName"
                  defaultValue={album.studioBrandName ?? ""}
                  className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text focus:border-album-accent focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-album-muted">
                  WhatsApp
                </span>
                <input
                  name="studioWhatsapp"
                  defaultValue={album.studioWhatsapp ?? ""}
                  className="w-full rounded-xl border border-album-border bg-album-bg px-4 py-2.5 text-sm text-album-text focus:border-album-accent focus:outline-none"
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-album-primary px-4 py-3 text-sm font-semibold text-album-on-primary"
            >
              Salvar alterações
            </button>
          </form>
        </section>

        {/* ---------------------- Atalhos ---------------------- */}
        <section className="grid gap-2 sm:grid-cols-2">
          <a
            href={`/e/${slug}/telao`}
            className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-4 py-3 text-sm font-medium text-album-text hover:bg-album-surface"
          >
            <Tv className="size-4" />
            Abrir telão ao vivo
          </a>
          <a
            href={`/e/${slug}/moderar?pin=${album.moderatorPin}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-album-border px-4 py-3 text-sm font-medium text-album-text hover:bg-album-surface"
          >
            <ShieldCheck className="size-4" />
            Moderação (PIN {album.moderatorPin})
          </a>
        </section>
      </div>
    </main>
  );
}
