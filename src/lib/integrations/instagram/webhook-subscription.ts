import { INSTAGRAM_GRAPH_BASE, INSTAGRAM_GRAPH_VERSION, postFormNoRetry } from "./client";

/**
 * ASSINATURA DE WEBHOOKS POR CONTA — INSTAGRAM BUSINESS LOGIN
 * ===========================================================
 * Configurar a URL de callback no painel da Meta NÃO basta: no Instagram API
 * com Instagram Login, cada conta profissional conectada precisa habilitar a
 * entrega para o app com o token DELA:
 *
 *   POST https://graph.instagram.com/{versão}/me/subscribed_apps
 *        subscribed_fields=comments,messages
 *        access_token=<token do usuário>
 *
 * Sem esta chamada a Meta nunca entrega `comments`/`messages` dessa conta ao
 * callback — as Respostas Inteligentes ficam sem comentário novo nenhum.
 *
 * Os campos pedidos acompanham as permissões CONCEDIDAS (não as pedidas):
 *   comments → instagram_business_manage_comments
 *   messages → instagram_business_manage_messages
 *
 * Best-effort: o resultado é devolvido ao chamador (que só registra em log);
 * uma falha aqui nunca derruba a conexão OAuth. O token nunca é logado.
 */

const COMMENTS_SCOPE = "instagram_business_manage_comments";
const MESSAGES_SCOPE = "instagram_business_manage_messages";

export type WebhookSubscriptionField = "comments" | "messages";

export interface WebhookSubscriptionResult {
  ok: boolean;
  fields: WebhookSubscriptionField[];
  /** Código da Meta (ou motivo local) quando `ok === false`. Nunca contém token. */
  code?: string;
}

/** Campos de webhook que as permissões concedidas permitem assinar. */
export function webhookFieldsForScopes(scopes: string | null | undefined): WebhookSubscriptionField[] {
  const granted = (scopes ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fields: WebhookSubscriptionField[] = [];
  if (granted.includes(COMMENTS_SCOPE)) fields.push("comments");
  if (granted.includes(MESSAGES_SCOPE)) fields.push("messages");
  return fields;
}

/**
 * Habilita a entrega de webhooks da conta autorizada para este app.
 * Não lança: devolve `{ ok, fields, code }`.
 */
export async function subscribeInstagramWebhooks(
  accessToken: string,
  scopes: string | null | undefined
): Promise<WebhookSubscriptionResult> {
  const fields = webhookFieldsForScopes(scopes);
  if (fields.length === 0) return { ok: false, fields, code: "no_scope" };
  if (!accessToken) return { ok: false, fields, code: "no_token" };

  try {
    const data = await postFormNoRetry<{ success?: boolean }>(
      `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/me/subscribed_apps`,
      { subscribed_fields: fields.join(","), access_token: accessToken }
    );
    if (data.success === true) return { ok: true, fields };
    const code = data.error && data.error.code != null ? String(data.error.code) : "unconfirmed";
    return { ok: false, fields, code };
  } catch {
    return { ok: false, fields, code: "network" };
  }
}
