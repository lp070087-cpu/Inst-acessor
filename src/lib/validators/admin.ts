import { z } from "zod";

/**
 * Validações da área administrativa (Fase 10).
 * Apenas ADMIN pode gravar. Nenhuma chave completa sai do servidor.
 */

export const aiProviderSchema = z.enum(["openai", "gemini"]);

export const aiModelSchema = z.enum([
  "gpt-4o-mini",
  "gpt-4o",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
]);

/** Salva/atualiza a configuração de um provider de IA. */
export const saveAIProviderSchema = z
  .object({
    provider: aiProviderSchema,
    /** Nova chave. Se vazio, mantém a existente. */
    apiKey: z.string().max(512).optional().default(""),
    model: aiModelSchema,
  })
  .refine(
    (data) => {
      // O model precisa ser coerente com o provider escolhido.
      if (data.provider === "openai") {
        return data.model.startsWith("gpt-");
      }
      return data.model.startsWith("gemini-");
    },
    { message: "Modelo incompatível com o provider selecionado." }
  );
export type SaveAIProviderInput = z.infer<typeof saveAIProviderSchema>;

/** Remove a chave de um provider. */
export const removeAIProviderSchema = z.object({
  provider: aiProviderSchema,
});
export type RemoveAIProviderInput = z.infer<typeof removeAIProviderSchema>;

/** Testa uma chave (nova ou existente) sem gravar. */
export const testAIProviderSchema = z
  .object({
    provider: aiProviderSchema,
    apiKey: z.string().max(512).optional().default(""),
    model: aiModelSchema,
  })
  .refine(
    (data) => {
      if (data.provider === "openai") return data.model.startsWith("gpt-");
      return data.model.startsWith("gemini-");
    },
    { message: "Modelo incompatível com o provider selecionado." }
  );
export type TestAIProviderInput = z.infer<typeof testAIProviderSchema>;

/** Atualiza o papel/status de um usuário (admin). */
export const adminUserStatusSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["suspend", "activate", "make-admin", "remove-admin"]),
});
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;

/** Liberação manual de acesso por e-mail (somente ADMIN). */
export const adminGrantAccessSchema = z.object({
  email: z.string().trim().email("E-mail inválido.").toLowerCase(),
  days: z.number().int().min(1, "Duração mínima de 1 dia.").max(3650, "Duração máxima de 3650 dias."),
});
export type AdminGrantAccessInput = z.infer<typeof adminGrantAccessSchema>;
