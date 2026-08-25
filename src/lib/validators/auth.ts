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
