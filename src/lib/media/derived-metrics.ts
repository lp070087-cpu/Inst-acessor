/**
 * MÉTRICAS DERIVADAS — núcleo puro
 * ================================
 * Este arquivo existe por causa de um defeito que apareceu em QUATRO lugares
 * diferentes do app, sempre da mesma forma:
 *
 *     interactions = (likeCount ?? 0) + (commentsCount ?? 0)
 *
 * A intenção era "somar curtidas e comentários somando só o que existe". O
 * resultado era outro: quando a Meta devolvia APENAS um dos dois números, a
 * ausência virava `0` e a soma saía PARCIAL — apresentada como total, sem
 * nenhum sinal de que estava incompleta. Ninguém na tela podia descobrir isso.
 *
 * O estrago não era só cosmético:
 *   • no card do Dashboard, um total parcial aparecia como "engajamento total";
 *   • no Calendário Inteligente, o dia da semana de uma publicação sem
 *     `comments_count` recebia interação MENOR que a real — e o ranking de
 *     "melhores dias" passava a ordenar dias por um artefato de dado faltante;
 *   • em "melhores formatos", o mesmo podia INVERTER a recomendação: o formato
 *     mais completo perdia para o que tinha menos métricas faltando.
 *
 * O modal de insights (`publishing/media-insights.ts`) já fazia certo. Os outros
 * quatro discordavam dele — e a MESMA publicação mostrava números diferentes
 * dependendo de onde o usuário olhasse.
 *
 * REGRA ÚNICA, agora num só lugar:
 *   Um derivado de dois termos só existe quando OS DOIS termos existem.
 *   Faltando um, o derivado é `null` — ausência, nunca um número incompleto.
 *
 * Ausência se propaga; ausência não vira zero. Zero é um VALOR ("nenhuma
 * curtida"), e é diferente de "a Meta não informou". Tratar os dois como iguais
 * é exatamente o que apaga a diferença entre medido e não medido.
 *
 * Nota sobre listas: quando um termo falta em ALGUMAS publicações da amostra, a
 * agregação descarta essas publicações em vez de somá-las com zero. A amostra
 * fica menor de propósito — quem lê `null` quando a amostra é insuficiente está
 * sendo honesto; quem inventa zero está mentindo com aparência de precisão.
 */

/**
 * Soma um derivado de dois termos, exigindo AMBOS.
 *
 * - dois números  → a soma;
 * - qualquer nulo → `null` (ausência, não soma parcial).
 *
 * Aceita `undefined` porque os campos da Meta chegam assim quando ausentes.
 */
export function sumIfBothPresent(
  a: number | null | undefined,
  b: number | null | undefined
): number | null {
  return a != null && b != null ? a + b : null;
}

/**
 * Interação medida de uma publicação: curtidas + comentários.
 * É o derivado central do produto (aparece no Dashboard, no Calendário
 * Inteligente e nos insights), por isso tem nome próprio.
 */
export function mediaInteractions(
  likeCount: number | null | undefined,
  commentsCount: number | null | undefined
): number | null {
  return sumIfBothPresent(likeCount, commentsCount);
}

/**
 * Soma uma lista de valores que PODEM ser nulos, descartando as ausências.
 *
 * Atenção — este helper é para grandezas INDEPENDENTES (ex.: "alcance de cada
 * mídia": o alcance de uma mídia não depende do alcance de outra). Ele NÃO deve
 * ser usado para derivados como `mediaInteractions`, onde cada item já precisa
 * ter vindo completo da função acima.
 *
 * Devolve `null` quando não há nenhum valor real — nunca `0`. Uma soma vazia não
 * é "zero", é "não há o que somar".
 */
export function sumPresent(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => v != null);
  return real.length > 0 ? real.reduce((a, b) => a + b, 0) : null;
}

/**
 * Média de uma lista que pode conter ausências. `null` quando não há nenhum
 * valor real. Arredonda para inteiro (as métricas do produto são inteiras).
 */
export function averagePresent(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => v != null);
  if (real.length === 0) return null;
  return Math.round(real.reduce((a, b) => a + b, 0) / real.length);
}
