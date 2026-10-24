import { NextResponse, type NextRequest } from "next/server";

/**
 * Esconde o endereço real do Super Admin.
 *
 * Quando a variável ADMIN_PATH existe (ex.: "painel-x7f2k9"), o painel passa
 * a responder só naquele endereço, e `/admin` devolve 404 — como se nunca
 * tivesse existido. Assim não existe uma porta visível para alguém ficar
 * tentando senha: quem não sabe o caminho não acha nem a fechadura.
 *
 * O endereço secreto chega aqui por reescrita (rewrite) configurada no
 * next.config.ts, que aponta /<ADMIN_PATH> -> /admin. Como a reescrita
 * acontece DEPOIS do middleware, este arquivo só precisa bloquear o acesso
 * direto a /admin.
 */
export function middleware(req: NextRequest) {
  const segredo = process.env.ADMIN_PATH?.trim();

  if (segredo && req.nextUrl.pathname === "/admin") {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

/**
 * Só intercepta /admin. Nada mais passa por aqui, para não adicionar latência
 * às rotas dos convidados (que são as que realmente precisam ser rápidas).
 */
export const config = {
  matcher: ["/admin"],
};
