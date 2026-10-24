/**
 * Remonta o ambiente de desenvolvimento do zero.
 *
 *   node scripts/dev-repair.mjs
 *
 * Serve para quando o workspace é resetado e somem:
 *   - o .env          (arquivo com gitignore não sobrevive entre sessões)
 *   - o .pgdata/      (idem)
 *   - o node_modules/ (idem)
 *
 * O que este script faz, nesta ordem:
 *   1) recria o .env com as credenciais locais
 *   2) inicializa o cluster Postgres se ele não existir
 *   3) sobe o Postgres em background (se já não estiver de pé)
 *   4) aplica as migrations
 *   5) roda o seed
 *   6) deixa o Postgres rodando e encerra
 *
 * Nada aqui é destrutivo: se algo já existir, ele aproveita em vez de apagar.
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import net from "node:net";

const RAIZ = process.cwd();

const ENV_LOCAL = `# Banco LOCAL de desenvolvimento (Postgres embedded). Nunca commitar.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/albumcompartilhado?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/albumcompartilhado?schema=public"
`;

const PG = {
  host: "127.0.0.1",
  port: 5432,
};

/** Roda um comando e espera terminar. */
function executar(comando, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const filho = spawn(comando, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...opts,
    });
    filho.on("exit", (codigo) => {
      if (codigo === 0) resolvePromise();
      else reject(new Error(`${comando} ${args.join(" ")} saiu com código ${codigo}`));
    });
    filho.on("error", reject);
  });
}

/** Tenta abrir um socket TCP; usado para saber se o Postgres já subiu. */
function portaAberta(host, port, tentativas = 40, esperaMs = 500) {
  return new Promise((resolvePromise) => {
    let restantes = tentativas;

    const tentar = () => {
      const socket = net.connect({ host, port });
      socket.setTimeout(800);

      socket.on("connect", () => {
        socket.destroy();
        resolvePromise(true);
      });

      const desistir = () => {
        socket.destroy();
        if (--restantes <= 0) resolvePromise(false);
        else setTimeout(tentar, esperaMs);
      };

      socket.on("error", desistir);
      socket.on("timeout", desistir);
    };

    tentar();
  });
}

async function main() {
  console.log("\n[1/5] Verificando .env...");
  if (existsSync(resolve(RAIZ, ".env"))) {
    console.log("      já existe, aproveitando");
  } else {
    writeFileSync(resolve(RAIZ, ".env"), ENV_LOCAL);
    console.log("      criado com as credenciais locais");
  }

  console.log("\n[2/5] Verificando dependências...");
  if (!existsSync(resolve(RAIZ, "node_modules"))) {
    console.log("      node_modules sumiu -> rodando npm install");
    await executar("npm", ["install"], { cwd: RAIZ });
  } else {
    console.log("      node_modules presente");
  }

  console.log("\n[3/5] Verificando o cluster Postgres...");
  if (!existsSync(resolve(RAIZ, ".pgdata"))) {
    console.log("      inicializando (pode levar alguns segundos)...");
    await executar("node", ["scripts/pg.mjs", "init"], { cwd: RAIZ });
  } else {
    console.log("      .pgdata presente");
  }

  console.log("\n[4/5] Subindo o Postgres...");
  if (await portaAberta(PG.host, PG.port, 1, 0)) {
    console.log("      já está rodando");
  } else {
    // detached: o Postgres continua vivo depois que este script encerrar.
    const filho = spawn("node", ["scripts/pg.mjs", "start"], {
      cwd: RAIZ,
      detached: true,
      stdio: "ignore",
    });
    filho.unref();

    const subiu = await portaAberta(PG.host, PG.port);
    if (!subiu) throw new Error("Postgres não subiu");
    console.log("      rodando em localhost:5432");
  }

  console.log("\n[5/5] Migrations e seed...");
  await executar("npx", ["drizzle-kit", "migrate"], { cwd: RAIZ });
  await executar("npx", ["tsx", "scripts/seed.ts"], { cwd: RAIZ });

  console.log("\n✅ Ambiente pronto.");
  console.log("   Agora suba o app com:  npm run dev\n");
}

main().catch((erro) => {
  console.error("\n❌ Falhou:", erro.message, "\n");
  process.exit(1);
});
