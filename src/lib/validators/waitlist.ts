import { z } from "zod";

/**
 * LISTA DE ESPERA — validação de entrada (pública)
 * =================================================
 * Entrada do comprador sem conta: nome (opcional) + e-mail (obrigatório) +
 * consentimento EXPLÍCITO. O e-mail é normalizado no servidor
 * (`normalizeEmail`), nunca confiado como veio.
 *
 * O `consent` é OBRIGATORIAMENTE `true`: não gravamos e-mail de ninguém sem
 * uma ação afirmativa. A UI mostra um checkbox e o servidor exige o valor.
 */

export const joinWaitlistSchema = z.object({
  name: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email("Informe um e-mail válido."),
  /**
   * Consentimento para ser contatado quando abrir vaga. Precisa ser
   * literalmente `true` — ausente/false é recusado (não é opt-out silencioso).
   */
  consent: z.literal(true, {
    errorMap: () => ({ message: "É preciso aceitar ser avisado por e-mail." }),
  }),
  /** Plano de interesse (opcional) — ajuda o admin a priorizar. */
  planSlug: z.enum(["semanal", "mensal", "anual"]).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;

/** Ações do admin sobre uma entrada da lista. */
export const waitlistAdminActionSchema = z.object({
  action: z.enum(["invite", "expire", "convert", "remove", "release"]),
  id: z.string().trim().min(1, "Id é obrigatório"),
  /** Validade do convite em dias (só para `invite`/`release`). */
  ttlDays: z.number().int().min(1).max(60).optional(),
});

export type WaitlistAdminActionInput = z.infer<typeof waitlistAdminActionSchema>;
