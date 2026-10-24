import { headers } from "next/headers";

/**
 * Descobre o endereço público que a pessoa está usando AGORA.
 *
 * Por que isso existe: o QR Code precisa apontar para uma URL que o celular
 * do convidado consiga abrir. Se a gente fixar "http://localhost:3000", o
 * QR aponta para o próprio celular de quem escaneia — e dá "não é possível
 * acessar esse site".
 *
 * Ordem de preferência:
 *   1) NEXT_PUBLIC_SITE_URL  — domínio próprio configurado (produção)
 *   2) cabeçalhos da requisição — funciona em qualquer ambiente
 *   3) localhost — último recurso, desenvolvimento puro
 */
export async function getBaseUrl(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurado) return configurado.replace(/\/$/, "");

  const h = await headers();

  // Em proxies (Vercel, E2B, Cloudflare) o host real vem em x-forwarded-host.
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) return "http://localhost:3000";

  // Endereços locais são http; qualquer domínio público é https.
  const ehLocal = /^(localhost|127\.|192\.|10\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\])/.test(
    host.split(":")[0],
  );
  const proto = h.get("x-forwarded-proto") ?? (ehLocal ? "http" : "https");

  return `${proto}://${host}`;
}
