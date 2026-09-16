import { z } from "zod";

/**
 * Validações centrais de autenticação (Zod).
 * Regras alinhadas às telas de Login/Cadastro da Fase 1.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail")
    .email("E-mail inválido")
    .trim()
    .toLowerCase(),
  password: z.string().min(1, "Informe sua senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Informe seu nome")
      .max(120, "Nome muito longo")
      .trim(),
    email: z
      .string()
      .min(1, "Informe seu e-mail")
      .email("E-mail inválido")
      .trim()
      .toLowerCase(),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const onboardingSchema = z.object({
  objective: z
    .string()
    .min(1, "Escolha seu objetivo principal")
    .max(60, "Objetivo muito longo"),
  niche: z
    .string()
    .min(2, "Informe seu nicho")
    .max(80, "Nicho muito longo")
    .trim(),
  subNiche: z
    .string()
    .max(80, "Subnicho muito longo")
    .trim()
    .optional()
    .or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Troca de senha do usuário autenticado.
 *
 * A senha ATUAL é obrigatória: sem ela, um acesso temporário (aparelho
 * compartilhado, sessão esquecida aberta) viraria troca definitiva de
 * credencial. A nova senha segue a mesma regra mínima do cadastro (8) e a
 * confirmação é comparada aqui — nunca no cliente.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual"),
    password: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "A nova senha precisa ser diferente da senha atual",
    path: ["password"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
