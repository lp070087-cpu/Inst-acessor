import { z } from "zod";

import { REPLY_MODES, COMMENT_CATEGORIES, REPLY_STATUSES } from "@/lib/comment-replies/types";

/**
 * Validações Zod das Respostas Inteligentes.
 * Todas as rotas validam sessão + userId + input no servidor.
 */

export const replyModeSchema = z.enum(REPLY_MODES);
export const commentCategorySchema = z.enum(COMMENT_CATEGORIES);
export const replyStatusSchema = z.enum(REPLY_STATUSES);

/** Configuração da automação. */
export const updateRuleSchema = z.object({
  enabled: z.boolean().optional(),
  replyMode: replyModeSchema.optional(),
  approvalRequired: z.boolean().optional(),
  paused: z.boolean().optional(),
  targetType: z.enum(["all", "media"]).optional(),
  mediaId: z.string().max(120).nullable().optional(),
  maxRepliesPerRun: z.number().int().min(1).max(50).optional(),
  maxRepliesPerHour: z.number().int().min(1).max(100).optional(),
  maxRepliesPerDay: z.number().int().min(1).max(300).optional(),
  minimumIntervalSeconds: z.number().int().min(10).max(3600).optional(),
});

export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

/** Template de resposta. */
export const createTemplateSchema = z.object({
  text: z.string().min(1, "Escreva a resposta").max(280, "Resposta muito longa"),
  category: commentCategorySchema.default("outro"),
  exactReply: z.boolean().default(false),
});

export const updateTemplateSchema = z.object({
  text: z.string().min(1).max(280).optional(),
  category: commentCategorySchema.optional(),
  exactReply: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Perfil especial (@amiga, @clientevip, ...). */
export const createSpecialProfileSchema = z.object({
  // Aceita "@nome" ou "nome" — normalizado no serviço.
  instagramUsername: z
    .string()
    .min(2, "Informe o @ do perfil")
    .max(60)
    .transform((v) => v.trim().replace(/^@+/, "")),
  displayName: z.string().max(80).nullable().optional(),
  category: z.string().max(40).nullable().optional(),
  customInstructions: z
    .string()
    .min(3, "Descreva como a IA deve responder esta pessoa")
    .max(1200),
  // "Não inferir gênero automaticamente" — o texto vem do usuário, nunca de
  // suposição do sistema.
  fixedReply: z.string().max(280).nullable().optional(),
  useAI: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(10),
});

export const updateSpecialProfileSchema = createSpecialProfileSchema.partial().extend({
  active: z.boolean().optional(),
});

/** Leitura/análise. */
export const analyzeSchema = z.object({
  mediaId: z.string().min(1, "Selecione uma publicação").max(120),
  onlyUnanswered: z.boolean().default(true),
});

/** Aprovação / edição / envio. */
export const approveSchema = z.object({
  logId: z.string().min(1),
  /** Texto final. Ausente = usar a sugestão gerada. */
  finalReply: z.string().max(280).optional(),
});

export const editSchema = z.object({
  logId: z.string().min(1),
  finalReply: z.string().min(1, "A resposta não pode ficar vazia").max(280),
});

export const ignoreSchema = z.object({
  logId: z.string().min(1),
});

export const regenerateSchema = z.object({
  logId: z.string().min(1),
});

/** Histórico com filtros. */
export const historyQuerySchema = z.object({
  status: z.union([replyStatusSchema, z.literal("ALL")]).default("ALL"),
  mediaId: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
