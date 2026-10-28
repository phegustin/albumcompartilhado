/**
 * Serve os arquivos gravados pelo driver de storage "local".
 *
 * Existe porque o Next.js nem sempre percebe arquivos criados em public/
 * DEPOIS que o servidor subiu. Passando por uma rota, a leitura é sempre
 * direto do disco.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize } from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

function caminhoSeguro(path: string): string | null {
  if (!path.startsWith("events/")) return null;
  if (path.includes("..") || path.includes("\0")) return null;
  const normalizado = normalize(path);
  if (!normalizado.startsWith("events/")) return null;
  return join(process.cwd(), "public", "uploads", normalizado);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segmentos } = await params;
  const caminho = segmentos.join("/");

  const destino = caminhoSeguro(caminho);
  if (!destino) {
    return new Response("caminho inválido", { status: 400 });
  }

  try {
    const info = await stat(destino);
    if (!info.isFile()) return new Response("não encontrado", { status: 404 });

    const ext = destino.split(".").pop()?.toLowerCase() ?? "";
    const contentType = TIPOS[ext] ?? "application/octet-stream";

    const stream = Readable.toWeb(
      createReadStream(destino),
    ) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: {
        "content-type": contentType,
        "content-length": String(info.size),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("não encontrado", { status: 404 });
  }
}
