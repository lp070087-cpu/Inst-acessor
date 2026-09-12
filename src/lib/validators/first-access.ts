import { z } from "zod";

/**
 * Validações Zod do PRIMEIRO ACESSO.
 * Regras seguras: nunca aceitam senha fraca; nunca expõem informação.
 */

/** Etapa 1 — solicitar token pelo e-mail da compra. */
export const requestFirstAccessSchema = z.object({
  // IMPORTANTE: trim/lowercase ANTES de validar — caso contrário um e-mail com
  // espaço (ex.: colado do checkout) seria rejeitado como "inválido" apesar de
  // ser o mesmo e-mail da compra.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail utilizado na compra")
    .email("E-mail inválido"),
});
export type RequestFirstAccessInput = z.infer<typeof requestFirstAccessSchema>;

/** Verificar token (link de uso único). */
export const verifyFirstAccessTokenSchema = z.object({
  token: z.string().min(16, "Link inválido"),
});
export type VerifyFirstAccessTokenInput = z.infer<typeof verifyFirstAccessTokenSchema>;

/** Criar conta e senha no primeiro acesso. */
export const createFirstAccessSchema = z
  .object({
    token: z.string().min(16, "Link inválido"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type CreateFirstAccessInput = z.infer<typeof createFirstAccessSchema>;

/** Concluir/pular o tour guiado. */
export const completeTourSchema = z.object({});
export type CompleteTourInput = z.infer<typeof completeTourSchema>;
