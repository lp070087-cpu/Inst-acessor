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

/** Remove pontuação e mantém somente dígitos (CPF/CNPJ, CEP, telefone). */
function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Telefone no formato do checkout Asaas: DDD + número, SOMENTE dígitos.
 * Ex.: "(81) 98593-0411" → "81985930411".
 * NÃO é E.164 — o endpoint /v3/checkouts espera o número brasileiro SEM o
 * prefixo internacional 55.
 */
function normalizeAsaasPhone(value: string): string {
  return digitsOnly(value);
}

/**
 * Checkout PÚBLICO (buyer sem conta): aceita `planId` OU `planSlug`.
 * `email`/`name` são usados quando o comprador NÃO está autenticado.
 * Os dados de cobrança (CPF/CNPJ, telefone, endereço) são exigidos APENAS do
 * comprador anônimo — o checkout hospedado do Asaas exige esses campos para
 * criar o cliente. O preço/duração/ciclo são SEMPRE resolvidos no servidor.
 */
export const publicCheckoutSchema = z
  .object({
    planId: z.string().trim().min(1).optional(),
    planSlug: planSlugSchema.optional(),
    name: z.string().trim().max(160).optional().nullable(),
    email: z.string().trim().email().optional(),
    cpfCnpj: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    address: z.string().trim().optional(),
    addressNumber: z.string().trim().optional(),
    province: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.planId && !value.planSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o plano (planId ou planSlug).",
      });
    }
  })
  .transform((value) => {
    const out = { ...value };
    if (out.cpfCnpj) out.cpfCnpj = digitsOnly(out.cpfCnpj);
    if (out.postalCode) out.postalCode = digitsOnly(out.postalCode);
    if (out.phone) out.phone = normalizeAsaasPhone(out.phone);
    return out;
  });

export const cancelRenewalSchema = z.object({
  subscriptionId: z.string().min(1, "Assinatura é obrigatória"),
});

export type CheckoutStartInput = z.infer<typeof checkoutStartSchema>;
export type PublicCheckoutInput = z.infer<typeof publicCheckoutSchema>;
export type CancelRenewalInput = z.infer<typeof cancelRenewalSchema>;
