/**
 * Gerencia o Postgres LOCAL de desenvolvimento (embedded-postgres).
 *
 * Comandos:
 *   node scripts/pg.mjs init    -> cria o cluster + o banco e desliga (roda 1x)
 *   node scripts/pg.mjs start   -> sobe o cluster e fica vivo (usar em background)
 *   node scripts/pg.mjs stop    -> desliga o cluster (os dados continuam salvos)
 *
 * Os dados ficam em .pgdata/ (ignorado pelo Git) e NAO sao apagados ao parar,
 * porque a opcao `persistent` vem ligada por padrao.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.resolve(process.cwd(), ".pgdata");
const PORT = Number(process.env.LOCAL_PGPORT ?? 5432);
const USER = process.env.LOCAL_PGUSER ?? "postgres";
const PASSWORD = process.env.LOCAL_PGPASSWORD ?? "postgres";
const DB = process.env.LOCAL_PGDATABASE ?? "albumcompartilhado";

const command = process.argv[2] ?? "start";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  onLog: (msg) => console.log("[pg]", String(msg).trimEnd()),
  onError: (msg) => console.error("[pg:erro]", String(msg).trimEnd()),
});

/** O cluster ja foi inicializado se existe o arquivo PG_VERSION. */
function jaInicializado() {
  return fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
}

async function main() {
  if (command === "init") {
    if (!jaInicializado()) {
      console.log("[pg] inicializando cluster em", DATA_DIR);
      await pg.initialise();
    } else {
      console.log("[pg] cluster ja existe, aproveitando");
    }
    await pg.start();
    try {
      await pg.createDatabase(DB);
      console.log(`[pg] banco "${DB}" criado`);
    } catch {
      console.log(`[pg] banco "${DB}" ja existia`);
    }
    await pg.stop();
    console.log("[pg] init concluido");
    return;
  }

  if (command === "start") {
    if (!jaInicializado()) {
      console.log("[pg] cluster nao encontrado, inicializando...");
      await pg.initialise();
    }
    await pg.start();
    console.log(`[pg] rodando em localhost:${PORT} (banco: ${DB})`);
    // Mantem o processo vivo: o cluster eh desligado quando o script termina.
    const encerrar = async () => {
      console.log("[pg] encerrando...");
      await pg.stop();
      process.exit(0);
    };
    process.on("SIGTERM", encerrar);
    process.on("SIGINT", encerrar);
    setInterval(() => {}, 1 << 30);
    return;
  }

  if (command === "stop") {
    await pg.stop();
    console.log("[pg] parado (dados preservados em .pgdata/)");
    return;
  }

  console.error(`[pg] comando desconhecido: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[pg] falhou:", err);
  process.exit(1);
});
