import { z } from "zod";

/**
 * Validações Zod da Fase 6.5 (Planos, Assinatura e Checkout).
 * Reutiliza os enums de plataforma/formato já definidos quando possível.
 */

export const planSlugSchema = z.enum(["semanal", "mensal", "anual"]);

/** Schema legado do checkout autenticado (apenas planId; email/nome da sessão). */
export const checkoutStartSchema = z.object({
  planId: z.string().min(1, "Plano é obrigatório"),
});

/**
 * Checkout PÚBLICO (buyer sem conta): aceita `planId` OU `planSlug`.
 * `email`/`name` são usados quando o comprador NÃO está autenticado.
 * O preço/duração/ciclo são SEMPRE resolvidos no servidor — nunca do body.
 */
export const publicCheckoutSchema = z
  .object({
    planId: z.string().trim().min(1).optional(),
    planSlug: planSlugSchema.optional(),
    name: z.string().trim().max(160).optional().nullable(),
    email: z.string().trim().email().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.planId && !value.planSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o plano (planId ou planSlug).",
      });
    }
  });

export const cancelRenewalSchema = z.object({
  subscriptionId: z.string().min(1, "Assinatura é obrigatória"),
});

export type CheckoutStartInput = z.infer<typeof checkoutStartSchema>;
export type PublicCheckoutInput = z.infer<typeof publicCheckoutSchema>;
export type CancelRenewalInput = z.infer<typeof cancelRenewalSchema>;
