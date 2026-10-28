/**
 * Conexão com o Postgres.
 *
 * Em desenvolvimento aponta para o Postgres local (embedded-postgres,
 * scripts/pg.mjs). Em produção aponta para o Postgres do Supabase — a troca
 * acontece só pela variável DATABASE_URL, sem mudar uma linha de código.
 *
 * O Pool é guardado no globalThis para não abrir uma conexão nova a cada
 * recarregamento do hot-reload do Next.js.
 */
import { setDefaultResultOrder } from "node:dns";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Prefere IPv4 ao resolver o host do banco.
 *
 * ATENÇÃO: isso não resolve host que só tem IPv6. O host direto da Supabase
 * (db.<ref>.supabase.co) não tem registro A — só AAAA — e a rede da Vercel
 * não alcança IPv6, então a conexão morria com ENETUNREACH. A solução foi
 * usar o pooler (aws-0-<regiao>.pooler.supabase.com), que tem IPv4.
 *
 * Este trecho fica como rede de segurança: se alguém apontar DATABASE_URL
 * para um host com os dois endereços, preferimos o IPv4.
 */
try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* ambientes sem essa API seguem com a ordem padrão */
}

const globalForDb = globalThis as unknown as { __albumPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para .env e preencha.",
    );
  }

  /*
   * SSL: o Postgres local (desenvolvimento) não usa TLS; a Supabase exige.
   * Sem isso, em produção a conexão é recusada.
   */
  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    /* connection string fora do padrão — cai no comportamento com SSL */
  }
  const isLocal = host === "localhost" || host === "127.0.0.1";

  /*
   * max: na Vercel cada lambda abre seu próprio pool. Deixar o padrão (10)
   * estouraria o limite de conexões do plano da Supabase com poucas pessoas
   * usando. Em produção limitamos a 3 por lambda.
   */
  const isProduction = process.env.NODE_ENV === "production";

  return new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: isProduction ? 3 : 10,
  });
}

const pool = globalForDb.__albumPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__albumPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
