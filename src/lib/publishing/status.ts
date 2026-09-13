/**
 * STATUS DE PUBLICAÇÃO — Fase 7 (Parte 3)
 * =======================================
 * Estados reais do pipeline (content.status + queue.status):
 *   RASCUNHO | IDEIA | EM_PRODUCAO | PRONTO | AGENDADO | PROCESSANDO |
 *   PUBLICADO | FALHOU | CANCELADO
 *
 * Regras:
 * - PROCESSANDO = tentativa real em andamento.
 * - PUBLICADO SÓ com confirmação do provider (nunca por tempo).
 * - FALHOU guarda motivo.
 * - CANCELADO nunca publica.
 */

export const CONTENT_STATUSES_FASE7 = [
  "RASCUNHO",
  "IDEIA",
  "EM_PRODUCAO",
  "PRONTO",
  "AGENDADO",
  "PROCESSANDO",
  "PUBLICADO",
  "CANCELADO",
  "FALHOU",
] as const;
export type ContentStatusFase7 = (typeof CONTENT_STATUSES_FASE7)[number];

/** Estados que refletem um fluxo de publicação ativo. */
export const PUBLISHING_STATUSES = [
  "AGENDADO",
  "PROCESSANDO",
  "PUBLICADO",
  "FALHOU",
] as const;

/** Map de status amigável para UI. */
export const STATUS_LABELS_FASE7: Record<string, string> = {
  RASCUNHO: "Rascunho",
  IDEIA: "Ideia",
  EM_PRODUCAO: "Em produção",
  PRONTO: "Pronto",
  AGENDADO: "Agendado",
  PROCESSANDO: "Processando",
  PUBLICADO: "Publicado",
  CANCELADO: "Cancelado",
  FALHOU: "Falhou",
};

/** Indicador visual por status (reuso dos tokens da UI). */
export const STATUS_TONES_FASE7: Record<string, string> = {
  RASCUNHO: "neutral",
  IDEIA: "info",
  EM_PRODUCAO: "warning",
  PRONTO: "info",
  AGENDADO: "info",
  PROCESSANDO: "warning",
  PUBLICADO: "success",
  CANCELADO: "danger",
  FALHOU: "danger",
} as const;
