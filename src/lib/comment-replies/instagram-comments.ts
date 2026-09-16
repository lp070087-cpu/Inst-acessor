import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  INSTAGRAM_GRAPH_BASE,
  INSTAGRAM_GRAPH_VERSION,
  InstagramApiError,
} from "@/lib/integrations/instagram/client";
import type { EligibleMedia, EligibleComment } from "./types";

/**
 * LEITURA E ENVIO DE COMENTÁRIOS DO INSTAGRAM
 * ===========================================
 * Usa a MESMA conexão social já existente (`SocialConnection` + token
 * criptografado). NÃO existe segundo OAuth, nem segundo fluxo de autorização.
 *
 * Hosts: `https://graph.instagram.com` (Instagram Business Login), os mesmos já
 * usados por `src/lib/integrations/instagram/client.ts`. Este módulo REUTILIZA
 * as constantes de host/versão daquele cliente e apenas ADICIONA os endpoints
 * de comentários — não substitui nem altera a integração existente.
 *
 * Escopos já solicitados no OAuth atual (`oauth.ts`):
 *   instagram_business_basic
 *   instagram_business_manage_comments   ← necessário para ler/responder
 *   instagram_business_manage_messages
 *   instagram_business_manage_insights
 *   instagram_business_content_publish
 *
 * Se a Meta ainda não tiver concedido o acesso avançado a
 * `instagram_business_manage_comments`, a API devolve erro de permissão. O
 * código NÃO contorna isso: devolve um erro TIPADO (`CAPABILITY`) que a UI
 * mostra com o motivo real, e a arquitetura continua pronta para quando a
 * permissão for concedida.
 *
 * O token NUNCA sai daqui: é descriptografado no servidor e usado só no header
 * da requisição. Nada de token em resposta, log ou payload para o cliente.
 */

const FETCH_TIMEOUT_MS = 20000;

/** Erro tipado — a UI distingue "sem conexão" de "sem permissão". */
export class CommentCapabilityError extends Error {
  code: "no_connection" | "not_connected" | "capability" | "rate_limit" | "api";
  metaCode?: string;
  constructor(
    code: CommentCapabilityError["code"],
    message: string,
    metaCode?: string
  ) {
    super(message);
    this.name = "CommentCapabilityError";
    this.code = code;
    this.metaCode = metaCode;
  }
}

export interface CommentCredentials {
  connectionId: string;
  igUserId: string | null;
  accessToken: string;
}

/**
 * Carrega a conexão do Instagram do usuário e devolve o token em claro
 * (somente no servidor). Lança `CommentCapabilityError` quando não há conexão
 * utilizável — nunca devolve um objeto parcial silencioso.
 */
export async function loadCommentCredentials(
  userId: string
): Promise<CommentCredentials> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
    include: { igProfiles: true },
  });

  if (!connection?.tokenEncrypted) {
    throw new CommentCapabilityError(
      "no_connection",
      "Conecte seu Instagram em Redes Sociais para usar Respostas Inteligentes."
    );
  }

  if (connection.status !== "CONNECTED") {
    throw new CommentCapabilityError(
      "not_connected",
      "A conexão com o Instagram não está ativa. Reconecte em Redes Sociais."
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.tokenEncrypted);
  } catch {
    throw new CommentCapabilityError(
      "not_connected",
      "Não foi possível ler a credencial armazenada. Reconecte o Instagram."
    );
  }

  return {
    connectionId: connection.id,
    igUserId: connection.igProfiles?.igAccountId ?? connection.externalAccountId ?? null,
    accessToken,
  };
}

/** Classifica um erro da API do Instagram em código de capacidade. */
function toCapabilityError(err: unknown): CommentCapabilityError {
  if (err instanceof CommentCapabilityError) return err;

  if (err instanceof InstagramApiError) {
    const metaCode = String(err.code ?? "");
    // 190 = token inválido/expirado · 10/200 = permissão ausente · 4/17/613 = rate limit
    if (metaCode === "190") {
      return new CommentCapabilityError(
        "not_connected",
        "A conexão com o Instagram expirou. Reconecte para continuar.",
        metaCode
      );
    }
    if (metaCode === "10" || metaCode === "200" || metaCode === "3") {
      return new CommentCapabilityError(
        "capability",
        "A API do Instagram não autorizou a leitura/resposta de comentários para esta conta. " +
          "Isso normalmente indica que o acesso avançado ao escopo " +
          "instagram_business_manage_comments ainda não foi concedido ao app.",
        metaCode
      );
    }
    if (metaCode === "4" || metaCode === "17" || metaCode === "613") {
      return new CommentCapabilityError(
        "rate_limit",
        "O Instagram limitou temporariamente as requisições. As respostas foram pausadas.",
        metaCode
      );
    }
    return new CommentCapabilityError("api", err.message, metaCode);
  }

  return new CommentCapabilityError(
    "api",
    err instanceof Error ? err.message : "Falha ao falar com a API do Instagram."
  );
}

/**
 * Publicações elegíveis (posts, carrosséis e Reels).
 *
 * Lê do banco (`InstagramMedia`), que já é populado pelo sync existente — evita
 * chamadas extras e rate limit. Isso é dado REAL já sincronizado, não inventado.
 */
export async function listEligibleMedia(userId: string): Promise<EligibleMedia[]> {
  const rows = await prisma.instagramMedia.findMany({
    where: { userId },
    orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { _count: { select: { comments: true } } },
  });

  return rows.map((row) => ({
    id: row.igMediaId,
    mediaType: row.mediaType ?? "IMAGE",
    // `mediaProductType` é usado como pista de formato (Reel/Feed). Só é
    // preenchido quando a API informa — sem valor não inventamos "FEED".
    mediaProductType: row.mediaProductType ?? null,
    caption: row.caption,
    thumbnailUrl: row.thumbnailUrl ?? row.mediaUrl,
    permalink: row.permalink,
    timestamp: row.timestamp ? row.timestamp.toISOString() : null,
    commentsCount: row.commentsCount,
    // Quantos comentários REAIS temos sincronizados para esta publicação.
    syncedCommentsCount: row._count.comments,
  }));
}

/**
 * Comentários REAIS já sincronizados de uma publicação, lidos do banco.
 *
 * Antes desta função a única forma de a tela ver comentários era chamar a API
 * na hora (`listComments`) — o que falha quando o app não tem o escopo
 * aprovado. Aqui devolvemos o que foi de fato sincronizado; a API continua
 * sendo usada apenas no momento de responder.
 */
export async function listStoredComments(
  userId: string,
  igMediaId: string
): Promise<EligibleComment[]> {
  const media = await prisma.instagramMedia.findFirst({
    where: { userId, igMediaId },
    select: { id: true },
  });
  if (!media) return [];

  const rows = await prisma.instagramComment.findMany({
    where: { userId, mediaId: media.id },
    orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return rows.map((row) => ({
    commentId: row.igCommentId,
    mediaId: igMediaId,
    username: row.authorUsername ?? "",
    text: row.text ?? "",
    timestamp: row.timestamp ? row.timestamp.toISOString() : null,
  }));
}

/** Quantos comentários reais existem sincronizados para o usuário. */
export async function countStoredComments(userId: string): Promise<number> {
  return prisma.instagramComment.count({ where: { userId } });
}

interface IgCommentNode {
  id: string;
  text?: string | null;
  username?: string | null;
  timestamp?: string | null;
  from?: { id?: string; username?: string };
}

/**
 * Lê os comentários de uma publicação.
 * GET {media-id}/comments?fields=id,text,username,timestamp
 */
export async function listComments(
  mediaId: string,
  credentials: CommentCredentials
): Promise<EligibleComment[]> {
  const url =
    `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(mediaId)}/comments` +
    `?fields=${encodeURIComponent("id,text,username,timestamp,from")}` +
    `&access_token=${encodeURIComponent(credentials.accessToken)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await res.text();
    let data: { data?: IgCommentNode[]; error?: Record<string, unknown> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new CommentCapabilityError("api", "Resposta inválida do Instagram.");
    }

    if (!res.ok || data.error) {
      const metaCode = String(data.error?.code ?? res.status);
      throw new CommentCapabilityError(
        metaCode === "190" ? "not_connected" : metaCode === "10" || metaCode === "200" || metaCode === "3" ? "capability" : "api",
        String(data.error?.message ?? "Não foi possível ler os comentários."),
        metaCode
      );
    }

    return (data.data ?? []).map((node) => ({
      commentId: node.id,
      mediaId,
      // `username` é o campo disponível no Instagram Business Login; `from` é
      // usado apenas como reserva quando existir.
      username: node.username ?? node.from?.username ?? "",
      text: node.text ?? "",
      timestamp: node.timestamp ?? null,
    }));
  } catch (err) {
    throw toCapabilityError(err);
  }
}

/**
 * Responde publicamente um comentário.
 * POST {comment-id}/replies?message=...
 *
 * O texto vai como parâmetro de formulário no corpo (nunca na URL, para não
 * vazar a resposta em logs de proxy).
 *
 * @returns id da resposta criada no Instagram.
 */
export async function replyToComment(
  commentId: string,
  message: string,
  credentials: CommentCredentials
): Promise<{ externalReplyId: string }> {
  const url = `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(commentId)}/replies`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message,
        access_token: credentials.accessToken,
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await res.text();
    let data: { id?: string; error?: Record<string, unknown> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new CommentCapabilityError("api", "Resposta inválida do Instagram.");
    }

    if (!res.ok || data.error || !data.id) {
      const metaCode = String(data.error?.code ?? res.status);
      throw new CommentCapabilityError(
        metaCode === "190"
          ? "not_connected"
          : metaCode === "10" || metaCode === "200" || metaCode === "3"
            ? "capability"
            : metaCode === "4" || metaCode === "17" || metaCode === "613"
              ? "rate_limit"
              : "api",
        String(data.error?.message ?? "Não foi possível publicar a resposta."),
        metaCode
      );
    }

    return { externalReplyId: data.id };
  } catch (err) {
    throw toCapabilityError(err);
  }
}

/**
 * Verificação de capacidade: tenta ler os comentários de até 3 publicações.
 * Serve para a UI/relatório dizerem EXATAMENTE o que está bloqueado no Meta,
 * em vez de assumir. Nunca envia nada.
 */
export async function checkCommentCapability(
  credentials: CommentCredentials,
  mediaIds: string[]
): Promise<{ ok: boolean; checked: number; error?: string; code?: string }> {
  let checked = 0;
  for (const mediaId of mediaIds.slice(0, 3)) {
    try {
      await listComments(mediaId, credentials);
      checked++;
    } catch (err) {
      const info = toCapabilityError(err);
      // "Sem comentários" não é falha de permissão — só segue adiante.
      if (info.code === "api" && /no comments/i.test(info.message)) {
        checked++;
        continue;
      }
      return { ok: false, checked, error: info.message, code: info.code };
    }
  }
  return { ok: true, checked };
}
