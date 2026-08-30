/**
 * E-MAIL — PROVIDER DESACOPLADO (sem fingir envio)
 * ==================================================
 * O Inst Acessor precisa de um provider real para ENVIAR o link/código de
 * primeiro acesso (prova de posse do e-mail). Nesta fase NÃO escolhemos um
 * provider secretamente e NÃO fingimos envio.
 *
 * O que esta camada faz:
 *   - Expõe uma abstração única (`sendFirstAccessEmail`) para a fase de
 *     primeiro acesso e futura recuperação de senha.
 *   - Quando nenhum provider está configurado, retorna
 *     `EMAIL_PROVIDER_NOT_CONFIGURED` — o token continua sendo criado no
 *     banco (para testes), mas o e-mail NÃO é enviado.
 *
 * DECISÃO EXTERNA NECESSÁRIA (ver RELATORIO-PRIMEIRO-ACESSO.md):
 *   - Resend / SendGrid / SES / Brevo / Mailgun...
 *   - A DONA deve decidir e configurar as variáveis no painel.
 */

export type EmailProviderStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "SENT"
  | "ERROR";

export interface SendFirstAccessEmailResult {
  ok: boolean;
  status: EmailProviderStatus;
  message?: string;
}

export interface FirstAccessEmailData {
  to: string;
  /** Link mágico de uso único (token incluso). NUNCA logar. */
  activationUrl: string;
  /** Nome do plano (ex.: "Semanal") para personalizar. */
  planName?: string | null;
  /** Quantos minutos o link expira. */
  expiresInMinutes: number;
}

/**
 * Envia o e-mail de primeiro acesso.
 *
 * Para NÃO expor o token em logs, esta função recebe o `activationUrl`
 * pronto (o token já está embutido). A URL é montada pelo chamador.
 *
 * SEM provider configurado → `NOT_CONFIGURED` (nunca finge envio).
 */
export async function sendFirstAccessEmail(
  _data: FirstAccessEmailData
): Promise<SendFirstAccessEmailResult> {
  // TODO(fase futura): integrar Resend/SendGrid/SES conforme decisão da DONA.
  // Sem variáveis EMAIL_* configuradas, não há envio real.
  return {
    ok: false,
    status: "NOT_CONFIGURED",
    message:
      "Provider de e-mail não configurado. O token foi registrado, mas o envio real depende de decisão externa.",
  };
}

/**
 * Indica se há um provider de e-mail configurado.
 * (lê variáveis de ambiente — sem valores reais no código)
 */
export function isEmailProviderConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_PROVIDER &&
      process.env.EMAIL_PROVIDER !== "none" &&
      process.env.EMAIL_PROVIDER !== ""
  );
}
