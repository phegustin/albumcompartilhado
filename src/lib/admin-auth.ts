/**
 * Autenticação do Super Admin (/admin).
 *
 * ANTES: o cookie valia literalmente "1". Qualquer pessoa podia forjar
 * `Cookie: ac:admin=1` e entrar sem saber a senha. Isso era uma porta
 * aberta: dava acesso aos PINs dos noivos e aos links de todos os eventos.
 *
 * AGORA: o cookie carrega um token ASSINADO com a própria ADMIN_PASSWORD
 * (HMAC-SHA256). Sem a senha não existe como fabricar um token válido —
 * e ele expira sozinho em 12 horas.
 *
 * Também tem um limitador de tentativas: depois de 5 senhas erradas do
 * mesmo IP, bloqueia por 15 minutos. Em serverless isso é "best effort"
 * (cada instância tem sua memória), mas já desencoraja força bruta.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_ADMIN = "ac:admin";

const SESSAO_MS = 12 * 60 * 60 * 1000; // 12 horas
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000; // 15 minutos

/* -------------------------------------------------------------------------- */
/* Token                                                                       */
/* -------------------------------------------------------------------------- */

/** Pega a senha mestra. Se não estiver definida, nada funciona (e é assim mesmo). */
function segredo(): string | null {
  const senha = process.env.ADMIN_PASSWORD;
  return senha && senha.length > 0 ? senha : null;
}

function assinar(expiraEm: number, senha: string): string {
  return createHmac("sha256", senha).update(String(expiraEm)).digest("hex");
}

/** Compara sem vazar informação por tempo de resposta. */
function comparar(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Gera o token de sessão: `<expira>.<assinatura>`. */
export function gerarToken(): string | null {
  const senha = segredo();
  if (!senha) return null;

  const expiraEm = Date.now() + SESSAO_MS;
  return `${expiraEm}.${assinar(expiraEm, senha)}`;
}

/** Confere se o token é autêntico e ainda está no prazo. */
export function tokenValido(token: string | undefined): boolean {
  const senha = segredo();
  if (!senha || !token) return false;

  const [expiraStr, assinatura] = token.split(".");
  if (!expiraStr || !assinatura) return false;

  const expiraEm = Number(expiraStr);
  if (!Number.isFinite(expiraEm) || Date.now() > expiraEm) return false;

  return comparar(assinatura, assinar(expiraEm, senha));
}

/** Confere a senha digitada sem vazar tempo de resposta. */
export function senhaCorreta(senhaDigitada: string): boolean {
  const senha = segredo();
  if (!senha) return false;
  return comparar(senhaDigitada, senha);
}

/* -------------------------------------------------------------------------- */
/* Limite de tentativas                                                        */
/* -------------------------------------------------------------------------- */

type Registro = { falhas: number; bloqueadoAte: number };

const tentativas = new Map<string, Registro>();

export function estaBloqueado(ip: string): boolean {
  const r = tentativas.get(ip);
  if (!r) return false;
  if (Date.now() > r.bloqueadoAte && r.falhas >= MAX_TENTATIVAS) {
    // O bloqueio venceu: zera e libera.
    tentativas.delete(ip);
    return false;
  }
  return r.falhas >= MAX_TENTATIVAS && Date.now() < r.bloqueadoAte;
}

export function registrarFalha(ip: string): void {
  const r = tentativas.get(ip) ?? { falhas: 0, bloqueadoAte: 0 };
  r.falhas += 1;
  if (r.falhas >= MAX_TENTATIVAS) {
    r.bloqueadoAte = Date.now() + BLOQUEIO_MS;
  }
  tentativas.set(ip, r);
}

export function limparTentativas(ip: string): void {
  tentativas.delete(ip);
}

/* -------------------------------------------------------------------------- */
/* Endereço secreto                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Caminho secreto do painel, definido em ADMIN_PATH.
 *
 * Quando existe, `/admin` passa a devolver 404 (finge que não existe) e o
 * painel só responde no endereço secreto. Quem não sabe o endereço não tem
 * nem onde tentar senha.
 */
export function caminhoSecreto(): string | null {
  const p = process.env.ADMIN_PATH?.trim();
  return p && p.length > 0 ? p.replace(/^\/+|\/+$/g, "") : null;
}

/**
 * Endereço REAL do Super Admin, pronto para usar em redirect() e links.
 *
 * Quando ADMIN_PATH está definido, o painel só responde em /<ADMIN_PATH> e o
 * middleware devolve 404 para /admin. Então qualquer redirect() que aponte
 * para "/admin" manda o usuário para uma página de erro — foi exatamente o
 * que aconteceu ao salvar a edição de um evento.
 *
 * Passe só o sufixo da querystring:
 *   urlAdmin()            -> "/painel-admin"  (ou "/admin" sem ADMIN_PATH)
 *   urlAdmin("?editado=1") -> "/painel-admin?editado=1"
 */
export function urlAdmin(sufixo = ""): string {
  const segredo = caminhoSecreto();
  const base = segredo ? `/${segredo}` : "/admin";
  return `${base}${sufixo}`;
}
