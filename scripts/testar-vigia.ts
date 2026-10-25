/**
 * Teste das regras de sobrevivência do telão.
 *
 * Roda sem navegador e sem framework de teste: são funções puras, então um
 * script Node basta. Uso:
 *
 *   npx tsx scripts/testar-vigia.ts
 *
 * A intenção é responder, caso por caso, "o telão recarrega ou não?" — e
 * provar que ele NUNCA recarrega quando isso trocaria fotos por tela de erro.
 */
import {
  AUSENCIA_LONGA_MS,
  INTERVALO_VIGIA_MS,
  PRAZO_CONSULTA_MS,
  SILENCIO_SUSPEITO_MS,
  decidirAoVoltarOnline,
  decidirAoVoltarVisivel,
  decidirDepoisDaSondagem,
  decidirPorSilencio,
} from "../src/lib/vigia-telao";

let falhas = 0;
let total = 0;

function conferir(
  descricao: string,
  real: string,
  esperado: string,
) {
  total += 1;
  const ok = real === esperado;
  if (!ok) falhas += 1;
  console.log(`${ok ? "  ok  " : "FALHOU"}  ${descricao}`);
  if (!ok) console.log(`          esperado "${esperado}", veio "${real}"`);
}

function conferirNumero(descricao: string, real: number, esperado: number) {
  total += 1;
  const ok = real === esperado;
  if (!ok) falhas += 1;
  console.log(`${ok ? "  ok  " : "FALHOU"}  ${descricao}`);
  if (!ok) console.log(`          esperado ${esperado}, veio ${real}`);
}

function conferirSimNao(descricao: string, real: boolean) {
  total += 1;
  if (!real) falhas += 1;
  console.log(`${real ? "  ok  " : "FALHOU"}  ${descricao}`);
}

console.log("\n=== Constantes ===");
// Se o prazo da consulta for MAIOR que o intervalo, as consultas se empilham
// e o telão congela — o bug que tudo isso existe para impedir.
conferirSimNao(
  "prazo da consulta (6s) é MENOR que o intervalo entre consultas (8s)",
  PRAZO_CONSULTA_MS < 8000,
);
conferirNumero("prazo da consulta", PRAZO_CONSULTA_MS, 6000);
conferirNumero("vigia roda a cada 30s", INTERVALO_VIGIA_MS, 30_000);
conferirNumero("ausência longa = 2 min", AUSENCIA_LONGA_MS, 120_000);
conferirNumero("silêncio suspeito = 3 min", SILENCIO_SUSPEITO_MS, 180_000);

console.log("\n=== VIGIA 1: silêncio (a página travou?) ===");
conferir(
  "acabou de falar com o servidor (1s) -> não faz nada",
  decidirPorSilencio({ silencioMs: 1000, online: true }),
  "esperar",
);
conferir(
  "Wi-Fi oscilou (30s) -> não faz nada",
  decidirPorSilencio({ silencioMs: 30_000, online: true }),
  "esperar",
);
conferir(
  "silêncio de 2min55s, ainda abaixo do limite -> não faz nada",
  decidirPorSilencio({ silencioMs: 175_000, online: true }),
  "esperar",
);
conferir(
  "exatamente no limite -> sonda o servidor",
  decidirPorSilencio({ silencioMs: SILENCIO_SUSPEITO_MS, online: true }),
  "sondar",
);
conferir(
  "silêncio de 10 min com internet -> sonda o servidor",
  decidirPorSilencio({ silencioMs: 600_000, online: true }),
  "sondar",
);
conferir(
  "silêncio de 10 min SEM internet -> NÃO sonda e NÃO recarrega",
  decidirPorSilencio({ silencioMs: 600_000, online: false }),
  "esperar",
);

console.log("\n=== VIGIA 1 (b): o que fazer com o resultado da sondagem ===");
conferir(
  "sondagem respondeu -> a página é que travou, recarrega",
  decidirDepoisDaSondagem(true),
  "recarregar",
);
conferir(
  "sondagem não respondeu -> rede/servidor fora, segue com fotos antigas",
  decidirDepoisDaSondagem(false),
  "continuar-tentando",
);

console.log("\n=== VIGIA 2: a tela apagou / o notebook dormiu? ===");
conferir(
  "trocou de janela e voltou em 5s -> só sincroniza",
  decidirAoVoltarVisivel(5_000),
  "sincronizar",
);
conferir(
  "voltou em 1min59s -> só sincroniza",
  decidirAoVoltarVisivel(119_000),
  "sincronizar",
);
conferir(
  "tela apagada por 3 min -> recarrega (timers congelaram)",
  decidirAoVoltarVisivel(180_000),
  "recarregar",
);
conferir(
  "notebook dormiu a noite toda -> recarrega",
  decidirAoVoltarVisivel(8 * 3600_000),
  "recarregar",
);

console.log("\n=== VIGIA 3: a internet caiu e voltou? ===");
conferir(
  "caiu e voltou em 3s -> sincroniza na hora",
  decidirAoVoltarOnline(3_000),
  "sincronizar",
);
conferir(
  "caiu por 1 min -> sincroniza na hora",
  decidirAoVoltarOnline(60_000),
  "sincronizar",
);
conferir(
  "caiu por 10 min -> recarrega (estado limpo garantido)",
  decidirAoVoltarOnline(600_000),
  "recarregar",
);

console.log(
  `\n${falhas === 0 ? "✅" : "❌"} ${total - falhas}/${total} conferências passaram` +
    (falhas ? ` — ${falhas} FALHARAM` : ""),
);
process.exit(falhas === 0 ? 0 : 1);
