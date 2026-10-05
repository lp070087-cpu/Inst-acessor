import { graphGet } from "./client";
import { InstagramApiError } from "./client";
import { mediaInteractions } from "@/lib/media/derived-metrics";
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
    /**
     * Tipo do período do item. Para métricas de SÉRIE a Meta exige o
     * parâmetro `metric_type=<period>` na requisição — ver `getAccountInsights`.
     */
    metric_type?: string;
    values?: { value?: number }[];
    total_value?: { value?: number };
  }[];
}

/**
 * Extrai o valor de um item de insight.
 *
 * Ordem: `total_value.value` (total agregado da janela) tem prioridade; sem ele,
 * usa `values[]`. Na série, o valor escolhido é o do ÚLTIMO período retornado,
 * que é o período mais recente da janela.
 *
 * NÃO soma os valores da série: numa janela de 7 dias o acumulado da semana é
 * exatamente o que `total_value` já entrega, e somar `values[]` daria o mesmo
 * número por outro caminho — com o risco extra de contar um período parcial.
 */
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
 * Janela padrão dos insights de conta, em segundos (7 dias).
 *
 * Motivo: com `period=day` e sem `since`/`until`, a Meta responde sobre o dia
 * CORRENTE — que ainda não fechou, e cujo total não diz nada sobre desempenho.
 * A janela de 7 dias é um período fechado e é idêntica à que o Dashboard já
 * compara (`reach7d`, "Alcance em 7 dias"), então o insights e a tela falam do
 * MESMO intervalo.
 */
const ACCOUNT_INSIGHTS_WINDOW_DAYS = 7;

/**
 * Métricas de conta no formato ATUAL da API — hoje, uma chamada para cada
 * (`getAccountInsights`).
 *
 * ============== O QUE A RESPOSTA REAL DA META DISSE (fonte superior) ======
 * Uma chamada real de produção com `metric=reach,impressions,profile_views`
 * voltou HTTP 400 / code 100, e o `error_data` da Meta listou as métricas
 * ACEITAS naquele endpoint:
 *
 *   reach · follower_count · website_clicks · profile_views · online_followers
 *   accounts_engaged · total_interactions · likes · comments · shares · saves
 *   replies · engaged_audience_demographics · reached_audience_demographics
 *   follower_demographics · follows_and_unfollows · ...
 *
 * Duas conclusões que CORRIGEM a leitura anterior deste arquivo:
 *
 *   1. `profile_views` É aceita. ("Aposentada" era conclusão minha, de fora da
 *      API, e a API a contradiz.) Volta a ser pedida, em chamada própria.
 *   2. `impressions` NÃO aparece na lista — é ela a métrica inválida da chamada
 *      antiga. Como a Meta valida a lista inteira, essa única métrica inválida
 *      derrubava também `reach` e `profile_views`, que eram válidas. É a causa
 *      real dos três cards em "—".
 *
 * `views` NÃO está na lista acima. Ela continua sendo pedida em chamada própria
 * e degradante: se a conta aceitar, ótimo; se não, o log diz o motivo e os
 * outros dois cards seguem preenchidos. NÃO se assume equivalência entre
 * `impressions` e `views` — são coisas diferentes, e o rótulo da tela diz
 * "Visualizações" para o que quer que `views` devolva.
 * ==========================================================================
 */

/**
 * Diagnóstico SEGURO de uma resposta de erro do `/insights`.
 *
 * Existe porque o `catch` abaixo engolia o motivo: a tela mostrava "—" e o log
 * mostrava só o `code`. Aqui o erro CRU da Meta é reduzido ao que explica a
 * falha — mensagem (sanitizada), lista de métricas válidas devolvida em
 * `error_data` e o código — SEM token, SEM corpo completo e SEM dado do usuário.
 *
 * A mensagem da Meta é metadata do erro. Ainda assim passa por corte de tamanho
 * e por um filtro que remove qualquer coisa com cara de credencial, porque um
 * log nunca deve ser o vetor de vazamento.
 */
function logInsightsDiagnostic(error: Record<string, unknown>): void {
  const rawMessage = typeof error.message === "string" ? error.message : "";
  // `error_data` é o campo que a Meta usa para dizer o que ela ACEITA
  // ("The following metrics are valid: reach, views, ..."). É a informação que
  // transforma um 400 opaco em uma correção determinística.
  const errorData = typeof error.error_data === "string" ? error.error_data : "";
  const sanitize = (text: string): string =>
    text
      .replace(/(access_token|client_secret|bearer)\s*[=:]\s*\S+/gi, "$1=[REDACTED]")
      .slice(0, 400);

  console.warn("[instagram-metrics] insights recusados pela Meta", {
    code: error.code ?? "-",
    subcode: error.error_subcode ?? "-",
    type: error.type ?? "-",
    fbtraceId: error.fbtrace_id ?? "-",
    // Sem isto, "campo inválido" e "sem permissão" chegam idênticos.
    message: sanitize(rawMessage),
    // Lista de métricas válidas, quando a Meta devolve — em `error_data` ou no
    // fim da própria mensagem.
    errorData: sanitize(errorData) || "-",
  });
}

/**
 * Obtém insights da conta numa janela fechada de 7 dias.
 *
 * UMA CHAMADA POR MÉTRICA. Não é preferência de estilo: a Meta valida a lista
 * INTEIRA, então agrupar métricas faz uma só inválida zerar as válidas — que foi
 * exatamente o defeito relatado (alcance, visualizações e visitas ao perfil em
 * "—" ao mesmo tempo, enquanto seguidores e publicações, que vêm de outro
 * endpoint, apareciam normalmente).
 *
 *   - `reach`         → série diária; lê-se o dia mais recente da janela;
 *   - `profile_views` → série diária (confirmada como válida pela Meta);
 *   - `views`         → total agregado (`metric_type=total_value`), degradante.
 *
 * Cada bloco degrada SOZINHO para `null` — ausência, NUNCA zero. Nenhuma das
 * três é pré-requisito das outras.
 *
 * `impressions` no retorno é o alias interno de `views` (nome da coluna
 * persistida, congelado no banco). `profileViews` é o valor real de
 * `profile_views`, e não um campo sempre nulo.
 *
 * @param since timestamp inicial (opcional). Aceito por compatibilidade: a
 *              janela pedida à Meta é sempre `ACCOUNT_INSIGHTS_WINDOW_DAYS`,
 *              para que o valor salvo seja comparável entre sincronizações.
 */
export async function getAccountInsights(
  igUserId: string,
  accessToken: string,
  since?: number
): Promise<{ reach?: number | null; impressions?: number | null; profileViews?: number | null }> {
  void since;

  const result: {
    reach?: number | null;
    impressions?: number | null;
    profileViews?: number | null;
  } = {
    reach: null,
    // `views` → nome da coluna persistida.
    impressions: null,
    // `profile_views` → campo real (confirmada como aceita pela Meta).
    profileViews: null,
  };

  const sinceTs = Math.floor(Date.now() / 1000) - ACCOUNT_INSIGHTS_WINDOW_DAYS * 86400;

  /**
   * Busca UMA métrica de conta e atribui ao campo correspondente.
   *
   * A mensagem de erro é específica por métrica (`"profile_views" indisponível`)
   * porque, com uma chamada por métrica, "alguma coisa falhou" deixa de ser
   * resposta útil: o log precisa dizer QUAL.
   */
  const fetchAccountMetric = async (
    metric: string,
    assign: (value: number | null) => void
  ): Promise<void> => {
    try {
      const data = await graphGet<InsightsEnvelope>(
        `${igUserId}/insights?metric=${metric}&period=day&since=${sinceTs}`,
        accessToken,
        { onErrorResponse: logInsightsDiagnostic }
      );
      for (const item of data.data ?? []) {
        if (item.name === metric) assign(readInsightValue(item));
      }
    } catch (err) {
      if (!(err instanceof InstagramApiError)) throw err;
      console.warn(
        `[instagram-metrics] "${metric}" indisponível`,
        err.code ?? "n/a"
      );
    }
  };

  await fetchAccountMetric("reach", (v) => {
    result.reach = v;
  });
  await fetchAccountMetric("profile_views", (v) => {
    result.profileViews = v;
  });

  // ---- views: total agregado da janela (métrica separada e degradante) ----
  // `metric_type=total_value` é o parâmetro que a Meta exige para métricas de
  // total; sem ele a resposta pode vir só como série diária.
  try {
    const data = await graphGet<InsightsEnvelope>(
      `${igUserId}/insights?metric=views&period=day&metric_type=total_value&since=${sinceTs}`,
      accessToken,
      { onErrorResponse: logInsightsDiagnostic }
    );
    for (const item of data.data ?? []) {
      if (item.name === "views") result.impressions = readInsightValue(item);
    }
  } catch (err) {
    if (!(err instanceof InstagramApiError)) throw err;
    console.warn("[instagram-metrics] visualizações (views) indisponíveis", err.code ?? "n/a");
  }

  return result;
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
 * Métricas de mídia pedidas no lote principal, como LISTA (a ordem define a
 * prioridade da degradação — as primeiras são as mais importantes).
 *
 * `video_views` e `video_view_time` NÃO estão aqui, e o motivo é um defeito
 * real: pedir uma métrica que o tipo de mídia não suporta (ex.: métrica de vídeo
 * num post de imagem) faz a Meta recusar a REQUISIÇÃO INTEIRA. Como o erro era
 * engolido, `InstagramMediaMetric` ficava vazia e TODA métrica virava `null` —
 * inclusive alcance e curtidas, que existiam. Uma métrica inválida apagava o
 * card inteiro.
 *
 * ===================== `saved`, NÃO `saves` (evidência real da Meta) ======
 * O nome no endpoint `/{ig-media-id}/insights` é `saved`. O código pedia
 * `saves` e a Meta respondia com code 100 listando as métricas válidas — em que
 * `saves` não aparece e `saved` aparece. Como a lista é validada inteira, esse
 * único nome errado apagava o lote INTEIRO: alcance, curtidas e comentários
 * junto. Trocado para `saved`.
 *
 * O produto continua chamando isso de `saves` (propriedade interna e coluna do
 * banco). `saved` é o nome da META; `saves` é o nome daqui — ver `pick` em
 * `getMediaMetrics`, que faz a ponte.
 * ==========================================================================
 */
const MEDIA_METRICS_CORE_LIST = [
  "reach",
  "impressions",
  "shares",
  "saved",
  "comments",
  "likes",
] as const;

/** O mesmo lote em CSV — formato que o parâmetro `metric` exige. */
export const MEDIA_METRICS_CORE = MEDIA_METRICS_CORE_LIST.join(",");

/**
 * Métricas adicionais de vídeo/Reel, pedidas em chamada SEPARADA.
 *
 * Nomes verificados apenas contra o que a Meta devolveu em erro real; não houve
 * consulta à documentação oficial (este ambiente não tem saída para
 * `developers.facebook.com`). Por isso são pedidas à parte: se a Meta recusar, o
 * prejuízo são as métricas de vídeo — nunca alcance, curtidas ou salvamentos.
 */
const MEDIA_METRICS_VIDEO_LIST = [
  "plays",
  "video_views",
  "video_view_time",
  "ig_reels_avg_watch_time",
] as const;

/** O mesmo lote em CSV. */
export const MEDIA_METRICS_VIDEO = MEDIA_METRICS_VIDEO_LIST.join(",");

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
    accessToken,
    { onErrorResponse: logInsightsDiagnostic }
  );

  const byName = new Map<string, number | null>();
  for (const item of data.data ?? []) {
    if (item.name) byName.set(item.name, readInsightValue(item));
  }
  return byName;
}

/**
 * Lê um lote com RECUO POR MÉTRICA.
 *
 * Uma métrica inválida derruba o lote inteiro (é assim que a Meta valida a
 * lista). Então, quando o lote falha, cada métrica é pedida sozinha e o que for
 * válido é preservado. O custo são chamadas extras — e só no caminho de erro,
 * porque o caminho bom (lote inteiro aceito) continua sendo UMA chamada.
 *
 * Isto não é otimização especulativa: é a única forma de uma métrica futuramente
 * renomeada deixar de apagar alcance, curtidas e comentários junto com ela.
 * Inversamente, se NENHUMA métrica do lote for aceita, o erro é propagado — não
 * se inventa "vazio" para uma falha que provavelmente é de escopo.
 */
async function fetchInsightsWithFallback(
  mediaId: string,
  accessToken: string,
  metrics: readonly string[]
): Promise<Map<string, number | null>> {
  try {
    return await fetchInsightBatch(mediaId, accessToken, metrics.join(","));
  } catch (err) {
    if (!(err instanceof InstagramApiError)) throw err;
  }

  // Recuo: métrica por métrica, para que a recusa de uma não leve as outras.
  const byName = new Map<string, number | null>();
  let lastError: InstagramApiError | null = null;
  for (const metric of metrics) {
    try {
      const one = await fetchInsightBatch(mediaId, accessToken, metric);
      for (const [name, value] of one) byName.set(name, value);
    } catch (err) {
      if (!(err instanceof InstagramApiError)) throw err;
      lastError = err;
    }
  }

  if (byName.size === 0 && lastError) throw lastError;
  return byName;
}

/**
 * Obtém métricas detalhadas de uma mídia específica.
 *
 * Os dois grupos são buscados de forma INDEPENDENTE (ver `MEDIA_METRICS_CORE_LIST`
 * e `MEDIA_METRICS_VIDEO_LIST`): a falha de um não pode zerar o outro. Métrica
 * que a Meta não devolveu fica `null` — ausência, nunca zero.
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
    core = await fetchInsightsWithFallback(
      mediaId,
      accessToken,
      MEDIA_METRICS_CORE_LIST
    );
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
      const batch = await fetchInsightsWithFallback(
        mediaId,
        accessToken,
        MEDIA_METRICS_VIDEO_LIST
      );
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
    // `impressions` permanece: a evidência real da Meta a lista como válida no
    // endpoint de MÍDIA (ao contrário do insights de CONTA, onde ela saiu).
    impressions: pick("impressions"),
    shares: pick("shares"),
    // PONTE DE NOME: a Meta devolve `saved`; o produto chama de `saves`.
    // A ordem importa — `saved` é o nome atual e vem primeiro. `saves` fica como
    // segunda tentativa apenas para tolerar uma resposta antiga em cache.
    saves: pick("saved", "saves"),
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
 * Engajamento REAL da conta: soma das interações das publicações coletadas.
 *
 * ==================== POR QUE ISTO NÃO EXISTIA E PASSA A EXISTIR ==========
 * O sync gravava `engagement: null` FIXO no snapshot, com o comentário "derivado
 * apenas quando houver componentes reais". Só que o dado real JÁ estava em mãos
 * no mesmo laço: `getMediaMetrics` devolve curtidas e comentários de cada
 * publicação. O resultado era o "Engajamento: —" na tela mesmo com as métricas
 * de mídia chegando — um campo que nunca era preenchido, não um indisponível.
 *
 * Isto é um defeito SEPARADO do insights da conta: `engagement` não vem (e nunca
 * veio) do endpoint `/insights` da conta, vem das publicações. Corrigir só o
 * insights não o resolveria, por isso está aqui.
 *
 * REGRA (a mesma de `derived-metrics.ts`): interação de uma publicação só
 * existe quando curtidas E comentários existem — `mediaInteractions` devolve
 * `null` quando falta um dos dois. Publicações sem o par são descartadas da
 * soma em vez de entrarem valendo zero, e nenhuma publicação com dado real →
 * `null`, nunca `0`.
 * ==========================================================================
 */
function collectEngagement(medias: InstagramSyncData["medias"]): number | null {
  const interactions = medias.map((m) => mediaInteractions(m.likeCount, m.commentsCount));
  const real = interactions.filter((v): v is number => v != null);
  return real.length > 0 ? real.reduce((a, b) => a + b, 0) : null;
}

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
    // Interações reais das publicações coletadas — ver `collectEngagement`.
    // `null` quando nenhuma publicação trouxe o par curtidas+comentários.
    engagement: collectEngagement(medias),
    medias,
    commentsAvailable,
    commentsErrorCode,
  };
}
