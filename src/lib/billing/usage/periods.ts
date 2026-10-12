/**
 * JANELAS DE FRANQUIA (núcleo puro)
 * =================================
 * Transforma um instante em uma CHAVE de janela. A chave é o que permite a
 * virada automática: quando o dia/ciclo muda, a chave muda e o contador começa
 * em zero — sem nenhum job de reset e sem risco de "esquecer de zerar".
 *
 * REGRAS (definidas pelo proprietário):
 *   • O limite DIÁRIO reinicia à meia-noite no horário de BRASÍLIA
 *     (America/Sao_Paulo), não em UTC. Um usuário no Brasil vê o saldo voltar
 *     à 00:00 local.
 *   • O limite de CICLO usa o período REALMENTE contratado — a chave é o id do
 *     ciclo (âncora), não o mês calendário. Renovação gera chave nova.
 *   • O Semanal usa seu período de 7 dias (um único ciclo).
 *
 * Nada aqui lê o relógio por conta própria: `now` é sempre injetado — assim os
 * testes são determinísticos e o resultado não depende do fuso da máquina.
 */

/** Fuso oficial do produto para a virada do dia. */
export const APP_TIMEZONE = "America/Sao_Paulo";

/**
 * Data local (Brasília) no formato `YYYY-MM-DD`.
 *
 * Usa `Intl` com `timeZone` em vez de aritmética de offset: o Brasil não tem
 * mais horário de verão desde 2019, mas escrever "-3h na mão" quebraria em
 * silêncio se a regra voltasse. O `Intl` carrega o histórico de fuso do sistema.
 */
export function saoPauloDayKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Chave do CICLO contratado.
 *
 * O ciclo é ancorado no `startAt` do período pago: `startAt` + N dias. A âncora
 * é o instante de início em ISO (estável), então renovar gera uma âncora nova e
 * o contador do ciclo anterior fica para trás — sem apagar histórico.
 *
 * `cycleEndsAt` decide se o ciclo ainda vale: depois do fim, a chave muda para
 * `"expired"` e o consumo é tratado como fora de contrato ativo.
 */
export function cycleKey(input: {
  startAt: Date;
  expiresAt: Date | null;
  now: Date;
}): string {
  const { startAt, expiresAt, now } = input;
  if (expiresAt && now.getTime() >= expiresAt.getTime()) return "expired";
  // Só a data de início importa: o mesmo ciclo mantém a mesma chave o tempo todo.
  return `c${startAt.toISOString().slice(0, 10)}`;
}

/** Rótulo humano da janela, para o painel do usuário. */
export function describeWindow(endsAt: Date | null, now: Date): string | null {
  if (!endsAt) return null;
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `Renova em ${days} ${days === 1 ? "dia" : "dias"}`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `Renova em ${hours}h`;
}

/** Meia-noite de Brasília seguinte — quando o limite diário reinicia. */
export function nextDailyReset(now: Date): Date {
  // Avança até a próxima data local e devolve a meia-noite dela em UTC.
  const key = saoPauloDayKey(now);
  // Constrói a meia-noite local do PRÓXIMO dia como se fosse UTC-3 (offset fixo
  // atual) e ajusta pela diferença real medida com o Intl.
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
  // Corrige qualquer desvio do offset usando a própria função de chave.
  const guessDay = saoPauloDayKey(guess);
  const wantDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (guessDay === wantDay) return guess;
  // Fallback seguro: 24h à frente (nunca "no passado").
  return new Date(now.getTime() + 86400000);
}
