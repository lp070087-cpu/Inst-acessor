import { z } from "zod";

import { TRIGGER_TYPES, MAX_TRIGGER_TERMS, MAX_TERM_LENGTH, MAX_MESSAGE_LENGTH } from "@/lib/comment-direct/triggers";

/**
 * Validações Zod do Comentário → Direct e da Central de DM.
 * Toda rota valida sessão + userId + input no servidor; o cliente nunca define
 * limites fora das faixas seguras.
 */

export const triggerTypeSchema = z.enum(TRIGGER_TYPES);

/** Configuração de uma regra Comentário → Direct. */
export const createDirectRuleSchema = z.object({
  name: z.string().min(2, "Dê um nome para a automação").max(80),
  mediaId: z.string().max(120).nullable().optional(),
  mediaCaption: z.string().max(300).nullable().optional(),
  scope: z.enum(["all", "media"]).default("all"),
  triggerType: triggerTypeSchema,
  triggerTerms: z.array(z.string().max(MAX_TERM_LENGTH)).max(MAX_TRIGGER_TERMS).default([]),
  messageText: z.string().min(1, "Escreva a mensagem").max(MAX_MESSAGE_LENGTH),
  dailyLimit: z.number().int().min(1).max(200).default(50),
  onePerUser: z.boolean().default(true),
});

export const updateDirectRuleSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  enabled: z.boolean().optional(),
  mediaId: z.string().max(120).nullable().optional(),
  scope: z.enum(["all", "media"]).optional(),
  triggerType: triggerTypeSchema.optional(),
  triggerTerms: z.array(z.string().max(MAX_TERM_LENGTH)).max(MAX_TRIGGER_TERMS).optional(),
  messageText: z.string().min(1).max(MAX_MESSAGE_LENGTH).optional(),
  dailyLimit: z.number().int().min(1).max(200).optional(),
  onePerUser: z.boolean().optional(),
  paused: z.boolean().optional(),
});

/** Simulação de gatilho — NUNCA envia nem grava. */
export const testTriggerSchema = z.object({
  mediaId: z.string().max(120).nullable().optional(),
  text: z.string().min(1, "Escreva um texto para testar").max(500),
});

/** FAQ automático. */
export const createFaqSchema = z.object({
  question: z.string().min(2, "Escreva a pergunta").max(160),
  answer: z.string().min(1, "Escreva a resposta").max(900),
  keywords: z.array(z.string().max(60)).max(30).default([]),
  category: z.string().max(40).default("geral"),
});

export const updateFaqSchema = createFaqSchema.partial().extend({
  active: z.boolean().optional(),
});

/** Envio manual de mensagem numa conversa (exige permissão + janela). */
export const sendDirectMessageSchema = z.object({
  text: z.string().min(1, "Escreva a mensagem").max(900),
  /** Quando true, é a aprovação de uma sugestão da IA (registrado na auditoria). */
  approvedFromSuggestion: z.boolean().default(false),
  suggestion: z.string().max(900).nullable().optional(),
});

/** Sugestão de resposta (IA) — não envia. */
export const suggestReplySchema = z.object({
  /** Última mensagem recebida, quando o cliente já a tem; senão o servidor lê. */
  lastIncomingText: z.string().max(900).nullable().optional(),
});
