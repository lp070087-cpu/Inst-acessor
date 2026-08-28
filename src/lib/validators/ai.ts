import { z } from "zod";

/**
 * Validações Zod da Fase 4 (IA e Inteligência).
 * Todas as rotas server-side validam sessão + userId + input.
 */

// ------------------------------------------------------------
// IA Acessor (chat)
// ------------------------------------------------------------
export const chatMessageSchema = z.object({
  message: z.string().min(1, "Digite uma mensagem").max(4000, "Mensagem muito longa"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const chatCreateSchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().min(1, "Digite uma mensagem").max(4000, "Mensagem muito longa"),
});

export type ChatCreateInput = z.infer<typeof chatCreateSchema>;

// ------------------------------------------------------------
// Gerador de Copy
// ------------------------------------------------------------
export const copyPlatformSchema = z.enum(["instagram", "tiktok"]);
export const copyFormatSchema = z.enum([
  "legenda",
  "reel",
  "story",
  "carrossel",
  "tiktok",
  "cta",
  "headline",
  "bio",
  "anuncio",
]);
export const copyToneSchema = z.enum([
  "casual",
  "profissional",
  "divertido",
  "inspirador",
  "diretto",
  "educativo",
]);

export const generateCopySchema = z.object({
  platform: copyPlatformSchema.default("instagram"),
  format: copyFormatSchema,
  objective: z.string().max(200).optional().default(""),
  tone: copyToneSchema.default("casual"),
  audience: z.string().max(200).optional().default(""),
  context: z.string().max(400).optional().default(""),
  size: z.enum(["curto", "medio", "longo"]).default("medio"),
});

export type GenerateCopyInput = z.infer<typeof generateCopySchema>;

export const saveCopySchema = z.object({
  platform: copyPlatformSchema,
  format: copyFormatSchema,
  objective: z.string().max(200).optional().default(""),
  tone: copyToneSchema.optional().default("casual"),
  audience: z.string().max(200).optional().default(""),
  context: z.string().max(400).optional().default(""),
  content: z.string().min(1).max(6000),
});

export type SaveCopyInput = z.infer<typeof saveCopySchema>;

// ------------------------------------------------------------
// Central de Ideias
// ------------------------------------------------------------
export const ideaCategorySchema = z.enum([
  "reels",
  "stories",
  "carrossel",
  "tiktok",
  "educativo",
  "autoridade",
  "venda",
  "engajamento",
]);

export const generateIdeaSchema = z.object({
  category: ideaCategorySchema,
  count: z.number().int().min(1).max(5).default(3),
});

export type GenerateIdeaInput = z.infer<typeof generateIdeaSchema>;

export const saveIdeaSchema = z.object({
  category: ideaCategorySchema,
  title: z.string().min(1).max(200),
  format: z.string().max(60).optional().default(""),
  objective: z.string().max(120).optional().default(""),
  context: z.string().max(400).optional().default(""),
  rationale: z.string().max(600).optional().default(""),
  platform: z.string().max(20).optional().default("instagram"),
});

export type SaveIdeaInput = z.infer<typeof saveIdeaSchema>;

// ------------------------------------------------------------
// Preview Social (rascunho)
// ------------------------------------------------------------
export const draftPlatformSchema = z.enum(["instagram", "tiktok"]);
export const draftFormatSchema = z.enum([
  "post",
  "reel",
  "story",
  "carrossel",
  "video",
]);

/**
 * Edições visuais LEVES de uma imagem (client-side, sem serviço externo).
 * Aplicadas via CSS (transform + filter) no editor e no preview.
 */
export const imageEditsSchema = z.object({
  ratio: z.enum(["1:1", "4:5", "9:16"]).default("1:1"),
  rotate: z.number().default(0),
  zoom: z.number().min(1).max(3).default(1),
  offsetX: z.number().min(-100).max(100).default(0),
  offsetY: z.number().min(-100).max(100).default(0),
  brightness: z.number().min(0).max(200).default(100),
  contrast: z.number().min(0).max(200).default(100),
});
export type ImageEditsInput = z.infer<typeof imageEditsSchema>;

export const draftItemSchema = z.object({
  uid: z.string().min(1),
  mediaType: z.enum(["image", "video"]).default("image"),
  mediaUrl: z.string().max(2_000_000),
  edits: imageEditsSchema.default({}),
});
export type DraftItemInput = z.infer<typeof draftItemSchema>;

export const saveDraftSchema = z.object({
  platform: draftPlatformSchema,
  mediaType: z.enum(["image", "video"]).default("image"),
  mediaUrl: z.string().max(2_000_000).optional().default(""),
  caption: z.string().max(2200).optional().default(""),
  hashtags: z.string().max(500).optional().default(""),
  format: draftFormatSchema.default("post"),
  /** Itens do carrossel (até 7). Cada item: { uid, mediaType, mediaUrl, edits }. */
  items: z.array(draftItemSchema).max(7).optional().default([]),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

// ------------------------------------------------------------
// Mentoria (recomendações)
// ------------------------------------------------------------
export const recommendationStatusSchema = z.enum([
  "NOVA",
  "APLICADA",
  "IGNORADA",
  "CONCLUIDA",
]);

export const updateRecommendationSchema = z.object({
  status: recommendationStatusSchema,
});

export type UpdateRecommendationInput = z.infer<typeof updateRecommendationSchema>;

// ------------------------------------------------------------
// Análise de Desempenho
// ------------------------------------------------------------
export const analysisPlatformSchema = z.enum(["instagram", "tiktok"]);
export const analysisPeriodSchema = z.enum(["7d", "30d", "90d"]);

// ------------------------------------------------------------
// Score Inteligente
// ------------------------------------------------------------
export const scorePlatformSchema = z.enum(["instagram", "tiktok"]);
