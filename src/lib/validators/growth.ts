import { z } from "zod";

/**
 * Validações Zod da Fase 8 (Growth Engine).
 * Todas as rotas server-side validam sessão + userId + input.
 * Nunca confia em userId vindo do client — sempre session-derived.
 */

// ------------------------------------------------------------
// Ações de crescimento (GrowthAction)
// ------------------------------------------------------------
export const growthPlatformSchema = z.enum(["instagram", "tiktok"]);

export const growthActionStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "DISMISSED",
  "EXPIRED",
]);

export const growthActionPrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const createGrowthActionSchema = z.object({
  platform: growthPlatformSchema.default("instagram"),
  title: z.string().min(3, "Título muito curto").max(200, "Título muito longo"),
  description: z.string().max(2000).optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
  priority: growthActionPrioritySchema.default(2),
  dueAt: z.string().optional().nullable(),
  sourceSignal: z.string().max(100).optional().nullable(),
  sourceRecommendation: z.string().max(100).optional().nullable(),
  metricToWatch: z.string().max(100).optional().nullable(),
  baselineValue: z.number().optional().nullable(),
});

export const updateGrowthActionSchema = z.object({
  status: growthActionStatusSchema,
  resultValue: z.number().optional().nullable(),
  resultNote: z.string().max(1000).optional().nullable(),
});

export const growthActionQuerySchema = z.object({
  status: growthActionStatusSchema.optional(),
});

// ------------------------------------------------------------
// Motor de crescimento (engine overview)
// ------------------------------------------------------------
export const growthEngineQuerySchema = z.object({
  platform: growthPlatformSchema.optional(),
});

// ------------------------------------------------------------
// Alertas inteligentes (Parte 12 — evolução de /api/alertas)
// ------------------------------------------------------------
export const smartAlertQuerySchema = z.object({
  platform: growthPlatformSchema.optional(),
});
