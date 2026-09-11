/**
 * E-MAIL — PROVIDER DESACOPLADO (server-only, fail-closed)
 * =========================================================
 * Responsável por ENVIAR o link/código de primeiro acesso (prova de posse do
 * e-mail) e os avisos de "acesso liberado".
 *
 * REGRAS PERMANENTES:
 *   - NUNCA fingir envio: sem provider configurado → `NOT_CONFIGURED` e a
 *     chamada não segue (nenhum e-mail é enviado, nenhum log com conteúdo).
 *   - NUNCA logar o token/URL de ativação nem conteúdo do corpo.
 *   - Server-only: este módulo lê variáveis de ambiente; NUNCA importar em
 *     client component.
 *   - Só as variáveis documentadas no .env.example:
 *       EMAIL_PROVIDER  (ex.: "resend")
 *       EMAIL_FROM      (remetente verificado, ex.: "Inst Acessor <no-reply@...>")
 *       RESEND_API_KEY  (chave do provider Resend)
 *
 * A escolha do provider é decisão EXTERNA (a DONA escolhe e configura). Hoje o
 * único provider implementado é o RESEND, chamado via REST oficial
 * (https://api.resend.com/emails) — sem dependência npm adicional. Qualquer
 * outro provider pode ser adicionado no `switch` abaixo preservando o contrato.
 *
 * O e-mail de PRIMEIRO ACESSO tem prioridade: se o provider estiver
 * configurado, ele é enviado de verdade. Quando NÃO está, o token continua
 * sendo criado no banco (para testes/fluxo) e, em desenvolvimento, exibido na
 * tela — nunca simulamos entrega.
 */

export type EmailProviderName = "resend" | "none";

export type EmailProviderStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "SENT"
  | "ERROR";

export interface SendEmailResult {
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

export interface AccessReleasedEmailData {
  to: string;
  /** Nome do plano comprado (ex.: "Inst acessor Semanal"). */
  planName: string | null;
  /** URL do app para o cliente entrar/ativar. */
  appUrl: string;
}

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 12_000;

function readProvider(): EmailProviderName {
  const raw = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  return raw === "resend" ? "resend" : "none";
}

function readFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Inst Acessor <nao-responda@unitrixapp.com.br>"
  );
}

function readResendApiKey(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

/** Indica se há um provider de e-mail configurado (sem revelar valores). */
export function isEmailProviderConfigured(): boolean {
  if (readProvider() === "none") return false;
  if (readProvider() === "resend") return Boolean(readResendApiKey());
  return false;
}

/**
 * Envia um e-mail transacional via Resend (REST oficial).
 * Fail-closed: sem chave → `NOT_CONFIGURED` (nenhum fetch é feito).
 * NUNCA loga destinatário/conteúdo em caso de erro — apenas status/mensagem
 * genérica do provider.
 */
async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = readResendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      message: "Provider de e-mail não configurado (RESEND_API_KEY ausente).",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: readFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    // Resend responde 2xx com { id } quando aceita. Não lemos o corpo em caso
    // de erro para não vazar detalhes; apenas o status.
    if (!res.ok) {
      console.error(`[email] falha no envio (Resend) http=${res.status}`);
      return {
        ok: false,
        status: "ERROR",
        message: "Não foi possível enviar o e-mail no momento.",
      };
    }
    return { ok: true, status: "SENT" };
  } catch (err) {
    console.error(
      `[email] erro de rede no envio (Resend): ${
        err instanceof Error && err.name === "AbortError"
          ? "timeout"
          : "falha de conexão"
      }`
    );
    return {
      ok: false,
      status: "ERROR",
      message: "Não foi possível enviar o e-mail no momento.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Dispatcher — hoje só Resend; outros providers entram aqui sem quebrar contrato. */
async function dispatch(
  provider: EmailProviderName,
  input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }
): Promise<SendEmailResult> {
  switch (provider) {
    case "resend":
      return sendViaResend(input);
    case "none":
    default:
      return {
        ok: false,
        status: "NOT_CONFIGURED",
        message:
          "Provider de e-mail não configurado. O token foi registrado, mas o envio real depende de decisão externa.",
      };
  }
}

/** Escapa HTML simples (para interpolar apenas texto confiável). */
function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layoutEmail(innerHtml: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#F4F5FA;font-family:Arial,Helvetica,sans-serif;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:8px 0 16px">
      <span style="font-size:18px;font-weight:700;color:#1A1D29">Inst <span style="color:#F43F8E">Acessor</span></span>
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #ECEFF4;border-radius:16px;padding:28px">
      ${innerHtml}
    </td></tr>
    <tr><td style="padding:16px 4px 0;font-size:12px;color:#8A8FA3;line-height:1.6">
      Você está recebendo este e-mail porque uma compra ou liberação de acesso foi
      registrada no Inst Acessor com este endereço. Se não foi você, pode ignorar.
      <br/>© ${new Date().getFullYear()} Inst Acessor · Inteligência para o seu Instagram.
    </td></tr>
  </table></body></html>`;
}

/**
 * Envia o e-mail de PRIMEIRO ACESSO (link de ativação de uso único).
 * Para NÃO expor o token em logs, esta função recebe o `activationUrl` pronto
 * (o token já está embutido). A URL é montada pelo chamador.
 */
export async function sendFirstAccessEmail(
  data: FirstAccessEmailData
): Promise<SendEmailResult> {
  const provider = readProvider();
  if (provider === "none") {
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      message:
        "Provider de e-mail não configurado. O token foi registrado, mas o envio real depende de decisão externa.",
    };
  }

  const planLine = data.planName
    ? `Plano escolhido: <strong>${esc(data.planName)}</strong><br/>`
    : "";

  const html = layoutEmail(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#1A1D29">Ative seu acesso ao Inst Acessor</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#4B5162;line-height:1.6">
      Recebemos sua compra. Para liberar seu acesso, confirme seu e-mail criando
      sua própria senha (nunca enviamos senha pronta).
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#4B5162;line-height:1.6">
      ${planLine}
      Este link é <strong>pessoal e de uso único</strong> e expira em
      <strong>${data.expiresInMinutes} minutos</strong>.
    </p>
    <p style="margin:0 0 24px">
      <a href="${esc(data.activationUrl)}"
         style="display:inline-block;background:linear-gradient(115deg,#F43F8E,#A855F7 45%,#6366F1);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:999px">
        Ativar meu acesso
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#8A8FA3">
      Se o botão não funcionar, copie e cole este link no navegador:<br/>
      ${esc(data.activationUrl)}
    </p>`);

  return dispatch(provider, {
    to: data.to,
    subject: "Ative seu acesso ao Inst Acessor",
    html,
    text: `Ative seu acesso ao Inst Acessor.\n\n${planLine.replace(/<[^>]+>/g, "")}\nAbra o link (uso único, expira em ${data.expiresInMinutes} min):\n${data.activationUrl}`,
  });
}

/**
 * Envia o aviso de "acesso liberado" após pagamento confirmado (webhook) para
 * compradores que ainda não têm conta. Best-effort: falha de envio NUNCA
 * quebra o fluxo de liberação — o acesso já está concedido; o cliente também
 * pode ativar pela página de primeiro acesso.
 */
export async function sendAccessReleasedEmail(
  data: AccessReleasedEmailData
): Promise<SendEmailResult> {
  const provider = readProvider();
  if (provider === "none") {
    return { ok: false, status: "NOT_CONFIGURED" };
  }

  const planLine = data.planName
    ? `Seu plano <strong>${esc(data.planName)}</strong> está liberado.`
    : "Seu acesso ao Inst Acessor está liberado.";

  const html = layoutEmail(`
    <h1 style="margin:0 0 8px;font-size:20px;color:#1A1D29">Acesso liberado 🎉</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#4B5162;line-height:1.6">
      O pagamento foi confirmado. ${planLine}
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#4B5162;line-height:1.6">
      Para começar, crie sua senha (você nunca recebe uma senha pronta) e ative
      sua conta.
    </p>
    <p style="margin:0 0 24px">
      <a href="${esc(data.appUrl)}"
         style="display:inline-block;background:linear-gradient(115deg,#F43F8E,#A855F7 45%,#6366F1);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:999px">
        Ativar meu acesso
      </a>
    </p>`);

  return dispatch(provider, {
    to: data.to,
    subject: "Seu acesso ao Inst Acessor está liberado",
    html,
    text: `Acesso liberado.\n\n${data.planName ? `Plano ${data.planName} confirmado.` : "Seu acesso foi confirmado."}\nAtive em: ${data.appUrl}`,
  });
}
