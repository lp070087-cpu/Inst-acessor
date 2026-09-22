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

/**
 * Códigos de falha da leitura/envio de comentários.
 *
 * `media_not_found` existe porque um caso era invisível: a publicação saiu do
 * ar ou pertence a outra conta, a Meta devolve 400/`code 100`, e antes isso
 * caía no genérico `api` — a UI mostrava o mesmo aviso de falha passageira,
 * sem nunca dizer que a MIDIA era o problema. São situações que exigem ações
 * diferentes do usuário, então precisam de códigos diferentes.
 */
export type CommentCapabilityCode =
  | "no_connection"
  | "not_connected"
  | "capability"
  | "media_not_found"
  | "rate_limit"
  | "api";

/** Erro tipado — a UI distingue "sem conexão" de "sem permissão". */
export class CommentCapabilityError extends Error {
  code: CommentCapabilityCode;
  metaCode?: string;
  /** Motivo REAL devolvido pela Meta (nunca contém o token). */
  metaMessage?: string;
  constructor(
    code: CommentCapabilityCode,
    message: string,
    metaCode?: string,
    metaMessage?: string
  ) {
    super(message);
    this.name = "CommentCapabilityError";
    this.code = code;
    this.metaCode = metaCode;
    this.metaMessage = metaMessage;
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

/**
 * Traduz um código de erro da Meta no código do produto.
 *
 * Tabela ÚNICA — antes esta classificação estava escrita três vezes (aqui, em
 * `listComments` e em `replyToComment`), e as três listas eram diferentes: cada
 * caminho tratava um subconjunto. `rate_limit` existia na classificação geral e
 * na resposta, mas NÃO na leitura; `media_not_found` não existia em lugar
 * nenhum. Duas cópias divergentes de uma mesma regra é o defeito, não o detalhe.
 *
 * Códigos da Meta:
 *   190        → token inválido/expirado
 *   10/200/3   → permissão ausente
 *   4/17/613   → rate limit
 *   100/33/24  → objeto inexistente ou sem acesso (mídia fora do ar/outra conta)
 *   803        → objeto não encontrado no host
 *   400/404    → o cliente já usa o STATUS HTTP como código quando a Meta não
 *                manda `code` (ver `graphGet`); aqui isso vira "mídia não
 *                encontrada" em vez do genérico `api`.
 */
function capabilityFromMeta(rawCode: string | number | null | undefined): CommentCapabilityCode {
  const code = rawCode == null ? "" : String(rawCode);
  if (code === "190") return "not_connected";
  if (code === "10" || code === "200" || code === "3") return "capability";
  if (code === "4" || code === "17" || code === "613") return "rate_limit";
  if (code === "100" || code === "33" || code === "24" || code === "803") return "media_not_found";
  if (code === "400" || code === "404") return "media_not_found";
  return "api";
}

/** Mensagem do produto para cada código — a UI mostra exatamente esta frase. */
function capabilityMessage(code: CommentCapabilityCode, metaMessage?: string): string {
  switch (code) {
    case "not_connected":
      return "A conexão com o Instagram expirou. Reconecte em Redes Sociais para continuar.";
    case "capability":
      return (
        "A API do Instagram não autorizou a leitura/resposta de comentários para esta conta. " +
        "Isso normalmente indica que o acesso avançado ao escopo " +
        "instagram_business_manage_comments ainda não foi concedido ao app."
      );
    case "media_not_found":
      return (
        "O Instagram não reconheceu esta publicação para a conta conectada. " +
        "Ela pode ter sido apagada, arquivada ou pertencer a outra conta — " +
        "sincronize a conta e tente novamente."
      );
    case "rate_limit":
      return "O Instagram limitou temporariamente as requisições. Tente novamente em alguns minutos.";
    case "no_connection":
      return "Conecte seu Instagram em Redes Sociais para usar Respostas Inteligentes.";
    default:
      // O motivo REAL da Meta vem primeiro; a frase do produto só o substitui
      // quando a Meta não mandou nada. Nada de "algo deu errado".
      return metaMessage?.trim() || "Falha ao falar com a API do Instagram.";
  }
}

/**
 * Versões expostas para conferência por execução.
 * Mesmo padrão de `__remainingUntil` em `promo-countdown.tsx`: a regra é pura e
 * precisa poder ser provada por um script, sem subir servidor nem banco.
 */
export const __capabilityFromMeta = capabilityFromMeta;
export const __capabilityMessage = capabilityMessage;

/** Classifica um erro da API do Instagram em código de capacidade. */
function toCapabilityError(err: unknown): CommentCapabilityError {
  if (err instanceof CommentCapabilityError) return err;

  if (err instanceof InstagramApiError) {
    const metaCode = err.code == null ? "" : String(err.code);
    const code = capabilityFromMeta(metaCode);
    // Timeout/rede tem código próprio (`TIMEOUT`/`NETWORK`) e continua `api` —
    // `capabilityFromMeta` devolve `api` e a mensagem da Meta é preservada.
    return new CommentCapabilityError(
      code,
      capabilityMessage(code, err.message),
      metaCode || undefined,
      err.message
    );
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

/**
 * PERSISTE os comentários lidos da API em `InstagramComment`.
 *
 * POR QUE ISSO EXISTE: antes, os comentários só eram gravados pelo sync de
 * Redes Sociais (que lê um número limitado de publicações e depende da Meta
 * liberar o escopo naquele momento). A análise ao vivo (`analyzeMedia`) lia os
 * comentários, usava-os para gerar sugestões e DESCARTAVA — então a publicação
 * seguia com `syncedCommentsCount = 0` e o card continuava mostrando só a
 * contagem declarada pela Meta. O resultado era a contradição vista em
 * produção: o card dizia "5 comentários" e a tela dizia "nenhum comentário".
 *
 * Agora toda leitura bem-sucedida deixa rastro no banco: a análise manual passa
 * a funcionar para comentários que já existiam (independente do webhook), e o
 * que o card mostra e o que a tela lista vêm da MESMA origem.
 *
 * Idempotente: `InstagramComment.igCommentId` é `@unique`, então reprocessar a
 * mesma publicação atualiza (não duplica) os comentários já gravados.
 *
 * @returns quantos comentários foram gravados/atualizados.
 */
export async function persistComments(
  userId: string,
  igMediaId: string,
  comments: EligibleComment[]
): Promise<number> {
  if (comments.length === 0) return 0;

  // O `mediaId` de `InstagramComment` é a FK INTERNA — precisa do id do banco,
  // não do igMediaId da Meta (usar o id externo aqui gravava órfão/erro).
  const media = await prisma.instagramMedia.findFirst({
    where: { userId, igMediaId },
    select: { id: true },
  });
  if (!media) return 0;

  let written = 0;
  for (const comment of comments) {
    const timestamp = comment.timestamp ? new Date(comment.timestamp) : null;
    // `new Date("lixo")` gera Invalid Date — gravaríamos um valor impossível.
    const safeTimestamp =
      timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
    const authorUsername = comment.username || null;

    await prisma.instagramComment.upsert({
      where: { igCommentId: comment.commentId },
      create: {
        userId,
        mediaId: media.id,
        igCommentId: comment.commentId,
        authorUsername,
        text: comment.text || null,
        timestamp: safeTimestamp,
        syncedAt: new Date(),
      },
      update: {
        // Só reescrevemos o que é atributo do comentário; `isOwn`/`repliesCount`
        // (que o sync pode ter preenchido) ficam preservados.
        authorUsername,
        text: comment.text || null,
        timestamp: safeTimestamp,
        syncedAt: new Date(),
      },
    });
    written++;
  }

  return written;
}

interface IgCommentNode {
  id: string;
  text?: string | null;
  username?: string | null;
  timestamp?: string | null;
  from?: { id?: string; username?: string };
}

/** Página de comentários devolvida pela Meta (com o cursor de continuação). */
interface IgCommentPage {
  data?: IgCommentNode[];
  paging?: { next?: string; cursors?: { after?: string } };
  error?: Record<string, unknown>;
}

/** Teto de páginas para não transformar uma leitura em varredura infinita. */
const MAX_COMMENT_PAGES = 10;
/** Comentários por página pedidos à Meta (máximo aceito é 100). */
export const COMMENTS_PAGE_SIZE = 50;

/**
 * Sinais da leitura ao vivo, devolvidos ao chamador quando ele pedir.
 *
 * `truncated` é o caso que faltava: quando a publicação tem mais comentários do
 * que `MAX_COMMENT_PAGES × COMMENTS_PAGE_SIZE`, a leitura para no teto. Sem este
 * sinal, uma lista incompleta era indistinguível de uma lista completa — o
 * usuário via "N de M" sem saber que existiam mais.
 */
export interface ListCommentsMeta {
  /** Quantas páginas foram realmente lidas. */
  pages?: number;
  /** A leitura parou no teto de páginas: ainda havia continuação. */
  truncated?: boolean;
  /** Teto aplicado nesta leitura (diagnóstico; ver `MAX_COMMENT_PAGES`). */
  pageLimit?: number;
  /** Id do host que respondeu (para diagnóstico, sem credencial). */
  host?: string;
}

/**
 * Lê os comentários de uma publicação.
 * GET {media-id}/comments?fields=id,text,username,timestamp,from&limit=N
 *
 * PAGINAÇÃO: a Meta devolve no máximo `limit` nós por resposta. Sem seguir
 * `paging.next`, uma publicação com mais comentários que o limite parecia ter
 * apenas os primeiros — e o total nunca batia com o `comments_count` do card.
 * Aqui seguimos o cursor até acabar (ou até `MAX_COMMENT_PAGES`).
 *
 * O token vai na query string, exatamente como no resto da integração
 * (`integrations/instagram/client.ts`) — o `paging.next` devolvido pela Meta já
 * traz o token embutido, então as páginas seguintes continuam autorizadas.
 *
 * @param meta opcional: recebe páginas lidas e se a leitura foi truncada.
 */
export async function listComments(
  mediaId: string,
  credentials: CommentCredentials,
  meta?: ListCommentsMeta
): Promise<EligibleComment[]> {
  const fields = encodeURIComponent("id,text,username,timestamp,from");
  const base = `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(mediaId)}/comments`;
  const first =
    `${base}?fields=${fields}&limit=${COMMENTS_PAGE_SIZE}` +
    `&access_token=${encodeURIComponent(credentials.accessToken)}`;

  const collected: IgCommentNode[] = [];
  let next: string | null = first;
  let pages = 0;
  let truncated = false;

  try {
    for (let page = 0; page < MAX_COMMENT_PAGES && next; page++) {
      const res: Response = await fetch(next, {
        method: "GET",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });

      const text = await res.text();
      let data: IgCommentPage;
      try {
        data = JSON.parse(text) as IgCommentPage;
      } catch {
        throw new CommentCapabilityError("api", "Resposta inválida do Instagram.");
      }

      if (!res.ok || data.error) {
        // O STATUS HTTP também entra na classificação: o host pode responder
        // 400/404 sem mandar `code`, e antes isso virava o genérico `api` —
        // indistinguível de uma queda de rede.
        const metaCode = data.error?.code != null ? String(data.error.code) : String(res.status);
        const code = capabilityFromMeta(metaCode);
        const metaMessage = data.error?.message
          ? String(data.error.message)
          : "Não foi possível ler os comentários.";
        throw new CommentCapabilityError(
          code,
          capabilityMessage(code, metaMessage),
          metaCode,
          metaMessage
        );
      }

      pages++;
      if (data.data?.length) collected.push(...data.data);

      // Duas formas de continuação: `paging.next` (URL pronta, com token) ou
      // apenas `paging.cursors.after` (cursor). A segunda era ignorada — a
      // paginação parava na primeira página e o total ficava menor que o
      // `comments_count` sem nenhum sinal de que faltava coisa.
      if (data.paging?.next) {
        next = data.paging.next;
      } else if (data.paging?.cursors?.after && data.data?.length) {
        next =
          `${base}?fields=${fields}&limit=${COMMENTS_PAGE_SIZE}` +
          `&after=${encodeURIComponent(data.paging.cursors.after)}` +
          `&access_token=${encodeURIComponent(credentials.accessToken)}`;
      } else {
        next = null;
      }
    }

    // Sobrou `next` e o laço terminou pelo TETO (não por esgotar a lista).
    truncated = next != null;

    if (meta) {
      meta.pages = pages;
      meta.truncated = truncated;
      meta.pageLimit = MAX_COMMENT_PAGES;
      meta.host = INSTAGRAM_GRAPH_BASE;
    }

    return collected.map((node) => ({
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
      const metaCode = data.error?.code != null ? String(data.error.code) : String(res.status);
      const code = capabilityFromMeta(metaCode);
      const metaMessage = data.error?.message
        ? String(data.error.message)
        : "Não foi possível publicar a resposta.";
      throw new CommentCapabilityError(
        code,
        capabilityMessage(code, metaMessage),
        metaCode,
        metaMessage
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
