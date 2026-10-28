/**
 * Geração de miniatura no próprio navegador do convidado.
 *
 * Por que isso existe: a foto original de um iPhone pode ter 12 MB. Se o feed
 * carregasse os originais, a galeria ficaria lenta no 4G do salão. Então o
 * celular gera um WebP leve (~800px) SÓ para exibição e manda os dois:
 *   - miniatura  -> feed e telão (rápido)
 *   - original   -> download dos noivos (sem perda)
 */

/** iPhone costuma mandar .HEIC, que boa parte dos navegadores não decodifica. */
function ehHeic(arquivo: File): boolean {
  return (
    /\.(heic|heif)$/i.test(arquivo.name) ||
    arquivo.type === "image/heic" ||
    arquivo.type === "image/heif"
  );
}

async function desenharEmCanvas(
  fonte: CanvasImageSource,
  larguraOriginal: number,
  alturaOriginal: number,
  max: number,
  qualidade: number,
): Promise<Blob | null> {
  const escala = Math.min(1, max / Math.max(larguraOriginal, alturaOriginal));
  const largura = Math.round(larguraOriginal * escala);
  const altura = Math.round(alturaOriginal * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(fonte, 0, 0, largura, altura);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", qualidade);
  });
}

/** Tira um frame do vídeo para servir de capa. */
async function capturarFrame(
  arquivo: File,
  max: number,
  qualidade: number,
): Promise<Blob | null> {
  const url = URL.createObjectURL(arquivo);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => resolve();
      setTimeout(resolve, 4000);
    });

    // Avança 1s (ou metade) para não pegar um frame preto de abertura.
    video.currentTime = Math.min(1, (video.duration || 1) / 2);

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      setTimeout(resolve, 3000);
    });

    return await desenharEmCanvas(
      video,
      video.videoWidth || 720,
      video.videoHeight || 1280,
      max,
      qualidade,
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Devolve um WebP reduzido, ou null se não for possível (aí o sistema segue
 * sem miniatura — o original continua sendo enviado, que é o que importa).
 */
export async function gerarMiniaturaWebp(
  arquivo: File,
  max = 800,
  qualidade = 0.82,
): Promise<Blob | null> {
  try {
    if (arquivo.type.startsWith("video/")) {
      return await capturarFrame(arquivo, max, qualidade);
    }

    if (arquivo.type.startsWith("audio/")) return null;

    let fonte: Blob = arquivo;

    if (ehHeic(arquivo)) {
      // heic2any é pesado: só é baixado quando realmente aparece um HEIC.
      const heic2any = (await import("heic2any")).default;
      const convertido = await heic2any({
        blob: arquivo,
        toType: "image/jpeg",
        quality: 0.9,
      });
      fonte = Array.isArray(convertido) ? convertido[0] : convertido;
    }

    const bitmap = await createImageBitmap(fonte);
    const blob = await desenharEmCanvas(
      bitmap,
      bitmap.width,
      bitmap.height,
      max,
      qualidade,
    );
    bitmap.close?.();
    return blob;
  } catch {
    return null;
  }
}
