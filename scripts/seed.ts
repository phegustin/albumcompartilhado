/**
 * Popula o banco com o evento de demonstração "Helena & Gabriel".
 *
 *   npm run db:seed
 *
 * O script é IDEMPOTENTE: pode rodar quantas vezes quiser, ele sempre
 * recria o álbum de demo do zero (apaga só o que é dele).
 *
 * As imagens originais ficam em seed-assets/ (fora do Git). O envio passa
 * pelo mesmo adapter de storage do app:
 *   - driver local    -> copia para public/uploads/ e serve por /api/media/
 *   - driver supabase -> envia para o bucket e usa a URL pública
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env" });

import { albums, mediaItems, mediaLikes, mediaComments } from "../src/db/schema";
import { eq } from "drizzle-orm";

/*
 * O `db` é carregado DENTRO do main() de propósito.
 * Motivo: imports estáticos são "hoisted" (sobem pro topo do arquivo), então
 * rodariam ANTES do dotenv carregar o .env — e o drizzle reclamaria que a
 * DATABASE_URL não existe. Importando depois, a variável já está pronta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

const SLUG = "helena-e-gabriel";
const ASSETS_DIR = join(process.cwd(), "seed-assets");

/* -------------------------------------------------------------------------- */
/* Envio das imagens (respeita o driver configurado)                          */
/* -------------------------------------------------------------------------- */

/** Gera uma miniatura WebP leve para o feed carregar rápido. */
async function gerarThumb(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buffer).resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

async function enviarArquivo(
  origem: Buffer,
  caminho: string,
  contentType: string,
): Promise<string> {
  const driver = process.env.STORAGE_DRIVER;

  if (driver === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const bucket = process.env.STORAGE_BUCKET ?? "event-memories";
    const { error } = await supabase.storage.from(bucket).upload(caminho, origem, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`Falha no upload: ${error.message}`);
    return supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl;
  }

  // driver local
  const destino = join(process.cwd(), "public", "uploads", caminho);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, origem);
  return `/api/media/${caminho}`;
}

/* -------------------------------------------------------------------------- */
/* Dados do evento de demonstração                                            */
/* -------------------------------------------------------------------------- */

type FotoDemo = {
  arquivo: string;
  categoria: "MAKING_OF" | "CERIMONIA" | "RECEPCAO" | "PISTA";
  autor: string;
  legenda: string;
  curtidas: number;
  minutosAtras: number;
};

const FOTOS: FotoDemo[] = [
  { arquivo: "04-cerimonia-entrada.jpg", categoria: "CERIMONIA", autor: "Tia Márcia", legenda: "Entrada mais linda de todas 😭", curtidas: 34, minutosAtras: 320 },
  { arquivo: "08-cerimonia-votos.jpg", categoria: "CERIMONIA", autor: "Primo Lucas", legenda: "Os votos… eu chorei junto", curtidas: 41, minutosAtras: 300 },
  { arquivo: "13-cerimonia-saida.jpg", categoria: "CERIMONIA", autor: "Dinda Ana", legenda: "Chuva de arroz e muita alegria!", curtidas: 27, minutosAtras: 285 },
  { arquivo: "01-cerimonia-aliancas.jpg", categoria: "CERIMONIA", autor: "Madrinha Carla", legenda: "As alianças brilhando mais que o sol", curtidas: 22, minutosAtras: 295 },
  { arquivo: "02-recepcao-brinde.jpg", categoria: "RECEPCAO", autor: "Turma da Faculdade", legenda: "Tim tim! Que seja eterno 🍾", curtidas: 38, minutosAtras: 200 },
  { arquivo: "09-recepcao-mesa.jpg", categoria: "RECEPCAO", autor: "Tia Márcia", legenda: "Cada detalhe impecável", curtidas: 19, minutosAtras: 210 },
  { arquivo: "06-recepcao-bolo.jpg", categoria: "RECEPCAO", autor: "Prima Júlia", legenda: "O bolo estava uma obra de arte", curtidas: 25, minutosAtras: 190 },
  { arquivo: "12-recepcao-familia.jpg", categoria: "RECEPCAO", autor: "Tio Roberto", legenda: "Duas famílias virando uma só", curtidas: 44, minutosAtras: 175 },
  { arquivo: "03-pista-danca.jpg", categoria: "PISTA", autor: "Primo Lucas", legenda: "ELES ARRASARAM NA PISTA 💃🕺", curtidas: 52, minutosAtras: 90 },
  { arquivo: "10-pista-convidados.jpg", categoria: "PISTA", autor: "Turma da Faculdade", legenda: "Ninguém ficou sentado, foi lindo", curtidas: 31, minutosAtras: 70 },
  { arquivo: "14-pista-criancas.jpg", categoria: "PISTA", autor: "Dinda Ana", legenda: "A garotada roubou a festa", curtidas: 47, minutosAtras: 55 },
  { arquivo: "05-making-of-noiva.jpg", categoria: "MAKING_OF", autor: "Madrinha Carla", legenda: "Os preparativos… que momento", curtidas: 29, minutosAtras: 420 },
  { arquivo: "07-making-of-noivo.jpg", categoria: "MAKING_OF", autor: "Tio Roberto", legenda: "Noivo mais tranquilo que já vi", curtidas: 16, minutosAtras: 410 },
  { arquivo: "11-making-of-detalhes.jpg", categoria: "MAKING_OF", autor: "Prima Júlia", legenda: "O buquê dos sonhos dela", curtidas: 21, minutosAtras: 400 },
];

const COMENTARIOS: Record<string, { autor: string; texto: string }[]> = {
  "03-pista-danca.jpg": [
    { autor: "Tia Márcia", texto: "QUE CASAL! ❤️" },
    { autor: "Primo Lucas", texto: "Essa entrou pra história" },
  ],
  "08-cerimonia-votos.jpg": [{ autor: "Dinda Ana", texto: "Chorei horrores 😭" }],
  "02-recepcao-brinde.jpg": [{ autor: "Turma da Faculdade", texto: "Saúde e felicidades!" }],
};

/* -------------------------------------------------------------------------- */
/* Execução                                                                   */
/* -------------------------------------------------------------------------- */

async function main() {
  // Carrega a conexão AGORA — depois do dotenv já ter lido o .env.
  const moduloDb = await import("../src/db/index");
  db = moduloDb.db;

  if (!existsSync(ASSETS_DIR)) {
    throw new Error(
      `Pasta ${ASSETS_DIR} não encontrada. As imagens do demo são geradas à parte e ficam fora do Git.`,
    );
  }

  console.log("→ limpando demo anterior (se existir)");
  // ON DELETE cascade cuida de mídias, curtidas e comentários.
  await db.delete(albums).where(eq(albums.slug, SLUG));

  console.log("→ criando o álbum Helena & Gabriel");
  const [album] = await db
    .insert(albums)
    .values({
      slug: SLUG,
      eventType: "WEDDING",
      title: "Helena & Gabriel",
      subtitle: "Casamento • 15 de Novembro",
      eventDate: new Date(),
      theme: "OLIVE_GOLD",
      capsuleMode: false,
      requireModeration: false,
      hostPin: "1234",
      moderatorPin: "4321",
      studioBrandName: "Estúdio Memórias",
      studioWhatsapp: "5593999999999",
    })
    .returning();

  const arquivosDisponiveis = await readdir(ASSETS_DIR);
  let enviadas = 0;

  for (const foto of FOTOS) {
    if (!arquivosDisponiveis.includes(foto.arquivo)) {
      console.log(`  ! pulando ${foto.arquivo} (ainda não gerada)`);
      continue;
    }

    const ext = extname(foto.arquivo).replace(".", "") || "jpg";
    const buffer = await readFile(join(ASSETS_DIR, foto.arquivo));

    const originalKey = `events/${SLUG}/originals/${randomUUID()}.${ext}`;
    const thumbKey = `events/${SLUG}/thumbs/${randomUUID()}.webp`;

    const originalUrl = await enviarArquivo(buffer, originalKey, `image/${ext}`);
    const thumbBuffer = await gerarThumb(buffer);
    const thumbUrl = await enviarArquivo(thumbBuffer, thumbKey, "image/webp");

    const criadoEm = new Date(Date.now() - foto.minutosAtras * 60_000);

    const [item] = await db
      .insert(mediaItems)
      .values({
        albumId: album.id,
        uploaderName: foto.autor,
        uploaderDeviceId: `demo-${foto.autor.toLowerCase().replace(/\s+/g, "-")}`,
        mediaType: "PHOTO",
        categoryTag: foto.categoria,
        originalPath: originalKey,
        originalUrl,
        thumbUrl,
        caption: foto.legenda,
        likesCount: foto.curtidas,
        status: "APPROVED",
        createdAt: criadoEm,
      })
      .returning();

    // Cria as curtidas reais (para o contador bater com os registros).
    const curtidas = Array.from({ length: Math.min(foto.curtidas, 12) }, (_, i) => ({
      mediaId: item.id,
      deviceId: `demo-device-${i}`,
    }));
    if (curtidas.length) await db.insert(mediaLikes).values(curtidas);

    const comentarios = COMENTARIOS[foto.arquivo] ?? [];
    if (comentarios.length) {
      await db.insert(mediaComments).values(
        comentarios.map((c) => ({
          mediaId: item.id,
          authorName: c.autor,
          text: c.texto,
          createdAt: criadoEm,
        })),
      );
    }

    enviadas++;
    console.log(`  ✓ ${foto.arquivo} (${foto.categoria}) — ${foto.autor}`);
  }

  // Capa do evento = a primeira foto enviada.
  const [capa] = await db
    .select({ thumbUrl: mediaItems.thumbUrl, originalUrl: mediaItems.originalUrl })
    .from(mediaItems)
    .where(eq(mediaItems.albumId, album.id))
    .limit(1);

  if (capa) {
    await db
      .update(albums)
      .set({ coverUrl: capa.thumbUrl ?? capa.originalUrl })
      .where(eq(albums.id, album.id));
  }

  console.log(`\n✓ Seed concluído: ${enviadas} mídias no álbum /e/${SLUG}`);
  console.log(`  PIN dos noivos: 1234  |  PIN da cerimonialista: 4321`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});
