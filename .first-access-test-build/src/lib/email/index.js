"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFirstAccessEmail = sendFirstAccessEmail;
exports.isEmailProviderConfigured = isEmailProviderConfigured;
/**
 * Envia o e-mail de primeiro acesso.
 *
 * Para NÃO expor o token em logs, esta função recebe o `activationUrl`
 * pronto (o token já está embutido). A URL é montada pelo chamador.
 *
 * SEM provider configurado → `NOT_CONFIGURED` (nunca finge envio).
 */
async function sendFirstAccessEmail(_data) {
    // TODO(fase futura): integrar Resend/SendGrid/SES conforme decisão da DONA.
    // Sem variáveis EMAIL_* configuradas, não há envio real.
    return {
        ok: false,
        status: "NOT_CONFIGURED",
        message: "Provider de e-mail não configurado. O token foi registrado, mas o envio real depende de decisão externa.",
    };
}
/**
 * Indica se há um provider de e-mail configurado.
 * (lê variáveis de ambiente — sem valores reais no código)
 */
function isEmailProviderConfigured() {
    return Boolean(process.env.EMAIL_PROVIDER &&
        process.env.EMAIL_PROVIDER !== "none" &&
        process.env.EMAIL_PROVIDER !== "");
}
