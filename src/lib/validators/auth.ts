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

/**
 * Onboarding do usuário.
 *
 * TODAS as respostas são OPCIONAIS, e isso é uma regra de produto, não uma
 * frouxidão do schema. O onboarding existe para o Inst Acessor entender o perfil
 * mais rápido — mas o perfil profissional do Instagram, uma vez conectado,
 * fornece esses dados de forma REAL (nicho pelas mídias, alcance e engajamento
 * pelo desempenho). Nenhuma pergunta pode, portanto, BLOQUEAR o acesso ao
 * sistema: quem não quiser responder entra do mesmo jeito, e a plataforma
 * completa o entendimento com dados reais depois.
 *
 * O que o schema continua garantindo é o TAMANHO: campo vazio é permitido,
 * campo com 300 caracteres não. `max` sem `min`.
 */
export const onboardingSchema = z.object({
  objective: z
    .string()
    .max(60, "Objetivo muito longo")
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
