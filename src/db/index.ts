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
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __albumPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para .env e preencha.",
    );
  }
  return new Pool({ connectionString });
}

const pool = globalForDb.__albumPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__albumPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
