"use server";

/**
 * Ações do Super Admin (/admin).
 *
 * O acesso é por senha única (ADMIN_PASSWORD no .env) guardada num cookie
 * httpOnly. Não é login de usuário: é só a tranca do painel comercial.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { albums } from "@/db/schema";

const COOKIE = "ac:admin";

function gerarPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Confere a senha e, se bater, libera o cookie por 12 horas. */
export async function entrarAdmin(formData: FormData) {
  const senha = String(formData.get("senha") ?? "");
  const esperada = process.env.ADMIN_PASSWORD;

  if (!esperada) {
    redirect("/admin?erro=senha-nao-configurada");
  }

  if (senha !== esperada) {
    redirect("/admin?erro=senha-errada");
  }

  const store = await cookies();
  store.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin");
}

export async function sairAdmin() {
  const store = await cookies();
  store.delete(COOKIE);
  redirect("/admin");
}

/** Cria um evento novo em ~30 segundos, como pede o .md. */
export async function criarAlbum(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!titulo || !slug) redirect("/admin?erro=dados-invalidos");

  const tipoEvento = String(formData.get("eventType") ?? "WEDDING");
  const tema = String(formData.get("theme") ?? "OLIVE_GOLD");

  await db.insert(albums).values({
    slug,
    eventType: tipoEvento as "WEDDING" | "SWEET_15" | "GRADUATION" | "BIRTHDAY" | "CORPORATE" | "OTHER",
    title: titulo,
    subtitle: String(formData.get("subtitle") ?? "") || null,
    theme: tema as "OLIVE_GOLD" | "CLASSIC_NOIR" | "TERRACOTTA" | "ROSE_QUARTZ" | "MIDNIGHT_PARTY",
    hostPin: gerarPin(),
    moderatorPin: gerarPin(),
    studioBrandName: String(formData.get("studioBrandName") ?? "") || null,
    studioWhatsapp: String(formData.get("studioWhatsapp") ?? "") || null,
  });

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin?criado=" + slug);
}
