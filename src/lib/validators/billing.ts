import { z } from "zod";

/**
 * Validações Zod da Fase 6.5 (Planos, Assinatura e Checkout).
 * Reutiliza os enums de plataforma/formato já definidos quando possível.
 */

export const planSlugSchema = z.enum(["semanal", "mensal", "anual"]);

export const checkoutStartSchema = z.object({
  planId: z.string().min(1, "Plano é obrigatório"),
});

export const cancelRenewalSchema = z.object({
  subscriptionId: z.string().min(1, "Assinatura é obrigatória"),
});

export type CheckoutStartInput = z.infer<typeof checkoutStartSchema>;
export type CancelRenewalInput = z.infer<typeof cancelRenewalSchema>;
