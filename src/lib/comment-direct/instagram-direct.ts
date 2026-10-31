import { decryptToken } from "@/lib/crypto";
import {
  INSTAGRAM_GRAPH_BASE,
  INSTAGRAM_GRAPH_VERSION,
  InstagramApiError,
} from "@/lib/integrations/instagram/client";
import { prisma } from "@/lib/db";
import { canManageMessages, SCOPE_MANAGE_MESSAGES } from "./permissions";

/**
 * LEITURA E ENVIO DE MENSAGENS PRIVADAS (DIRECT) DO INSTAGRAM
 * ===========================================================
 * Usa a MESMA `SocialConnection` e o MESMO token criptografado do Instagram
 * Business Login. NÃO existe segundo OAuth.
 *
 * Endpoints OFICIAIS (host `graph.instagram.com`, versão já usada pelas
 * Respostas Inteligentes):
 *
 *   ENVIO (private reply a um comentário):
 *     POST /{version}/{ig-user-id}/messages
 *       { recipient: { comment_id }, message: { text } }
 *
 *   LEITURA de conversas/mensagens:
 *     GET /{version}/{ig-user-id}/conversations
 *     GET /{version}/{conversation-id}/messages
 *
 * REGRA DE OURO: este módulo NUNCA contorna permissão. Se a Meta recusar, o erro
 * é TIPADO (`CommentCapabilityError`) e a UI mostra o motivo real. Nenhum dado
 * é inventado: conversa vazia é conversa vazia.
 *
 * O token NUNCA sai daqui: é descriptografado no servidor e usado só no header.
 */

const FETCH_TIMEOUT_MS = 20000;

/**
 * Erros de Direct. Reaproveitamos a forma de `CommentCapabilityError` para que
 * a UI trate os dois de forma idêntica — mesmos códigos, mesmas ações.
 */
export type DirectCapabilityCode =
  | "no_connection"
  | "not_connected"
  | "capability"
  | "window_closed"
  | "rate_limit"
  | "not_found"
  | "api";

export class DirectCapabilityError extends Error {
  code: DirectCapabilityCode;
  metaCode?: string;
  metaMessage?: string;
  constructor(
    code: DirectCapabilityCode,
    message: string,
    metaCode?: string,
    metaMessage?: string
  ) {
    super(message);
    this.name = "DirectCapabilityError";
    this.code = code;
    this.metaCode = metaCode;
    this.metaMessage = metaMessage;
  }
}

export interface DirectCredentials {
  connectionId: string;
  igUserId: string | null;
  accessToken: string;
  /** Escopos concedidos como a Meta os devolveu (persistidos no OAuth). */
  scopes: string | null;
  /**
   * Todos os identificadores conhecidos da PRÓPRIA conta (IG_ID do perfil e o
   * `me.id` da conexão). Usados para reconhecer "mensagem nossa" e para achar o
   * CONTATO entre os participantes de uma conversa. Opcional para manter
   * compatível quem monta credenciais à mão.
   */
  ownAccountIds?: string[];
}

/** Identificadores da própria conta (sem vazios/duplicados). */
function ownIdsOf(credentials: DirectCredentials): string[] {
  const ids = [...(credentials.ownAccountIds ?? []), credentials.igUserId ?? ""];
  return Array.from(new Set(ids.filter((id) => id.length > 0)));
}

/**
 * Carrega a conexão do Instagram e o token em claro (somente no servidor).
 * Diferente de `loadCommentCredentials`, aqui também devolvemos `scopes` para a
 * checagem EXPLÍCITA de permissão antes de qualquer envio.
 */
export async function loadDirectCredentials(userId: string): Promise<DirectCredentials> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
    include: { igProfiles: true },
  });

  if (!connection?.tokenEncrypted) {
    throw new DirectCapabilityError(
      "no_connection",
      "Conecte seu Instagram em Redes Sociais para usar o Direct."
    );
  }

  if (connection.status !== "CONNECTED") {
    throw new DirectCapabilityError(
      "not_connected",
      "A conexão com o Instagram não está ativa. Reconecte em Redes Sociais."
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.tokenEncrypted);
  } catch {
    throw new DirectCapabilityError(
      "not_connected",
      "Não foi possível ler a credencial armazenada. Reconecte o Instagram."
    );
  }

  return {
    connectionId: connection.id,
    igUserId: connection.igProfiles?.igAccountId ?? connection.externalAccountId ?? null,
    accessToken,
    scopes: connection.scopes,
    ownAccountIds: [connection.igProfiles?.igAccountId, connection.externalAccountId].filter(
      (id): id is string => typeof id === "string" && id.length > 0
    ),
  };
}

/**
 * Traduz o código da Meta em código do produto (mesma tabela de
 * `instagram-comments.ts`, com o acréscimo de `window_closed`).
 *
 * A Meta recusa o private reply fora da janela de 7 dias com code 10/subcode
 * de política — tratamos como `window_closed` porque a ação do usuário é
 * diferente: não é reconectar, é apenas não insistir naquele comentário.
 */
function capabilityFromMeta(rawCode: string | number | null | undefined): DirectCapabilityCode {
  const code = rawCode == null ? "" : String(rawCode);
  if (code === "190") return "not_connected";
  if (code === "10" || code === "200" || code === "3" || code === "2018278") return "capability";
  if (code === "4" || code === "17" || code === "613") return "rate_limit";
  if (code === "100" || code === "33" || code === "24" || code === "803") return "not_found";
  if (code === "400" || code === "404") return "not_found";
  return "api";
}

/** Frase para o USUÁRIO — nunca cita escopo, endpoint ou código da Meta. */
function capabilityMessage(code: DirectCapabilityCode): string {
  switch (code) {
    case "not_connected":
      return "Precisamos renovar a autorização do Instagram. Reconecte a conta em Redes Sociais para continuar.";
    case "capability":
      return "O Instagram não liberou o acesso às mensagens privadas desta conta. Reconecte a conta em Redes Sociais; se o aviso continuar, o acesso ainda está em análise pela Meta.";
    case "window_closed":
      return "A janela para responder esta conversa pelo Instagram já fechou. A mensagem não foi enviada.";
    case "rate_limit":
      return "O Instagram limitou temporariamente as requisições. Tente novamente em alguns minutos.";
    case "not_found":
      return "Não conseguimos acessar esta conversa no Instagram agora. Ela pode ter sido removida.";
    case "no_connection":
      return "Conecte seu Instagram em Redes Sociais para usar o Direct.";
    default:
      return "Não foi possível falar com o Instagram agora. Tente novamente em instantes.";
  }
}

export const __directCapabilityFromMeta = capabilityFromMeta;
export const __directCapabilityMessage = capabilityMessage;

function toCapabilityError(err: unknown): DirectCapabilityError {
  if (err instanceof DirectCapabilityError) return err;
  if (err instanceof InstagramApiError) {
    const metaCode = err.code == null ? "" : String(err.code);
    const code = capabilityFromMeta(metaCode);
    return new DirectCapabilityError(code, capabilityMessage(code), metaCode || undefined, err.message);
  }
  return new DirectCapabilityError(
    "api",
    "Não foi possível falar com o Instagram agora. Tente novamente em instantes.",
    undefined,
    err instanceof Error ? err.message : undefined
  );
}

// ================================================================
// ENVIO — private reply (mensagem privada em resposta a um comentário)
// ================================================================

export interface PrivateReplyResult {
  externalMessageId: string;
}

/**
 * Envia a mensagem privada em resposta a um comentário (private reply).
 *
 * O recipient é o `comment_id` — a pessoa interagiu primeiro (comentou), o que
 * está dentro da política da Meta para mensagem não solicitada. NÃO existe
 * caminho para iniciar conversa com quem não interagiu.
 *
 * Antes de tocar a rede, confere a PERMISSÃO no escopo persistido (fail-closed):
 * sem `instagram_business_manage_messages` concedido, não tenta e devolve
 * `capability` — evitando um erro cru da Meta e dando à UI o motivo certo.
 *
 * NÃO é idempotente por si só: a idempotência é do `CommentDirectLog`
 * (`@@unique([mediaId, commentId])`) + a checagem em `deliverPrivateReply`.
 */
export async function sendPrivateReply(
  credentials: DirectCredentials,
  commentId: string,
  message: string
): Promise<PrivateReplyResult> {
  if (!credentials.igUserId) {
    throw new DirectCapabilityError(
      "no_connection",
      "A conta do Instagram conectada não tem identificador utilizável. Reconecte em Redes Sociais."
    );
  }

  if (!canManageMessages(credentials.scopes)) {
    throw new DirectCapabilityError(
      "capability",
      capabilityMessage("capability"),
      undefined,
      `Escopo ${SCOPE_MANAGE_MESSAGES} ausente em SocialConnection.scopes`
    );
  }

  const url =
    `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(
      credentials.igUserId
    )}/messages` +
    `?access_token=${encodeURIComponent(credentials.accessToken)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: message },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await res.text();
    let data: { message_id?: string; id?: string; error?: Record<string, unknown> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new DirectCapabilityError("api", "Resposta inválida do Instagram.");
    }

    if (!res.ok || data.error) {
      const metaCode = data.error?.code != null ? String(data.error.code) : String(res.status);
      const subcode = data.error?.error_subcode != null ? String(data.error.error_subcode) : "";
      const metaMessage = data.error?.message
        ? String(data.error.message)
        : "Não foi possível enviar a mensagem privada.";
      // Janela fechada / política de mensagem não solicitada: a Meta sinaliza
      // com subcode 2018278/2534014 (message tag) ou code 10. Mapeamos antes do
      // genérico para que a ação do usuário na tela seja a correta.
      if (subcode === "2018278" || subcode === "2534014") {
        throw new DirectCapabilityError("window_closed", capabilityMessage("window_closed"), metaCode, metaMessage);
      }
      const code = capabilityFromMeta(metaCode);
      throw new DirectCapabilityError(code, capabilityMessage(code), metaCode, metaMessage);
    }

    const externalMessageId = data.message_id ?? data.id;
    if (!externalMessageId) {
      throw new DirectCapabilityError("api", "O Instagram não confirmou o envio da mensagem.");
    }

    return { externalMessageId };
  } catch (err) {
    throw toCapabilityError(err);
  }
}

// ================================================================
// LEITURA — conversas e mensagens (só quando a Meta entrega)
// ================================================================

export interface InstagramConversation {
  igConversationId: string;
  participantId: string | null;
  participantUsername: string | null;
  lastMessageAt: Date | null;
  unreadCount: number | null;
  lastMessagePreview: string | null;
}

export interface InstagramMessage {
  igMessageId: string;
  direction: "INBOUND" | "OUTBOUND" | "UNKNOWN";
  text: string | null;
  attachmentType: string | null;
  sentAt: Date | null;
  fromUs: boolean;
}

interface ConversationsPage {
  data?: Array<{
    id?: string;
    updated_time?: string;
    unread_count?: number;
    participants?: { data?: Array<{ id?: string; username?: string; name?: string }> };
    messages?: { data?: Array<{ id?: string; message?: string; created_time?: string }> };
  }>;
  error?: Record<string, unknown>;
}

interface MessagesPage {
  data?: Array<{
    id?: string;
    message?: string;
    created_time?: string;
    from?: { id?: string; username?: string };
    to?: { data?: Array<{ id?: string; username?: string }> };
    attachments?: { data?: Array<{ mime_type?: string; name?: string }> };
  }>;
  error?: Record<string, unknown>;
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lista as conversas REAIS da conta. Sem conexão usável ou sem permissão,
 * devolve lista vazia — quem chama decide se mostra "integração pendente".
 *
 * NÃO lança por falta de dado: só por erro de comunicação, e nesse caso o erro
 * é tipado. Uma conta sem conversa devolve `[]` (não é erro).
 */
export async function listConversations(
  credentials: DirectCredentials,
  opts: { limit?: number } = {}
): Promise<InstagramConversation[]> {
  if (!credentials.igUserId) return [];
  if (!canManageMessages(credentials.scopes)) return [];

  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 50);
  const fields = "id,updated_time,participants,messages.limit(1){id,message,created_time}";
  const url =
    `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(credentials.igUserId)}/conversations` +
    `?fields=${encodeURIComponent(fields)}&limit=${limit}` +
    `&access_token=${encodeURIComponent(credentials.accessToken)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let data: ConversationsPage;
    try {
      data = JSON.parse(text) as ConversationsPage;
    } catch {
      throw new DirectCapabilityError("api", "Resposta inválida do Instagram.");
    }

    if (!res.ok || data.error) {
      const metaCode = data.error?.code != null ? String(data.error.code) : String(res.status);
      const code = capabilityFromMeta(metaCode);
      throw new DirectCapabilityError(
        code,
        capabilityMessage(code),
        metaCode,
        data.error?.message ? String(data.error.message) : "Não foi possível ler as conversas."
      );
    }

    // `participants` traz OS DOIS lados (a própria conta e o contato), sem
    // ordem garantida. Antes pegávamos sempre o primeiro — e a conversa podia
    // ficar com a PRÓPRIA conta como "contato" (resposta manual ia para nós
    // mesmos e a reutilização de conversa pelo webhook não casava).
    const ownIds = ownIdsOf(credentials);
    return (data.data ?? [])
      .filter((c) => typeof c.id === "string" && c.id.length > 0)
      .map((c) => {
        const people = c.participants?.data ?? [];
        const participant =
          people.find((p) => typeof p.id === "string" && !ownIds.includes(p.id)) ??
          (people.length === 1 ? people[0] : undefined);
        const last = c.messages?.data?.[0];
        return {
          igConversationId: c.id as string,
          participantId: participant?.id ?? null,
          participantUsername: participant?.username ?? null,
          lastMessageAt: readDate(last?.created_time ?? c.updated_time),
          unreadCount: typeof c.unread_count === "number" ? c.unread_count : null,
          lastMessagePreview: typeof last?.message === "string" ? last.message : null,
        };
      });
  } catch (err) {
    throw toCapabilityError(err);
  }
}

/**
 * Lista as mensagens REAIS de uma conversa, na ordem que a Meta devolve.
 * Mesma política de `listConversations`: sem permissão, `[]`.
 */
export async function listMessages(
  credentials: DirectCredentials,
  igConversationId: string,
  opts: { limit?: number } = {}
): Promise<InstagramMessage[]> {
  if (!canManageMessages(credentials.scopes)) return [];

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const fields = "id,message,created_time,from,to,attachments";
  const url =
    `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igConversationId)}/messages` +
    `?fields=${encodeURIComponent(fields)}&limit=${limit}` +
    `&access_token=${encodeURIComponent(credentials.accessToken)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let data: MessagesPage;
    try {
      data = JSON.parse(text) as MessagesPage;
    } catch {
      throw new DirectCapabilityError("api", "Resposta inválida do Instagram.");
    }

    if (!res.ok || data.error) {
      const metaCode = data.error?.code != null ? String(data.error.code) : String(res.status);
      const code = capabilityFromMeta(metaCode);
      throw new DirectCapabilityError(
        code,
        capabilityMessage(code),
        metaCode,
        data.error?.message ? String(data.error.message) : "Não foi possível ler as mensagens."
      );
    }

    // `from.id` da própria conta é o IG_ID; conexões antigas só guardavam o
    // `me.id`. Comparamos com todos os IDs conhecidos da conta.
    const ownIds = ownIdsOf(credentials);
    return (data.data ?? [])
      .filter((m) => typeof m.id === "string" && m.id.length > 0)
      .map((m) => {
        const fromId = m.from?.id ?? null;
        const fromUs = fromId != null && ownIds.includes(fromId);
        const direction: InstagramMessage["direction"] =
          fromId == null ? "UNKNOWN" : fromUs ? "OUTBOUND" : "INBOUND";
        const attachment = m.attachments?.data?.[0];
        return {
          igMessageId: m.id as string,
          direction,
          text: typeof m.message === "string" ? m.message : null,
          attachmentType: attachment?.mime_type ?? attachment?.name ?? null,
          sentAt: readDate(m.created_time),
          fromUs,
        };
      });
  } catch (err) {
    throw toCapabilityError(err);
  }
}

/**
 * Envia uma mensagem de TEXTO numa conversa existente (resposta manual).
 *
 * Só é chamado depois da aprovação humana do painel de conversa. Dentro da
 * janela de 24h, `recipient.id` (IGSID do contato) é o formato correto. Fora da
 * janela, a Meta recusa — e devolvemos `window_closed` em vez de insistir.
 */
export async function sendDirectText(
  credentials: DirectCredentials,
  recipientId: string,
  message: string
): Promise<PrivateReplyResult> {
  if (!credentials.igUserId) {
    throw new DirectCapabilityError(
      "no_connection",
      "A conta do Instagram conectada não tem identificador utilizável. Reconecte em Redes Sociais."
    );
  }
  if (!canManageMessages(credentials.scopes)) {
    throw new DirectCapabilityError("capability", capabilityMessage("capability"));
  }

  const url =
    `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(credentials.igUserId)}/messages` +
    `?access_token=${encodeURIComponent(credentials.accessToken)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await res.text();
    let data: { message_id?: string; id?: string; error?: Record<string, unknown> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new DirectCapabilityError("api", "Resposta inválida do Instagram.");
    }

    if (!res.ok || data.error) {
      const metaCode = data.error?.code != null ? String(data.error.code) : String(res.status);
      const subcode = data.error?.error_subcode != null ? String(data.error.error_subcode) : "";
      const metaMessage = data.error?.message ? String(data.error.message) : "Não foi possível enviar a mensagem.";
      if (subcode === "2018278" || subcode === "2534014") {
        throw new DirectCapabilityError("window_closed", capabilityMessage("window_closed"), metaCode, metaMessage);
      }
      const code = capabilityFromMeta(metaCode);
      throw new DirectCapabilityError(code, capabilityMessage(code), metaCode, metaMessage);
    }

    const externalMessageId = data.message_id ?? data.id;
    if (!externalMessageId) {
      throw new DirectCapabilityError("api", "O Instagram não confirmou o envio da mensagem.");
    }
    return { externalMessageId };
  } catch (err) {
    throw toCapabilityError(err);
  }
}
