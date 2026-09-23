import { graphGet } from "./client";
import { InstagramApiError } from "./client";
import type {
  InstagramAccountInfo,
  InstagramCommentData,
  InstagramMediaMetricNode,
  InstagramMediaNode,
  InstagramSyncData,
  InstagramUserNode,
} from "./types";

/**
 * Coleta e normalização das métricas do Instagram.
 * Usa APENAS os campos que a API realmente retorna.
 * Campos indisponíveis → null.
 *
 * Fluxo Instagram Business Login: a conta autorizada É a conta profissional do
 * Instagram. Consultamos o nó `me` diretamente — NÃO existe (nem é necessário)
 * o caminho `me?fields=instagram_business_account`, que pertence ao fluxo de
 * Facebook Login com Página vinculada.
 */

/** Nó `me` do Instagram Business Login. */
interface InstagramMeNode {
  /** ID no escopo do app (usado para identificar a conta do usuário). */
  user_id?: string;
  /** ID do usuário do Instagram (usado nos endpoints de mídia/insights). */
  id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
}

/**
 * Obtém a conta Instagram autenticada + dados básicos do perfil.
 *
 * Campos solicitados (todos cobertos por `instagram_business_basic`):
 *   id, user_id, username, name, account_type, profile_picture_url
 *
 * O `account_type` vem da própria API (`BUSINESS`, `CREATOR` ou
 * `MEDIA_CREATOR`) — nunca é fixado em código.
 */
export async function getInstagramAccountInfo(
  accessToken: string
): Promise<InstagramAccountInfo> {
  const me = await graphGet<InstagramMeNode>(
    "me?fields=id,user_id,username,name,account_type,profile_picture_url",
    accessToken
  );

  if (!me.id) {
    throw new InstagramApiError(
      "A conta autorizada não retornou um perfil do Instagram válido.",
      "NOT_IG_BUSINESS"
    );
  }

  return {
    id: me.id,
    username: me.username ?? "",
    name: me.name,
    accountType: normalizeAccountType(me.account_type),
    profilePictureUrl: me.profile_picture_url,
  };
}

/**
 * Normaliza o tipo de conta informado pela API.
 * A API pode devolver `BUSINESS`, `CREATOR` ou `MEDIA_CREATOR`. Valores
 * desconhecidos caem em `PROFESSIONAL` (descrição honesta: é uma conta
 * profissional, mas o tipo exato não foi informado).
 */
export function normalizeAccountType(raw: unknown): string {
  const value = typeof raw === "string" ? raw.toUpperCase().trim() : "";
  if (value === "BUSINESS") return "BUSINESS";
  if (value === "CREATOR") return "CREATOR";
  if (value === "MEDIA_CREATOR") return "CREATOR";
  return value || "PROFESSIONAL";
}

/** Obtém o perfil completo do usuário do Instagram. */
export async function getInstagramUser(
  igUserId: string,
  accessToken: string
): Promise<InstagramUserNode> {
  return graphGet<InstagramUserNode>(
    `${igUserId}?fields=id,username,name,followers_count,follows_count,media_count,profile_picture_url,biography`,
    accessToken
  );
}

/**
 * Formato REAL de resposta de `/insights` (conta e mídia).
 * A API devolve uma LISTA de métricas — cada item traz o próprio `name` e o
 * valor em `values[]` (série) ou em `total_value` (total agregado). NUNCA os
 * nomes das métricas no topo do objeto, que era o erro da versão anterior.
 */
interface InsightsEnvelope {
  data?: {
    name?: string;
    period?: string;
    values?: { value?: number }[];
    total_value?: { value?: number };
  }[];
}

/** Extrai o valor de um item de insight (série `values[]` ou `total_value`). */
function readInsightValue(item: {
  values?: { value?: number }[];
  total_value?: { value?: number };
}): number | null {
  const total = item.total_value?.value;
  if (typeof total === "number") return total;
  const values = item.values ?? [];
  const latest = values[values.length - 1]?.value;
  return typeof latest === "number" ? latest : null;
}

/**
 * Obtém insights da conta (janela configurável).
 *
 * A chamada é DEGRADANTE por natureza (ver catch): métrica indisponível ou
 * recusada → `null`, sem derrubar o sync. `null` significa "a fonte não
 * forneceu" — NUNCA é convertido em zero.
 *
 * @param since timestamp inicial (opcional)
 */
export async function getAccountInsights(
  igUserId: string,
  accessToken: string,
  since?: number
): Promise<{ reach?: number | null; impressions?: number | null; profileViews?: number | null }> {
  // Período máximo suportado pela API é "30 days". Usamos janela diária como
  // padrão para os cards atuais (reach/impressions do último dia disponível).
  const period = "day";
  const metric = "reach,impressions,profile_views";

  try {
    const data = await graphGet<InsightsEnvelope>(
      `${igUserId}/insights?metric=${metric}&period=${period}${
        since ? `&since=${since}` : ""
      }`,
      accessToken
    );

    const result: { reach?: number | null; impressions?: number | null; profileViews?: number | null } = {
      reach: null,
      impressions: null,
      profileViews: null,
    };

    for (const item of data.data ?? []) {
      const value = readInsightValue(item);
      if (item.name === "reach") result.reach = value;
      if (item.name === "impressions") result.impressions = value;
      if (item.name === "profile_views") result.profileViews = value;
    }

    return result;
  } catch (err) {
    // Insights podem não estar disponíveis (permissão/escopo). Não derruba o sync.
    if (err instanceof InstagramApiError) {
      console.warn("[instagram-metrics] insights indisponíveis", err.code ?? "n/a");
      return { reach: null, impressions: null, profileViews: null };
    }
    throw err;
  }
}

/** Campos de mídia sempre solicitados ao nó `media`. */
const MEDIA_FIELDS =
  "id,media_type,media_product_type,permalink,caption,timestamp,like_count,comments_count,media_url,thumbnail_url";

/** Teto de segurança de páginas seguidas de `paging.next`. */
const MAX_MEDIA_PAGES = 10;

/**
 * Obtém a lista de mídias recentes da conta, SEGUINDO a paginação oficial.
 *
 * A versão anterior fazia uma única chamada com `limit=50` e ignorava
 * `paging.next` — contas com mais de 50 publicações perdiam silenciosamente
 * todo o histórico anterior. Aqui seguimos o cursor até o fim (com teto de
 * segurança) para que a publicação real sincronizada seja a lista real.
 */
export async function getRecentMedia(
  igUserId: string,
  accessToken: string,
  limit = 50
): Promise<InstagramMediaNode[]> {
  const all: InstagramMediaNode[] = [];
  let path: string | null = `${igUserId}/media?fields=${MEDIA_FIELDS}&limit=${limit}`;

  for (let page = 0; page < MAX_MEDIA_PAGES && path; page++) {
    const data: { data?: InstagramMediaNode[]; paging?: { next?: string } } =
      await graphGet<{ data?: InstagramMediaNode[]; paging?: { next?: string } }>(
        path,
        accessToken
      );

    all.push(...(data.data ?? []));

    const next = data.paging?.next;
    if (!next) break;

    // `paging.next` vem como URL ABSOLUTA e já contém o token. Extraímos apenas
    // o caminho relativo (path + query sem access_token) — o token é reanexado
    // pelo `graphGet`, então nunca duplicamos nem logamos credencial.
    path = toRelativeGraphPath(next);
  }

  return all;
}

/**
 * Converte uma URL absoluta de `paging.next` no caminho relativo aceito por
 * `graphGet`. Devolve `null` quando a URL não pertence ao host da Graph API
 * (fail-closed: nunca seguimos um destino arbitrário).
 */
function toRelativeGraphPath(next: string): string | null {
  try {
    const url = new URL(next);
    if (!url.hostname.endsWith("instagram.com")) return null;
    url.searchParams.delete("access_token");
    const query = url.searchParams.toString();
    const path = url.pathname.replace(/^\/+/, "").replace(/^v\d+\.\d+\//, "");
    return query ? `${path}?${query}` : path;
  } catch {
    return null;
  }
}

/**
 * Obtém métricas detalhadas de uma mídia específica.
 *
 * A API devolve `{ data: [{ name, values[] | total_value }] }`. A versão
 * anterior lia `data.reached` / `data.shares` direto no topo — campos que não
 * existem nesse endpoint. Resultado: TODA métrica era gravada `null`.
 * Agora mapeamos pelo `name` de cada item da lista.
 *
 * Métricas recusadas para o tipo de mídia (ex.: `video_views` num carrossel)
 * ficam `null` — ausência, não zero.
 */
/**
 * Métricas SEGURAS — válidas para QUALQUER tipo de mídia.
 *
 * `video_views` e `video_view_time` NÃO entram aqui, e o motivo é um defeito
 * real: pedir uma métrica que o tipo de mídia não suporta (ex.: métrica de
 * vídeo num post de imagem) faz a Meta recusar a REQUISIÇÃO INTEIRA. Como o
 * erro era engolido, `InstagramMediaMetric` ficava vazia e TODA métrica virava
 * `null` — inclusive alcance e curtidas, que existiam. Uma métrica inválida
 * apagava o card inteiro.
 */
export const MEDIA_METRICS_CORE = "reach,impressions,shares,saves,comments,likes";

/**
 * Métricas adicionais de vídeo/Reel, pedidas em chamada SEPARADA.
 *
 * ATENÇÃO — NOMES NÃO VERIFICADOS CONTRA A DOCUMENTAÇÃO OFICIAL. O ambiente em
 * que este código foi escrito não tem saída de rede, então os nomes vieram do
 * comportamento observado no código (o autor já tentava `plays` como reserva de
 * `video_views`, sinal de que a renomeação era conhecida) e não de consulta à
 * doc. Por isso eles são pedidos à parte e com recuo: se a Meta recusar, o
 * prejuízo são as métricas de vídeo — nunca alcance, curtidas ou salvamentos.
 * Classificação: IMPLEMENTADO — AGUARDA VALIDAÇÃO META REAL.
 */
export const MEDIA_METRICS_VIDEO = "plays,video_views,video_view_time,ig_reels_avg_watch_time";

/**
 * Lê um lote de métricas do `/insights` de uma mídia e devolve o mapa
 * `nome → valor`. Lança `InstagramApiError` quando a Meta recusa.
 */
async function fetchInsightBatch(
  mediaId: string,
  accessToken: string,
  metricList: string
): Promise<Map<string, number | null>> {
  const data = await graphGet<InsightsEnvelope>(
    `${mediaId}/insights?metric=${metricList}`,
    accessToken
  );

  const byName = new Map<string, number | null>();
  for (const item of data.data ?? []) {
    if (item.name) byName.set(item.name, readInsightValue(item));
  }
  return byName;
}

/**
 * Obtém métricas detalhadas de uma mídia específica.
 *
 * Os dois grupos são buscados de forma INDEPENDENTE (ver `MEDIA_METRICS_CORE` e
 * `MEDIA_METRICS_VIDEO`): a falha de um não pode zerar o outro. Métrica que a
 * Meta não devolveu fica `null` — ausência, nunca zero.
 *
 * @param isVideo mídia é vídeo/Reel? Só então as métricas de vídeo são pedidas.
 */
export async function getMediaMetrics(
  mediaId: string,
  accessToken: string,
  isVideo = false
): Promise<InstagramMediaMetricNode | null> {
  let core: Map<string, number | null>;
  try {
    core = await fetchInsightBatch(mediaId, accessToken, MEDIA_METRICS_CORE);
  } catch (err) {
    // Nem toda mídia expõe insights. Não derruba o sync.
    if (err instanceof InstagramApiError) {
      console.warn(`[instagram-metrics] insights de mídia indisponíveis (${mediaId})`, err.code ?? "n/a");
      return null;
    }
    throw err;
  }

  // Métricas de vídeo: best-effort. Uma recusa aqui deixa APENAS estes dois
  // campos ausentes, e o núcleo (alcance/curtidas/salvamentos) segue intacto.
  const video = new Map<string, number | null>();
  if (isVideo) {
    try {
      const batch = await fetchInsightBatch(mediaId, accessToken, MEDIA_METRICS_VIDEO);
      for (const [name, value] of batch) video.set(name, value);
    } catch (err) {
      if (!(err instanceof InstagramApiError)) throw err;
      console.warn(
        `[instagram-metrics] métricas de vídeo indisponíveis (${mediaId})`,
        err.code ?? "n/a"
      );
    }
  }

  const pick = (...names: string[]): number | null => {
    for (const name of names) {
      const value = core.get(name) ?? video.get(name);
      if (typeof value === "number") return value;
    }
    return null;
  };

  return {
    // A métrica de alcance chama-se `reach` (não `reached`).
    reached: pick("reach", "reached"),
    impressions: pick("impressions"),
    shares: pick("shares"),
    saves: pick("saves"),
    comments: pick("comments"),
    likes: pick("likes"),
    video_views: pick("plays", "video_views"),
    video_view_time: pick("video_view_time", "ig_reels_avg_watch_time"),
  };
}

/**
 * Nó de comentário conforme retornado pela API.
 *
 * `from` e `replies` seguem declarados como OPCIONAIS para tolerar respostas
 * antigas, mas não são mais PEDIDOS: `from` não existe no Instagram Business
 * Login e derrubava a chamada inteira. `repliesCount` fica `null` enquanto a
 * leitura de respostas não for confirmada contra a API real — `null` significa
 * "a Meta não forneceu", nunca zero.
 */
interface InstagramCommentNode {
  id: string;
  text?: string | null;
  username?: string | null;
  timestamp?: string | null;
  from?: { id?: string; username?: string } | null;
  replies?: { data?: unknown[] } | null;
}

/** Teto de segurança de páginas de comentários por publicação. */
const MAX_COMMENT_PAGES = 5;

/**
 * Campos pedidos ao nó `comments` neste host.
 *
 * `from` NÃO está aqui de propósito: é estrutura do fluxo Facebook Login e não
 * existe no Instagram Business Login. Pedir um campo indisponível faz a Meta
 * recusar a REQUISIÇÃO INTEIRA — não devolve os campos válidos e ignora o
 * inválido. Era por isso que a leitura nunca trazia comentário algum para
 * nenhuma publicação. `from` e `replies` ficaram fora até que o suporte a cada
 * um seja confirmado contra a API real (ver `docs/APP-REVIEW-INSTAGRAM.md`).
 *
 * Mesma lista de `COMMENT_FIELDS` em `lib/comment-replies/instagram-comments.ts`
 * — as duas cópias existiam divergentes e essa divergência é o defeito.
 */
export const COMMENT_FIELDS = "id,text,username,timestamp";

/**
 * Lê os comentários de uma publicação (paginado).
 *
 * Endpoint oficial: `GET /{ig-media-id}/comments?fields=id,text,username,timestamp`
 *
 * Requer `instagram_business_manage_comments`. Quando a Meta ainda não concedeu
 * esse escopo, a chamada lança `InstagramApiError` — o chamador (sync) decide:
 * registra como INDISPONÍVEL e segue, sem inventar comentário e sem derrubar o
 * restante da sincronização.
 *
 * NUNCA publica nada. Somente leitura.
 */
export async function getMediaComments(
  mediaId: string,
  accessToken: string,
  limit = 25
): Promise<InstagramCommentNode[]> {
  const all: InstagramCommentNode[] = [];
  let path: string | null =
    `${mediaId}/comments?fields=${COMMENT_FIELDS}&limit=${limit}`;

  for (let page = 0; page < MAX_COMMENT_PAGES && path; page++) {
    const data: {
      data?: InstagramCommentNode[];
      paging?: { next?: string };
    } = await graphGet<{ data?: InstagramCommentNode[]; paging?: { next?: string } }>(
      path,
      accessToken
    );

    all.push(...(data.data ?? []));

    const next = data.paging?.next;
    if (!next) break;
    path = toRelativeGraphPath(next);
  }

  return all;
}

/**
 * Normaliza um comentário da API para persistência.
 * Campos ausentes ficam `null` — a API pode omitir `text`/`username` para
 * comentários removidos ou de contas restritas. Ausência NÃO é string vazia
 * nem zero.
 */
function normalizeComment(
  node: InstagramCommentNode,
  ownUsername: string | null
): InstagramCommentData {
  const username = node.username ?? node.from?.username ?? null;
  const replies = Array.isArray(node.replies?.data) ? node.replies?.data.length : null;

  return {
    id: node.id,
    authorUsername: username,
    authorId: node.from?.id ?? null,
    text: node.text ?? null,
    timestamp: node.timestamp ? new Date(node.timestamp) : null,
    // Marca comentários da PRÓPRIA conta (útil para não responder a si mesmo).
    isOwn: Boolean(username && ownUsername && username.toLowerCase() === ownUsername.toLowerCase()),
    repliesCount: replies,
  };
}

/**
 * Quantas publicações recebem busca de insights detalhados por sincronização.
 * Insights são uma chamada por publicação (custosa); a lista de publicações em
 * si é sempre COMPLETA e paginada. Este teto existe só para respeitar o rate
 * limit da Meta — não é um corte da listagem.
 */
const MEDIA_METRICS_LIMIT = 25;

/**
 * Quantas publicações recebem busca de comentários por sincronização.
 * Mesmo raciocínio: as publicações mais recentes primeiro.
 */
const MEDIA_COMMENTS_LIMIT = 10;

/**
 * Coleta completa normalizada para o sync.
 *
 * - Perfil e insights vêm do nó `me` / `insights` (o que a API fornecer).
 * - Publicações vêm de `getRecentMedia` — lista COMPLETA e paginada.
 * - Comentários vêm de `getMediaComments` (uma chamada por publicação recente).
 *
 * `commentsAvailable` informa se a leitura de comentários FUNCIONOU nesta
 * execução. Quando a Meta recusa por escopo (`instagram_business_manage_comments`
 * sem acesso avançado), o sync continua e a UI mostra o motivo REAL — nunca
 * "0 comentários" como se fosse um dado.
 */
export async function collectInstagramData(
  accessToken: string
): Promise<InstagramSyncData> {
  const account = await getInstagramAccountInfo(accessToken);

  const user = await getInstagramUser(account.id, accessToken);

  const insights = await getAccountInsights(account.id, accessToken);

  const mediaNodes = await getRecentMedia(account.id, accessToken);

  const medias: InstagramSyncData["medias"] = [];
  // `null` = ainda não tentamos ler comentários (ex.: conta sem publicações).
  // Só marcamos `true` depois de uma leitura BEM-SUCEDIDA — assim não exibimos
  // "0 comentários" quando na verdade nunca conseguimos consultar.
  let commentsAvailable: boolean | null = null;
  let commentsErrorCode: string | null = null;
  /** Códigos que FALHARAM em pelo menos uma publicação (diagnóstico). */
  const failedCommentCodes = new Set<string>();

  for (let index = 0; index < mediaNodes.length; index++) {
    const node = mediaNodes[index];

    // Só vídeo/Reel pede as métricas de vídeo — pedi-las numa imagem fazia a
    // Meta recusar a chamada e TODAS as métricas virarem `null`.
    const isVideo =
      (node.media_type ?? "").toUpperCase() === "VIDEO" ||
      (node.media_product_type ?? "").toUpperCase() === "REELS";

    // Insights detalhados só para as publicações mais recentes (rate limit).
    const metrics =
      index < MEDIA_METRICS_LIMIT
        ? await getMediaMetrics(node.id, accessToken, isVideo)
        : null;

    // Comentários: só leitura, nunca resposta. Falha de escopo não interrompe
    // a sincronização — apenas marca a capacidade como indisponível.
    //
    // NÃO reagimos mais ao primeiro erro desabilitando a leitura das demais.
    // Antes, uma falha na 2ª publicação marcava `commentsAvailable = false` e o
    // `commentsAvailable !== false` pulava TODAS as seguintes — uma publicação
    // com problema apagava a leitura de comentários de toda a conta. Agora cada
    // publicação é independente: `available` acumula sucesso, `failedCodes`
    // acumula os códigos que falharam, e o resultado só é "indisponível" quando
    // nenhuma das tentativas funcionou.
    let comments: InstagramCommentData[] | null = null;
    if (index < MEDIA_COMMENTS_LIMIT) {
      try {
        const nodes = await getMediaComments(node.id, accessToken);
        comments = nodes.map((c) => normalizeComment(c, account.username));
        commentsAvailable = true;
        commentsErrorCode = null;
      } catch (err) {
        if (err instanceof InstagramApiError) {
          if (commentsAvailable === null) commentsAvailable = false;
          failedCommentCodes.add(String(err.code ?? "unknown"));
          console.warn(
            "[instagram-metrics] comentários indisponíveis",
            err.code ?? "n/a"
          );
        } else {
          throw err;
        }
      }
    }

    medias.push({
      id: node.id,
      mediaType: node.media_type ?? null,
      mediaProductType: node.media_product_type ?? null,
      permalink: node.permalink ?? null,
      caption: node.caption ?? null,
      timestamp: node.timestamp ? new Date(node.timestamp) : null,
      likeCount: node.like_count ?? null,
      commentsCount: node.comments_count ?? null,
      mediaUrl: node.media_url ?? null,
      thumbnailUrl: node.thumbnail_url ?? null,
      metrics,
      comments,
      commentsSynced: comments !== null,
    });
  }

  // Resultado AGREGADO da coleta de comentários.
  //
  // `commentsAvailable === true` só existe se PELO MENOS UMA publicação foi
  // lida com sucesso — ausência/zero de uma publicação nunca desliga o sinal.
  // E o código do erro passa a ser reportado também no caso PARCIAL: antes,
  // quando a 1ª publicação funcionava, o código da falha das seguintes era
  // descartado, e a tela mostrava "0 comentários" sem ter como saber que a
  // leitura tinha falhado em metade da conta.
  if (commentsAvailable === null && failedCommentCodes.size > 0) {
    commentsAvailable = false;
  }
  if (commentsErrorCode === null && failedCommentCodes.size > 0) {
    commentsErrorCode = [...failedCommentCodes].join(",");
  }

  return {
    account,
    profile: {
      username: user.username ?? null,
      name: user.name ?? null,
      followersCount: user.followers_count ?? null,
      followsCount: user.follows_count ?? null,
      mediaCount: user.media_count ?? null,
      profilePictureUrl: user.profile_picture_url ?? null,
      biography: user.biography ?? null,
    },
    insights,
    medias,
    commentsAvailable,
    commentsErrorCode,
  };
}
