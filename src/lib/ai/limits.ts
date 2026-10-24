/**
 * LIMITES DEFENSIVOS DA CAMADA DE IA (núcleo puro)
 * =================================================
 * REGRA: nenhuma operação de IA pode "sair de controle". Um prompt gigante
 * (histórico de conversa longo, legenda enorme colada no contexto) ou uma
 * resposta sem teto multiplicam CUSTO por token sem que ninguém perceba — e o
 * custo é real, cobrado pelo provedor.
 *
 * Este módulo NÃO escolhe modelo e NÃO altera o comportamento legítimo: ele só
 * impõe TETOS. Os valores são generosos o bastante para não cortar uso real e
 * apertados o bastante para conter o caso patológico.
 *
 * ⚠️ Puro: nada aqui lê rede, banco ou relógio. É importado pelos providers
 * (`./openai`, `./gemini`) imediatamente antes de montar o corpo do request.
 */
import type { AIMessageInput } from "./provider";

/**
 * Teto de caracteres de UMA mensagem. Acima disso o conteúdo é truncado (o
 * final é cortado) — evita que uma única legenda/histórico domine o request.
 */
export const AI_MAX_MESSAGE_CHARS = 8_000;

/** Teto de caracteres do prompt de SISTEMA (contexto do usuário + regras). */
export const AI_MAX_SYSTEM_CHARS = 24_000;

/**
 * Teto de caracteres do request COMPLETO (system + mensagens). Quando excedido,
 * mantemos as mensagens MAIS RECENTES e descartamos as mais antigas — nunca o
 * contrário: contexto recente importa mais que o início de uma conversa longa.
 */
export const AI_MAX_INPUT_CHARS = 60_000;

/** Teto de tokens de SAÍDA de uma única resposta (cap duro do sistema). */
export const AI_MAX_OUTPUT_TOKENS = 4_000;

/** Tokens de saída quando o chamador não pede nenhum — consistente p/ os dois. */
export const AI_DEFAULT_OUTPUT_TOKENS = 1_200;

/** Aplica o teto de tokens de saída, respeitando o pedido dentro da faixa. */
export function clampMaxTokens(requested?: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0) {
    return AI_DEFAULT_OUTPUT_TOKENS;
  }
  return Math.min(Math.floor(requested), AI_MAX_OUTPUT_TOKENS);
}

/** Trunca o prompt de sistema ao teto (o excedente final é marcado). */
export function capSystem(system: string | undefined): string | undefined {
  if (system == null) return system;
  if (system.length <= AI_MAX_SYSTEM_CHARS) return system;
  return truncate(system, AI_MAX_SYSTEM_CHARS, "\n[contexto truncado]");
}

function truncate(text: string, maxChars: number, marker: string): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= marker.length) return text.slice(0, Math.max(0, maxChars));
  return `${text.slice(0, maxChars - marker.length)}${marker}`;
}

/**
 * Aplica os tetos às mensagens: trunca cada uma e, se o total ainda passar do
 * teto, mantém as mais RECENTES até caber. A ordem relativa é preservada.
 */
export function capMessages(messages: AIMessageInput[], system?: string): AIMessageInput[] {
  const available = AI_MAX_INPUT_CHARS - (capSystem(system)?.length ?? 0);
  const perMessageCapped = messages.map((m) => ({
    ...m,
    content: truncate(m.content, AI_MAX_MESSAGE_CHARS, "\n[conteúdo truncado]"),
  }));

  const total = perMessageCapped.reduce((n, m) => n + m.content.length, 0);
  if (total <= available) return perMessageCapped;

  const kept: AIMessageInput[] = [];
  let sum = 0;
  for (let i = perMessageCapped.length - 1; i >= 0; i--) {
    const msg = perMessageCapped[i];
    if (sum + msg.content.length > available) break;
    kept.unshift(msg);
    sum += msg.content.length;
  }
  return kept;
}
