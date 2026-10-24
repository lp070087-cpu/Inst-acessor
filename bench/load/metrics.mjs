/**
 * CÁLCULO DE MÉTRICAS E CLASSIFICAÇÃO VERDE/AMARELO/VERMELHO
 * ==========================================================
 * Tudo aqui é PURO: recebe as amostras da execução e devolve números. Nada é
 * inventado — se uma métrica não pôde ser medida, ela sai como `null` e o
 * relatório a mostra como "n/a" em vez de preencher com valor falso.
 */

/**
 * Percentil por interpolação linear sobre a lista ORDENADA.
 * p em [0,1]. Retorna null se a amostra estiver vazia.
 */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

/**
 * @param {{ latenciesMs: number[], requests: number, ok: number,
 *           client4xx: number, server5xx: number, errors: number,
 *           timeouts: number, elapsedMs: number }} samples
 */
export function summarize(samples) {
  const { latenciesMs, requests, ok, client4xx, server5xx, errors, timeouts, elapsedMs } = samples;
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const seconds = elapsedMs / 1000;

  return {
    requests,
    ok,
    client4xx,
    server5xx,
    errors,
    timeouts,
    rps: seconds > 0 ? requests / seconds : null,
    elapsedMs,
    avgMs: n ? sum / n : null,
    minMs: n ? sorted[0] : null,
    maxMs: n ? sorted[n - 1] : null,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    errorRate: requests > 0 ? errors / requests : null,
    // Só mede sobre o que RESPONDEU: um timeout não tem latência de resposta.
    // Por isso p95/p99 ficam sobre as amostras efetivas, e a taxa de erro é
    // reportada em paralelo — as duas juntas contam a história completa.
    sampleCount: n,
  };
}

const n2 = (v) => (v === null || v === undefined ? "n/a" : v.toFixed(2));
const ms = (v) => (v === null || v === undefined ? "n/a" : `${Math.round(v)} ms`);
const pct = (v) => (v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(2)}%`);

/** Linha de tabela única para o relatório em texto. */
export function formatRow(label, s) {
  return {
    nivel: label,
    reqs: String(s.requests),
    rps: n2(s.rps),
    media: ms(s.avgMs),
    p50: ms(s.p50Ms),
    p95: ms(s.p95Ms),
    p99: ms(s.p99Ms),
    menor: ms(s.minMs),
    maior: ms(s.maxMs),
    "2xx": String(s.ok),
    "4xx": String(s.client4xx),
    "5xx": String(s.server5xx),
    timeouts: String(s.timeouts),
    erro: pct(s.errorRate),
    classe: classify(s),
  };
}

/**
 * CLASSIFICAÇÃO — critérios EXPLÍCITOS, aplicados aos NÚMEROS deste nível.
 *
 * REGRA: pega o pior veredito entre (latência, erro). Os limiares são os
 * mesmos para todos os níveis — o que muda com a concorrência é o resultado
 * medido, não a régua. Assim "500 é vermelho" significa a mesma coisa que
 * "50 é vermelho": latência ou erro fora do aceitável.
 *
 * LATÊNCIA (p95 — o que o usuário sente no pior caso comum):
 *   VERDE    : p95 ≤ 500 ms  e p99 ≤ 1000 ms
 *   AMARELO  : p95 ≤ 1500 ms e p99 ≤ 3000 ms
 *   VERMELHO : acima disso
 *
 * ERRO (inclui 5xx e timeout; erro de rede conta como erro):
 *   VERDE    : taxa de erro ≤ 1%
 *   AMARELO  : ≤ 5%
 *   VERMELHO : > 5%
 *
 * Sem amostras → "sem-dados" (nunca inventamos um veredito).
 */
export function classify(s) {
  if (!s.requests) return "sem-dados";
  if (s.errorRate !== null && s.errorRate > 0.05) return "VERMELHO";
  if (s.p95Ms !== null && (s.p95Ms > 1500 || (s.p99Ms ?? 0) > 3000)) return "VERMELHO";
  if (s.errorRate !== null && s.errorRate > 0.01) return "AMARELO";
  if (s.p95Ms !== null && (s.p95Ms > 500 || (s.p99Ms ?? 0) > 1000)) return "AMARELO";
  return "VERDE";
}

/** Critérios, em texto, para irem no README e no relatório. */
export const CRITERIA_TEXT = [
  "Latência (p95 / p99):",
  "  VERDE    p95 ≤ 500 ms   e p99 ≤ 1000 ms",
  "  AMARELO  p95 ≤ 1500 ms  e p99 ≤ 3000 ms",
  "  VERMELHO acima disso",
  "Erro (5xx + timeouts + falha de rede):",
  "  VERDE ≤ 1%   AMARELO ≤ 5%   VERMELHO > 5%",
  "O veredito final é o PIOR entre latência e erro.",
];
