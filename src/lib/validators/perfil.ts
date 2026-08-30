import { z } from "zod";

/**
 * Validações centrais da conta/perfil do usuário (Fase 10).
 * Regras de edição do perfil na página /perfil.
 */

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .max(120, "Nome muito longo")
    .trim()
    .optional()
    .or(z.literal("")),
  username: z
    .string()
    .max(60, "Usuário muito longo")
    .trim()
    .optional()
    .or(z.literal("")),
  niche: z
    .string()
    .max(80, "Nicho muito longo")
    .trim()
    .optional()
    .or(z.literal("")),
  subNiche: z
    .string()
    .max(80, "Subnicho muito longo")
    .trim()
    .optional()
    .or(z.literal("")),
  objective: z
    .string()
    .max(60, "Objetivo muito longo")
    .trim()
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
