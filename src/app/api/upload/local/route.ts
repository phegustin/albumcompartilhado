/**
 * Recebe o arquivo do navegador quando o driver de storage é "local".
 *
 * ATENÇÃO: este endpoint só existe para desenvolvimento local. Ele grava em
 * public/uploads/, o que NÃO funciona na Vercel (filesystem efêmero e
 * somente-leitura) — por isso, em produção, o drizzle/Storage usa Supabase
 * Storage ou R2.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

export const runtime = "nodejs";

/** Só aceita caminhos dentro de events/ e bloqueia path traversal. */
function caminhoSeguro(path: string): string | null {
  if (!path.startsWith("events/")) return null;
  if (path.includes("..")) return null;
  if (path.includes("\0")) return null;

  const normalizado = normalize(path);
  if (!normalizado.startsWith("events/")) return null;

  return join(process.cwd(), "public", "uploads", normalizado);
}

export async function POST(request: Request) {
  if (process.env.STORAGE_DRIVER === "supabase" || process.env.STORAGE_DRIVER === "r2") {
    return Response.json({ error: "driver local desabilitado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return Response.json({ error: "path obrigatório" }, { status: 400 });
  }

  const destino = caminhoSeguro(path);
  if (!destino) {
    return Response.json({ error: "caminho inválido" }, { status: 400 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());

  // Limite de segurança no modo local: 200 MB por arquivo.
  if (bytes.byteLength > 200 * 1024 * 1024) {
    return Response.json({ error: "arquivo grande demais" }, { status: 413 });
  }

  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, bytes);

  return Response.json({ ok: true, path });
}
