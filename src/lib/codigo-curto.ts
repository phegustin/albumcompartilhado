import { eq } from "drizzle-orm";

import { db } from "@/db";
import { albums } from "@/db/schema";

/**
 * Letras e números usados no código curto.
 *
 * De propósito NÃO tem:
 *   0 e O   (se confundem)
 *   1, I e L (idem)
 *
 * O código vai ser lido de uma plaquinha impressa e digitado num controle
 * de TV, muitas vezes por alguém com pressa e meia luz. Cada caractere
 * ambíguo é uma chance de dar errado.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const TAMANHO = 6;

export function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO; i += 1) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return codigo;
}

/**
 * Gera um código curto que ainda não está em uso.
 *
 * Tenta algumas vezes antes de desistir. Por que não usar só o UNIQUE do
 * banco: uma colisão lá vira erro de banco, que na tela do usuário é o
 * botão "criar evento" falhando sem explicação — o mesmo bug que já
 * aconteceu com o slug. Aqui a colisão é resolvida em silêncio.
 */
export async function codigoCurtoUnico(): Promise<string> {
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const candidato = gerarCodigo();
    const existe = await db
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.shortCode, candidato))
      .limit(1);

    if (existe.length === 0) return candidato;
  }

  // 12 colisões seguidas é praticamente impossível com 31^6 combinações.
  // Se acontecer, ainda devolvemos algo válido em vez de quebrar.
  return gerarCodigo();
}

/*
 * De propósito NÃO existe aqui uma função para "formatar" o código com
 * espaço (tipo "93J W82").
 *
 * Parece bonito na plaquinha, mas cria uma armadilha: o roteador do Next
 * não casa um segmento de URL com espaço, então /t/93J W82 devolve 404 —
 * a pessoa digita exatamente o que está impresso e dá erro.
 *
 * Seis caracteres sem espaço já são fáceis de ler e digitar. Melhor
 * feio e funcionando do que bonito e quebrado.
 */
