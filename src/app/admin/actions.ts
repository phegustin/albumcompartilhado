"use server";

/**
 * Ações do Super Admin.
 *
 * O acesso é por senha única (ADMIN_PASSWORD no .env) guardada num cookie
 * httpOnly com token ASSINADO — ver src/lib/admin-auth.ts.
 *
 * Toda falha agora volta para a tela como `?erro=...`. Antes o erro explodia
 * dentro do server action e o botão simplesmente "não fazia nada", sem dar
 * nenhuma pista de what aconteceu.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { albums } from "@/db/schema";
import {
  COOKIE_ADMIN,
  estaBloqueado,
  gerarToken,
  limparTentativas,
  registrarFalha,
  senhaCorreta,
} from "@/lib/admin-auth";

/** Transforma "Festa da Ju" em "festa-da-ju". */
function slugificar(entrada: string): string {
  return entrada
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function gerarPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function ipDoCliente(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : (h.get("x-real-ip") ?? "local");
}

/**
 * Devolve um slug que não colide com nenhum existente.
 *
 * Resolve o caso mais comum de "cliquei e não criou": slug repetido — seja
 * por clique duplo, seja por reusar um nome que já existe (ex.: o evento
 * de demonstração). Em vez de quebrar, vira "nome-2", "nome-3"...
 */
async function slugUnico(base: string): Promise<string> {
  const existe = async (candidato: string) => {
    const linhas = await db
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.slug, candidato))
      .limit(1);
    return linhas.length > 0;
  };

  if (!(await existe(base))) return base;

  for (let n = 2; n < 200; n += 1) {
    const candidato = `${base}-${n}`;
    if (!(await existe(candidato))) return candidato;
  }

  throw new Error(`Não foi possível gerar um endereço único a partir de "${base}"`);
}

/* -------------------------------------------------------------------------- */
/* Entrar / sair                                                               */
/* -------------------------------------------------------------------------- */

/** Confere a senha e, se bater, abre a sessão por 12 horas. */
export async function entrarAdmin(formData: FormData) {
  const senha = String(formData.get("senha") ?? "");
  const esperada = process.env.ADMIN_PASSWORD;

  if (!esperada) {
    redirect("/admin?erro=senha-nao-configurada");
  }

  const ip = await ipDoCliente();

  if (estaBloqueado(ip)) {
    redirect("/admin?erro=muitas-tentativas");
  }

  if (!senhaCorreta(senha)) {
    registrarFalha(ip);
    redirect("/admin?erro=senha-errada");
  }

  limparTentativas(ip);

  const token = gerarToken();
  if (!token) {
    redirect("/admin?erro=senha-nao-configurada");
  }

  const store = await cookies();
  store.set(COOKIE_ADMIN, token, {
    httpOnly: true, // JS do navegador não consegue ler nem escrever
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin?ok=1");
}

export async function sairAdmin() {
  const store = await cookies();
  store.delete(COOKIE_ADMIN);
  redirect("/admin");
}

/* -------------------------------------------------------------------------- */
/* Editar / excluir evento                                                     */
/* -------------------------------------------------------------------------- */

/** Salva as alterações de um evento já existente. */
export async function editarAlbum(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();

  if (!id || !titulo) {
    redirect("/admin?erro=dados-invalidos");
  }

  const tipoEvento = String(formData.get("eventType") ?? "WEDDING");
  const tema = String(formData.get("theme") ?? "OLIVE_GOLD");

  try {
    const alterados = await db
      .update(albums)
      .set({
        title: titulo,
        subtitle: String(formData.get("subtitle") ?? "").trim() || null,
        eventType: tipoEvento as
          | "WEDDING"
          | "SWEET_15"
          | "GRADUATION"
          | "BIRTHDAY"
          | "CORPORATE"
          | "OTHER",
        theme: tema as
          | "OLIVE_GOLD"
          | "CLASSIC_NOIR"
          | "TERRACOTTA"
          | "ROSE_QUARTZ"
          | "MIDNIGHT_PARTY",
        studioBrandName: String(formData.get("studioBrandName") ?? "").trim() || null,
        studioWhatsapp: String(formData.get("studioWhatsapp") ?? "").trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(albums.id, id))
      .returning({ id: albums.id });

    // id que nao existe nao e erro de servidor: e alguem mexendo em evento
    // que ja foi apagado.
    if (alterados.length === 0) {
      redirect("/admin?erro=evento-nao-encontrado");
    }
  } catch (e) {
    console.error("[admin] falha ao editar evento:", e);
    redirect("/admin?erro=erro-ao-editar");
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin?editado=1");
}

/**
 * Apaga um evento e tudo que pertence a ele.
 *
 * O banco já faz o serviço sujo: as foreign keys de media_items,
 * media_likes e media_comments são `onDelete: cascade`, então as mídias,
 * curtidas e comentários vão junto automaticamente.
 */
export async function excluirAlbum(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirect("/admin?erro=dados-invalidos");
  }

  try {
    const [apagado] = await db
      .delete(albums)
      .where(eq(albums.id, id))
      .returning({ slug: albums.slug });

    if (!apagado) {
      redirect("/admin?erro=evento-nao-encontrado");
    }

    revalidatePath("/admin");
    revalidatePath("/");
    redirect(`/admin?excluido=${encodeURIComponent(apagado.slug)}`);
  } catch (e) {
    console.error("[admin] falha ao excluir evento:", e);
    redirect("/admin?erro=erro-ao-excluir");
  }
}

/* -------------------------------------------------------------------------- */
/* Criar evento                                                                */
/* -------------------------------------------------------------------------- */

/** Cria um evento novo em ~30 segundos, como pede o .md. */
export async function criarAlbum(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const slugBase = slugificar(String(formData.get("slug") ?? ""));

  if (!titulo || !slugBase) {
    redirect("/admin?erro=dados-invalidos");
  }

  const tipoEvento = String(formData.get("eventType") ?? "WEDDING");
  const tema = String(formData.get("theme") ?? "OLIVE_GOLD");

  let slug: string;
  try {
    slug = await slugUnico(slugBase);

    await db.insert(albums).values({
      slug,
      eventType: tipoEvento as
        | "WEDDING"
        | "SWEET_15"
        | "GRADUATION"
        | "BIRTHDAY"
        | "CORPORATE"
        | "OTHER",
      title: titulo,
      subtitle: String(formData.get("subtitle") ?? "").trim() || null,
      theme: tema as
        | "OLIVE_GOLD"
        | "CLASSIC_NOIR"
        | "TERRACOTTA"
        | "ROSE_QUARTZ"
        | "MIDNIGHT_PARTY",
      hostPin: gerarPin(),
      moderatorPin: gerarPin(),
      studioBrandName: String(formData.get("studioBrandName") ?? "").trim() || null,
      studioWhatsapp: String(formData.get("studioWhatsapp") ?? "").trim() || null,
    });
  } catch (e) {
    // Antes isso morria calado e o botão parecia não funcionar.
    console.error("[admin] falha ao criar evento:", e);
    redirect("/admin?erro=erro-ao-criar");
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin?criado=${encodeURIComponent(slug)}`);
}
