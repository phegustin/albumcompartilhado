/**
 * Storage adapter com 3 drivers.
 *
 *   local    -> grava em public/uploads/ (dev, sem nenhuma credencial)
 *   supabase -> Supabase Storage, bucket "event-memories" (padrão em produção)
 *   r2       -> Cloudflare R2 (usado automaticamente se as 4 variáveis R2_* existirem)
 *
 * Em todos os casos o arquivo vai DIRETO do navegador para o storage — nunca
 * passa pelo corpo da função serverless. Isso é o que permite vídeo .MOV
 * grande e foto .HEIC de iPhone sem estourar limite de servidor.
 */
import { randomUUID } from "node:crypto";

export type StorageDriver = "local" | "supabase" | "r2";

export type StorageKind = "original" | "thumb";

export type SignedUpload = {
  driver: StorageDriver;
  /** URL para onde o navegador envia o arquivo (PUT). */
  uploadUrl: string;
  /** URL pública permanente, depois de enviado. */
  publicUrl: string;
  /** Caminho/chave interna no bucket. */
  path: string;
  /** Headers obrigatórios no upload. */
  headers: Record<string, string>;
};

const BUCKET = process.env.STORAGE_BUCKET ?? "event-memories";

/* -------------------------------------------------------------------------- */
/* Descobre qual driver usar                                                  */
/* -------------------------------------------------------------------------- */

export function getDriver(): StorageDriver {
  const forced = process.env.STORAGE_DRIVER as StorageDriver | undefined;
  if (forced === "local" || forced === "supabase" || forced === "r2") return forced;

  const temR2 = Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_PUBLIC_URL,
  );
  if (temR2) return "r2";

  const temSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (temSupabase) return "supabase";

  return "local";
}

/* -------------------------------------------------------------------------- */
/* Montagem do caminho                                                        */
/* -------------------------------------------------------------------------- */

/** Extensão segura (minúscula, só caracteres permitidos). */
function sanitizeExt(ext: string): string {
  const limpo = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  return limpo.slice(0, 5) || "bin";
}

/** Slug seguro para caminho de arquivo. */
function sanitizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9-_]/g, "") || "evento";
}

export function buildPath(albumSlug: string, kind: StorageKind, ext: string): string {
  return `events/${sanitizeSlug(albumSlug)}/${kind}s/${randomUUID()}.${sanitizeExt(ext)}`;
}

/* -------------------------------------------------------------------------- */
/* API principal                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Gera a URL assinada para o navegador enviar o arquivo.
 * Chamada por POST /api/gallery/presign.
 */
export async function createSignedUpload(opts: {
  albumSlug: string;
  kind: StorageKind;
  ext: string;
  contentType: string;
}): Promise<SignedUpload> {
  const driver = getDriver();
  const path = buildPath(opts.albumSlug, opts.kind, opts.ext);

  if (driver === "r2") return criarUploadR2(path, opts.contentType);
  if (driver === "supabase") return criarUploadSupabase(path, opts.contentType);

  // local: o arquivo é recebido por uma rota nossa e servido por /api/media/
  return {
    driver: "local",
    path,
    uploadUrl: `/api/upload/local?path=${encodeURIComponent(path)}`,
    publicUrl: `/api/media/${path}`,
    headers: { "content-type": opts.contentType },
  };
}

/** Remove um arquivo (usado quando o anfitrião exclui uma mídia). */
export async function removeObject(path: string): Promise<void> {
  const driver = getDriver();
  if (driver === "supabase") {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await supabase.storage.from(BUCKET).remove([path]);
  }
  // No driver local e no R2 o arquivo órfão não atrapalha; a exclusão em si
  // é registrada no banco. Implementar remoção física se/quando precisar.
}

/* -------------------------------------------------------------------------- */
/* Drivers                                                                    */
/* -------------------------------------------------------------------------- */

async function criarUploadSupabase(
  path: string,
  contentType: string,
): Promise<SignedUpload> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Falha ao assinar upload no Supabase: ${error?.message}`);
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    driver: "supabase",
    path,
    uploadUrl: data.signedUrl,
    publicUrl: publicData.publicUrl,
    headers: { "content-type": contentType },
  };
}

async function criarUploadR2(path: string, contentType: string): Promise<SignedUpload> {
  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const accountId = process.env.R2_ACCOUNT_ID!;
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET ?? BUCKET,
    Key: path,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

  return {
    driver: "r2",
    path,
    uploadUrl,
    publicUrl: `${base}/${path}`,
    headers: { "content-type": contentType },
  };
}
