/**
 * As REGRAS de sobrevivência do telão, separadas da tela.
 *
 * Por que este arquivo existe: um telão de festa roda 5-6 horas sozinho, num
 * notebook que ninguém toca, com o Wi-Fi do salão. Nesse tempo três coisas
 * dão errado — e cada uma tem uma resposta diferente:
 *
 *   1) A página trava (laço de consulta morre, conexão fica meio-aberta).
 *      Resposta: recarregar — MAS só se a internet estiver funcionando,
 *      senão a recarga troca as fotos por uma tela de erro do navegador.
 *
 *   2) A tela apaga / o notebook dorme. O navegador congela os timers, e ao
 *      voltar o telão parece vivo mas está parado há horas.
 *      Resposta: recarregar ao voltar.
 *
 *   3) O Wi-Fi cai e volta. O telão engole o erro e continua mostrando as
 *      fotos antigas, que é o certo — mas demora até 8s para perceber a volta.
 *      Resposta: consultar na hora.
 *
 * A decisão de QUANDO recarregar é delicada: recarregar na hora errada troca
 * "fotos antigas" por "sem fotos", que é pior. Por isso ela mora aqui, em
 * funções puras, longe do React — dá para testar cada caso com um comando.
 * O componente fica só com a ligação (ouvir evento, chamar função, agir).
 */

/** Prazo máximo para UMA consulta ao servidor. */
export const PRAZO_CONSULTA_MS = 6000;

/**
 * Silêncio longo o bastante para desconfiar que a página travou.
 *
 * Com consulta de 8s, 3 minutos são ~22 tentativas seguidas fracassadas.
 * Não é oscilação de Wi-Fi: é a página que parou de perguntar.
 */
export const SILENCIO_SUSPEITO_MS = 180_000;

/** De quanto em quanto tempo o vigia olha o relógio. */
export const INTERVALO_VIGIA_MS = 30_000;

/**
 * A partir daqui, uma ausência já conta como algo sério (tela apagada,
 * notebook dormindo, internet fora). 2 minutos: trocar de janela rapidinho
 * não recarrega nada.
 */
export const AUSENCIA_LONGA_MS = 120_000;

/**
 * O que fazer quando o servidor está em silêncio há muito tempo.
 *
 * - `sondar`: vale a pena tentar falar com o servidor agora. O resultado
 *   dessa sondagem decide entre recarregar e esperar.
 * - `esperar`: nem vale tentar. Ou o silêncio é curto demais para significar
 *   algo, ou o navegador já sabe que está offline — e aí recarregar daria
 *   tela de erro na certa.
 */
export type DecisaoSilencio = "sondar" | "esperar";

export function decidirPorSilencio({
  silencioMs,
  online,
  limiteMs = SILENCIO_SUSPEITO_MS,
}: {
  silencioMs: number;
  online: boolean;
  limiteMs?: number;
}): DecisaoSilencio {
  // Offline declarado: recarregar não traria fotos, traria o dinossauro.
  if (!online) return "esperar";
  if (silencioMs < limiteMs) return "esperar";
  return "sondar";
}

/**
 * Depois da sondagem: a internet respondeu?
 *
 * Se respondeu, o problema era a PÁGINA (o laço de consulta morreu) — e
 * recarregar resolve. Se não respondeu, o problema é a REDE/SERVIDOR, e
 * recarregar só pioraria: é melhor seguir com as fotos antigas.
 */
export type DepoisDaSondagem = "recarregar" | "continuar-tentando";

export function decidirDepoisDaSondagem(respondeu: boolean): DepoisDaSondagem {
  return respondeu ? "recarregar" : "continuar-tentando";
}

/** O que fazer quando a aba/tela volta a ficar visível. */
export type DecisaoAoVoltar = "recarregar" | "sincronizar";

export function decidirAoVoltarVisivel(
  sumiuPorMs: number,
  limiteMs = AUSENCIA_LONGA_MS,
): DecisaoAoVoltar {
  // Ausência longa = timers provavelmente congelados. Só a recarga garante
  // que o telão voltou a correr de verdade.
  if (sumiuPorMs > limiteMs) return "recarregar";
  return "sincronizar";
}

/** O que fazer quando o navegador avisa que a internet voltou. */
export function decidirAoVoltarOnline(
  foraPorMs: number,
  limiteMs = AUSENCIA_LONGA_MS,
): DecisaoAoVoltar {
  // A conexão acabou de provar que funciona, então recarregar é seguro e
  // devolve estado limpo depois de uma queda longa.
  if (foraPorMs > limiteMs) return "recarregar";
  return "sincronizar";
}
