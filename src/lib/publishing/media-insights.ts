/**
 * INSIGHTS DE UMA PUBLICAÇÃO — regras PURAS de presença/ausência
 * =============================================================
 * A tela "Insights da publicação" tem três abas: Visão geral, Engajamento e
 * Público. Cada métrica exibida vem do que a Meta REALMENTE devolveu.
 *
 * REGRA ÚNICA
 * -----------
 * Métrica ausente recebe SEMPRE a mesma frase literal:
 *
 *     "Dado não disponibilizado pela Meta para esta publicação."
 *
 * Nunca `0`, nunca `—` solto, nunca "0 curtidas". Um `0` é uma MEDIDA (a
 * publicação realmente não teve curtidas); a ausência é outra coisa. Os dois
 * casos precisam ser distinguíveis pelo usuário, e é por isso que a frase é
 * longa em vez de um traço: ela explica o motivo.
 *
 * Também é regra desta camada NÃO derivar métricas que a Meta não forneceu.
 * Ex.: não calculamos "taxa de engajamento" a partir de alcance e curtidas
 * quando o alcance veio ausente — a divisão por ausência produziria um número
 * que ninguém mediu.
 *
 * Módulo puro: é a parte verificável sem subir o app nem chamar a API.
 */

import { mediaInteractions } from "@/lib/media/derived-metrics";

/** Frase oficial de ausência. Uma única fonte para as três abas. */
export const META_UNAVAILABLE_MESSAGE =
  "Dado não disponibilizado pela Meta para esta publicação.";

export type InsightTab = "visao-geral" | "engajamento" | "publico";

export const INSIGHT_TABS: { id: InsightTab; label: string }[] = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "engajamento", label: "Engajamento" },
  { id: "publico", label: "Público" },
];

/** Origem do número, para a tela poder ser honesta sobre COMO sabe. */
export type InsightSource =
  /** Campo no nó da mídia (`like_count`, `comments_count`). */
  | "media"
  /** Endpoint `/insights` da mídia. */
  | "insights"
  /** Contagem real dos comentários já persistidos no banco. */
  | "comentarios-sincronizados"
  /** Soma de curtidas + comentários, calculada a partir de campos presentes. */
  | "derivado";

export interface InsightMetric {
  key: string;
  label: string;
  /** `null` = a Meta não disponibilizou. NUNCA convertido em 0. */
  value: number | null;
  source: InsightSource;
  /** Texto explicativo curto (o que a métrica significa). */
  hint: string;
  /**
   * `true` quando a métrica depende de `instagram_business_manage_insights` e
   * a Meta ainda não devolveu — a tela mostra a orientação de reconectar.
   */
  scopeDependent?: boolean;
}

/** Dados de entrada, todos já lidos do banco ou da API. */
export interface MediaInsightsInput {
  igMediaId: string;
  mediaType: string | null;
  mediaProductType: string | null;
  caption: string | null;
  permalink: string | null;
  /** ISO. */
  timestamp: string | null;
  /** Campos do nó da mídia. */
  likeCount: number | null;
  commentsCount: number | null;
  /** Linha de `InstagramMediaMetric` (mais recente), quando existe. */
  metrics: {
    reached: number | null;
    impressions: number | null;
    shares: number | null;
    saves: number | null;
    comments: number | null;
    likes: number | null;
    videoViews: number | null;
    videoViewTime: number | null;
  } | null;
  /** Quantos comentários REAIS estão persistidos para esta mídia. */
  storedCommentsCount: number | null;
}

/**
 * Rótulo de formato coerente com o resto do app.
 *
 * A ORDEM das checagens é a regra. `media_product_type: "FEED"` é o que a Meta
 * devolve para carrossel também — então checar `FEED` antes de
 * `CAROUSEL_ALBUM` rotulava todo carrossel como "Feed" aqui, enquanto o card em
 * `components/comment-replies/media-list.tsx` (que olha `media_type`) dizia
 * "Carrossel". Duas telas, dois nomes, o mesmo item. Por isso o tipo da mídia
 * vem primeiro: ele é o que distingue carrossel de publicação simples; o
 * `media_product_type` só decide entre Reels/Story, que o tipo sozinho não
 * separa.
 */
export function mediaFormatLabel(
  mediaType: string | null,
  mediaProductType: string | null
): string {
  const product = (mediaProductType ?? "").toUpperCase();
  if (product === "REELS") return "Reels";
  if (product === "STORY") return "Story";

  const t = (mediaType ?? "").toUpperCase();
  if (t === "CAROUSEL_ALBUM") return "Carrossel";
  if (t === "VIDEO") return "Vídeo";
  if (t === "IMAGE") return "Imagem";

  if (product === "FEED") return "Feed";
  return "Publicação";
}

/**
 * Resolve um par de candidatos: usa o primeiro que for número FINITO.
 * `0` é número válido e é preservado — só `null`/`undefined`/`NaN` caem adiante.
 */
function firstNumber(...values: (number | null | undefined)[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Monta as três abas. Não inventa, não estima, não converte ausência em zero.
 *
 * O parâmetro `insightsRequested` permite à tela dizer a diferença entre
 * "a Meta devolveu o campo vazio" e "nem chegamos a pedir" — nos dois casos o
 * valor é `null`, mas a orientação ao usuário é diferente.
 */
export function buildMediaInsights(input: MediaInsightsInput): {
  header: {
    format: string;
    caption: string | null;
    permalink: string | null;
    timestamp: string | null;
  };
  tabs: Record<InsightTab, InsightMetric[]>;
  /** Quantas métricas têm valor real ao todo. */
  measuredCount: number;
  totalCount: number;
  /** `true` se alguma métrica dependente de insights veio ausente. */
  hasMissingInsights: boolean;
} {
  const m = input.metrics;

  // Curtidas e comentários: o nó da mídia é a fonte primária; `/insights`
  // serve de reserva. Os dois são valores da Meta — escolher entre eles não é
  // estimar.
  const likes = firstNumber(input.likeCount, m?.likes ?? null);
  const comments = firstNumber(input.commentsCount, m?.comments ?? null, input.storedCommentsCount);

  const reach = firstNumber(m?.reached ?? null);
  const impressions = firstNumber(m?.impressions ?? null);
  const shares = firstNumber(m?.shares ?? null);
  const saves = firstNumber(m?.saves ?? null);
  const videoViews = firstNumber(m?.videoViews ?? null);
  const videoViewTime = firstNumber(m?.videoViewTime ?? null);

  // Derivado HONESTO: só existe quando OS DOIS termos existem. Regra única em
  // `@/lib/media/derived-metrics`, compartilhada com o Dashboard e o Calendário
  // Inteligente — antes cada lugar tinha a sua, e os números discordavam entre
  // as telas para a MESMA publicação.
  const interactions = mediaInteractions(likes, comments);

  const isVideo =
    (input.mediaType ?? "").toUpperCase() === "VIDEO" ||
    (input.mediaProductType ?? "").toUpperCase() === "REELS";

  const visaoGeral: InsightMetric[] = [
    {
      key: "reach",
      label: "Alcance",
      value: reach,
      source: "insights",
      hint: "Contas únicas que viram a publicação.",
      scopeDependent: true,
    },
    {
      key: "impressions",
      label: "Impressões",
      value: impressions,
      source: "insights",
      hint: "Quantas vezes a publicação foi exibida.",
      scopeDependent: true,
    },
    {
      key: "interactions",
      label: "Interações",
      value: interactions,
      source: "derivado",
      hint: "Curtidas somadas aos comentários.",
    },
    {
      key: "likes",
      label: "Curtidas",
      value: likes,
      source: input.likeCount != null ? "media" : "insights",
      hint: "Curtidas registradas na publicação.",
    },
  ];

  const engajamento: InsightMetric[] = [
    {
      key: "comments",
      label: "Comentários",
      value: comments,
      source: input.commentsCount != null ? "media" : input.storedCommentsCount != null ? "comentarios-sincronizados" : "insights",
      hint: "Comentários registrados na publicação.",
    },
    {
      key: "saves",
      label: "Salvamentos",
      value: saves,
      source: "insights",
      hint: "Quantas vezes a publicação foi salva.",
      scopeDependent: true,
    },
    {
      key: "shares",
      label: "Compartilhamentos",
      value: shares,
      source: "insights",
      hint: "Quantas vezes a publicação foi compartilhada.",
      scopeDependent: true,
    },
    ...(isVideo
      ? [
          {
            key: "videoViews",
            label: "Visualizações do vídeo",
            value: videoViews,
            source: "insights" as InsightSource,
            hint: "Reproduções contabilizadas pela Meta.",
            scopeDependent: true,
          },
          {
            key: "videoViewTime",
            label: "Tempo de visualização",
            value: videoViewTime,
            source: "insights" as InsightSource,
            hint: "Tempo total assistido, em milissegundos.",
            scopeDependent: true,
          },
        ]
      : []),
  ];

  // PÚBLICO — a Meta não expõe demografia de público por publicação no
  // Instagram Business Login. As métricas ficam declaradas com `value: null` de
  // propósito: a aba existe, explica a limitação e não é preenchida com
  // estimativa. Se um dia a API passar a fornecer, cada linha vira leitura real
  // e esta lista precisa ser revisitada de propósito.
  const publico: InsightMetric[] = [
    {
      key: "audience-demografia",
      label: "Faixa etária e gênero",
      value: null,
      source: "insights",
      hint: "A API do Instagram não disponibiliza recorte demográfico por publicação.",
      scopeDependent: true,
    },
    {
      key: "audience-cidades",
      label: "Cidades e países",
      value: null,
      source: "insights",
      hint: "A API do Instagram não disponibiliza localização do público por publicação.",
      scopeDependent: true,
    },
    {
      key: "audience-seguidores",
      label: "Seguidores × não seguidores",
      value: null,
      source: "insights",
      hint: "A API do Instagram não disponibiliza essa divisão por publicação.",
      scopeDependent: true,
    },
  ];

  const tabs: Record<InsightTab, InsightMetric[]> = {
    "visao-geral": visaoGeral,
    engajamento,
    publico,
  };

  const all = [...visaoGeral, ...engajamento, ...publico];
  const measuredCount = all.filter((x) => x.value != null).length;

  return {
    header: {
      format: mediaFormatLabel(input.mediaType, input.mediaProductType),
      caption: input.caption,
      permalink: input.permalink,
      timestamp: input.timestamp,
    },
    tabs,
    measuredCount,
    totalCount: all.length,
    hasMissingInsights: all.some((x) => x.value == null && x.scopeDependent),
  };
}

/** Formata um número real. `null` → a frase oficial (nunca "0"). */
export function formatMetric(value: number | null): string {
  if (value == null) return META_UNAVAILABLE_MESSAGE;
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** `true` quando o valor é ausência (para a UI escolher o estilo). */
export function isUnavailable(value: number | null): boolean {
  return value == null;
}
