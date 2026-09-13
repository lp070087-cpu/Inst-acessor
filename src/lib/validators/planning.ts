import { z } from "zod";

/**
 * Validações Zod da Fase 6 (Planejamento, Calendário e Pipeline de Conteúdo).
 * Reutiliza os enums de plataforma/formato já definidos na Fase 4 quando
 * possível, mantendo a fonte única.
 */

// ------------------------------------------------------------
// Plataformas / formatos (reuso dos conceitos da Fase 4)
// ------------------------------------------------------------
export const planningPlatformSchema = z.enum(["instagram", "tiktok"]);

export const planningFormatSchema = z.enum([
  "reel",
  "story",
  "carrossel",
  "post",
  "video",
]);

export const planningObjectiveSchema = z
  .string()
  .max(120, "Objetivo muito longo")
  .optional()
  .default("");

export const planningStatusSchema = z.enum([
  "RASCUNHO",
  "IDEIA",
  "EM_PRODUCAO",
  "PRONTO",
  "AGENDADO",
  "PUBLICADO",
  "CANCELADO",
  "FALHOU",
]);

// ------------------------------------------------------------
// Conteúdo planejado
// ------------------------------------------------------------
export const createPlannedContentSchema = z.object({
  platform: planningPlatformSchema.default("instagram"),
  format: planningFormatSchema.default("reel"),
  title: z.string().min(1, "Título é obrigatório").max(200, "Título muito longo"),
  theme: z.string().max(200).optional().default(""),
  objective: planningObjectiveSchema,
  scheduledAt: z.string().optional().nullable().default(null),
  notes: z.string().max(2000).optional().default(""),
  hypothesis: z.string().max(600).optional().default(""),
  ideaId: z.string().optional().nullable().default(null),
  copyId: z.string().optional().nullable().default(null),
  draftId: z.string().optional().nullable().default(null),
  goalId: z.string().optional().nullable().default(null),
});

export type CreatePlannedContentInput = z.infer<typeof createPlannedContentSchema>;

export const updatePlannedContentSchema = z.object({
  platform: planningPlatformSchema.optional(),
  format: planningFormatSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  theme: z.string().max(200).nullable().optional(),
  objective: z.string().max(120).nullable().optional(),
  status: planningStatusSchema.optional(),
  scheduledAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  hypothesis: z.string().max(600).nullable().optional(),
  ideaId: z.string().nullable().optional(),
  copyId: z.string().nullable().optional(),
  draftId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
});

export type UpdatePlannedContentInput = z.infer<typeof updatePlannedContentSchema>;

// ------------------------------------------------------------
// Associação de experimentos (N:N)
// ------------------------------------------------------------
export const attachExperimentSchema = z.object({
  experimentId: z.string().min(1, "experimento é obrigatório"),
});

// ------------------------------------------------------------
// Versão de copy do conteúdo
// ------------------------------------------------------------
export const addCopyVersionSchema = z.object({
  content: z.string().min(1, "Texto da copy é obrigatório").max(6000),
  note: z.string().max(300).optional().default(""),
});

export type AddCopyVersionInput = z.infer<typeof addCopyVersionSchema>;

// ------------------------------------------------------------
// Filtros do calendário
// ------------------------------------------------------------
export const calendarFiltersSchema = z.object({
  view: z.enum(["month", "week", "list"]).default("month"),
  platform: z.string().optional(),
  format: z.string().optional(),
  status: z.string().optional(),
  objective: z.string().optional(),
  experimentId: z.string().optional(),
  goalId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
