import { prisma } from "@/lib/db";
import { averagePresent, mediaInteractions, sumPresent } from "@/lib/media/derived-metrics";

/**
 * DADOS DE MÍDIA E DE PRODUÇÃO DO DASHBOARD
 * ==========================================
 * Camada de leitura que responde a duas perguntas:
 *
 *   1. O que a integração do Instagram REALMENTE coletou sobre mídias
 *      (vídeos/Reels, Stories) — para os cards correspondentes.
 *   2. O que o usuário REALMENTE produziu dentro do Inst Acessor
 *      (cópias, ideias, agendamentos, publicações, respostas) — para o
 *      bloco "Sua produção".
 *
 * Regras invioláveis desta camada:
 *   - NÃO chama a API da Meta. NÃO cria sincronização. Só lê o que já existe.
 *   - NÃO inventa número. Ausência de dado → `null`, nunca `0`.
 *   - Falha de leitura → `null` (degrada), nunca quebra a Dashboard.
 *   - Nada de valor fictício ou demonstrativo.
 *
 * Tipos como "Reels" e "Stories" são declarados com a VERDADE sobre a coleta
 * atual — ver os comentários de `ReelCollection` e `StoryCollection`.
 */

/** Delegate genérico — mesmo padrão de cast controlado usado em `@/lib/ai/db`. */
interface Delegate<T> {
  count(args?: unknown): Promise<number>;
  findMany(args?: unknown): Promise<T[]>;
}

type MediaRow = {
  id: string;
  igMediaId: string;
  mediaType: string | null;
  /** `media_product_type` da Meta (ex.: `REELS`, `FEED`, `STORY`). */
  mediaProductType: string | null;
  timestamp: Date | null;
  likeCount: number | null;
  commentsCount: number | null;
};

type MediaMetricRow = {
  mediaId: string;
  capturedAt: Date;
  videoViews: number | null;
  reached: number | null;
  shares: number | null;
  saves: number | null;
  likes: number | null;
  comments: number | null;
};

/**
 * VÍDEOS / REELS — verdade sobre a coleta atual.
 *
 * A integração persiste `InstagramMedia.mediaType` (ex.: `VIDEO`, `IMAGE`,
 * `CAROUSEL_ALBUM`) E `InstagramMedia.mediaProductType` (`REELS`, `FEED`,
 * `STORY` — campo `media_product_type` da Meta).
 *
 * Porém `mediaProductType` só passou a ser gravado recentemente: as mídias
 * coletadas ANTES disso têm `null` nessa coluna. A distinção é, portanto,
 * PARCIAL — e a UI precisa dizer isso em vez de afirmar "Reels" como se todas
 * as mídias antigas estivessem classificadas.
 *
 * Consequência honesta: sempre é possível contar MÍDIAS DE VÍDEO; distinguir
 * Reels de vídeo de feed só é possível quando `mediaProductType` existe.
 * Nenhum valor é inferido para as mídias sem classificação.
 */
export interface ReelCollection {
  /** Quantidade real de mídias com `mediaType === "VIDEO"`. */
  count: number | null;
  /** Quantas mídias de vídeo SÃO Reels (`mediaProductType === "REELS"`). */
  reelsCount: number | null;
  /** Quantas mídias de vídeo têm classificação conhecida. `null` se nenhuma. */
  classifiedCount: number | null;
  /** Views de vídeo somadas (última métrica conhecida de cada mídia). */
  videoViews: number | null;
  /** Alcance somado das mídias de vídeo (última métrica de cada). */
  reached: number | null;
  /**
   * `true` quando TODAS as mídias de vídeo coletadas têm `mediaProductType`.
   * `false` = distinção parcial (há mídias antigas sem o campo).
   */
  distinguishesReels: boolean;
  /** Explicação exibida ao usuário — nunca escondida na UI. */
  note: string;
}

/**
 * STORIES — verdade sobre a coleta atual.
 *
 * Stories são efêmeros e NÃO são coletados pela integração atual (não há
 * endpoint de stories no sync, nem model no schema). Por isso `collected` é
 * o literal `false`: se um dia a coleta existir, este tipo deixa de compilar
 * e a UI precisa ser revisitada de propósito. Nenhum número é estimado.
 */
export interface StoryCollection {
  collected: false;
  note: string;
}

/** Uma linha do bloco "Sua produção". */
export interface ProductionItem {
  key: string;
  label: string;
  /** Contagem real. `null` = não foi possível ler (nunca vira 0). */
  value: number | null;
  /** O que exatamente está sendo contado. */
  detail: string;
}

export interface MediaProductionData {
  reels: ReelCollection;
  stories: StoryCollection;
  production: ProductionItem[];
  /** Média real de curtidas + comentários por publicação coletada. */
  avgInteractionsPerMedia: number | null;
  /** Total real de curtidas + comentários nas publicações coletadas. */
  totalInteractions: number | null;
}

const REELS_NOTE_FULL =
  "Contagem de vídeos publicados. A classificação Reels × feed vem do campo media_product_type da Meta e está disponível para estas mídias.";

const REELS_NOTE_PARTIAL =
  "Contagem de vídeos publicados. A integração já lê media_product_type, mas parte das mídias foi coletada antes disso e não tem classificação — por isso Reels não é afirmado para todas.";

const STORIES_NOTE =
  "A coleta atual não lê Stories. Nada é estimado: este card fica vazio até a integração passar a coletar stories de verdade.";

/** Executa uma contagem degradando para `null` em qualquer falha. */
async function safeCount(
  delegate: Delegate<unknown> | undefined,
  args?: unknown
): Promise<number | null> {
  if (!delegate?.count) return null;
  try {
    return await delegate.count(args);
  } catch {
    return null;
  }
}

/** Executa uma leitura degradando para `[]` em qualquer falha. */
async function safeFindMany<T>(
  delegate: Delegate<T> | undefined,
  args?: unknown
): Promise<T[]> {
  if (!delegate?.findMany) return [];
  try {
    return await delegate.findMany(args);
  } catch {
    return [];
  }
}

/**
 * Última métrica conhecida de cada mídia.
 * As métricas são gravadas a cada sync, então somar TODAS as linhas
 * multiplicaria o valor pelo número de sincronizações. Aqui ficamos com a
 * linha mais recente de cada mídia (`capturedAt` desc + primeiro por mediaId).
 */
function latestMetricPerMedia(rows: MediaMetricRow[]): Map<string, MediaMetricRow> {
  const map = new Map<string, MediaMetricRow>();
  for (const row of rows) {
    if (!map.has(row.mediaId)) map.set(row.mediaId, row);
  }
  return map;
}

/**
 * Lê mídia + produção do usuário. Nunca chama a API da Meta.
 * Qualquer falha isolada devolve `null` naquele item — a Dashboard continua.
 */
export async function getMediaProductionData(
  userId: string
): Promise<MediaProductionData> {
  const p = prisma as unknown as {
    instagramMedia?: Delegate<MediaRow>;
    instagramMediaMetric?: Delegate<MediaMetricRow>;
    generatedCopy?: Delegate<unknown>;
    contentIdea?: Delegate<unknown>;
    plannedContent?: Delegate<unknown>;
    profileScore?: Delegate<unknown>;
    commentReplyLog?: Delegate<unknown>;
  };

  const [mediaRows, metricRows] = await Promise.all([
    safeFindMany<MediaRow>(p.instagramMedia, {
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 60,
      select: {
        id: true,
        igMediaId: true,
        mediaType: true,
        mediaProductType: true,
        timestamp: true,
        likeCount: true,
        commentsCount: true,
      },
    }),
    safeFindMany<MediaMetricRow>(p.instagramMediaMetric, {
      where: { userId },
      orderBy: { capturedAt: "desc" },
      take: 600,
      select: {
        mediaId: true,
        capturedAt: true,
        videoViews: true,
        reached: true,
        shares: true,
        saves: true,
        likes: true,
        comments: true,
      },
    }),
  ]);

  // ---- Mídias de vídeo (base do card de Reels) ----
  const videoMedia = mediaRows.filter((m) => m.mediaType === "VIDEO");
  const latestMetrics = latestMetricPerMedia(metricRows);

  const videoMetrics = videoMedia
    .map((m) => latestMetrics.get(m.id))
    .filter((m): m is MediaMetricRow => m != null);

  // Soma de grandezas INDEPENDENTES (views/alcance de cada vídeo — o alcance de
  // uma mídia não depende do da outra). Vem do núcleo comum para não existir uma
  // segunda implementação da mesma regra "soma vazia é null, nunca 0".
  const sumOrNull = sumPresent;

  // Classificação Reels × feed: só conta o que a Meta classificou de verdade.
  // Mídia sem `mediaProductType` (coletada antes do campo existir) NÃO é
  // presumida Reel nem presumida feed — fica de fora da contagem.
  const classifiedVideos = videoMedia.filter(
    (m) => typeof m.mediaProductType === "string" && m.mediaProductType.length > 0
  );
  const reelsCount =
    classifiedVideos.length > 0
      ? classifiedVideos.filter((m) => m.mediaProductType?.toUpperCase() === "REELS").length
      : null;
  const allClassified = videoMedia.length > 0 && classifiedVideos.length === videoMedia.length;

  const reels: ReelCollection = {
    count: mediaRows.length > 0 ? videoMedia.length : null,
    reelsCount,
    classifiedCount: classifiedVideos.length > 0 ? classifiedVideos.length : null,
    videoViews: sumOrNull(videoMetrics.map((m) => m.videoViews)),
    reached: sumOrNull(videoMetrics.map((m) => m.reached)),
    distinguishesReels: allClassified,
    note: allClassified ? REELS_NOTE_FULL : REELS_NOTE_PARTIAL,
  };

  const stories: StoryCollection = {
    collected: false,
    note: STORIES_NOTE,
  };

  // ---- Engajamento real: curtidas + comentários das publicações coletadas ----
  //
  // O derivado (curtidas + comentários) exige OS DOIS termos — regra única em
  // `@/lib/media/derived-metrics`, a mesma usada pelo modal de insights. Antes
  // esta função fazia `(likes ?? 0) + (comments ?? 0)`: uma publicação com só
  // um dos números entrava na conta valendo um total PARCIAL, e o card exibia
  // esse parcial como se fosse o engajamento real.
  //
  // Publicação com termo ausente fica FORA da amostra (não entra valendo zero).
  // Os dois agregados abaixo são `null` quando nenhuma publicação está completa
  // — a tela mostra a ausência em vez de "0".
  const interactions = mediaRows
    .map((m) => mediaInteractions(m.likeCount, m.commentsCount))
    .filter((v): v is number => v != null);

  const totalInteractions = interactions.length > 0 ? interactions.reduce((a, b) => a + b, 0) : null;
  const avgInteractionsPerMedia = averagePresent(interactions);

  // ---- Bloco "Sua produção" — só contagens que existem no banco ----
  const [
    copies,
    ideas,
    scheduled,
    published,
    analyses,
    repliesAnalyzed,
    repliesSent,
  ] = await Promise.all([
    safeCount(p.generatedCopy, { where: { userId } }),
    safeCount(p.contentIdea, { where: { userId } }),
    safeCount(p.plannedContent, { where: { userId, status: "AGENDADO" } }),
    safeCount(p.plannedContent, { where: { userId, status: "PUBLICADO" } }),
    safeCount(p.profileScore, { where: { userId } }),
    safeCount(p.commentReplyLog, { where: { userId } }),
    safeCount(p.commentReplyLog, { where: { userId, status: "SENT" } }),
  ]);

  const production: ProductionItem[] = [
    {
      key: "copies",
      label: "Cópias criadas",
      value: copies,
      detail: "Textos gerados no Preview Social",
    },
    {
      key: "ideas",
      label: "Ideias geradas",
      value: ideas,
      detail: "Ideias salvas na Central de Ideias",
    },
    {
      key: "analyses",
      label: "Análises realizadas",
      value: analyses,
      detail: "Cálculos de Score do perfil",
    },
    {
      key: "scheduled",
      label: "Conteúdos programados",
      value: scheduled,
      detail: "Itens agendados no Calendário",
    },
    {
      key: "published",
      label: "Publicações realizadas",
      value: published,
      detail: "Conteúdos com publicação confirmada",
    },
    {
      key: "repliesAnalyzed",
      label: "Respostas analisadas",
      value: repliesAnalyzed,
      detail: "Comentários processados em Respostas Inteligentes",
    },
    {
      key: "repliesSent",
      label: "Respostas enviadas",
      value: repliesSent,
      detail: "Respostas efetivamente publicadas",
    },
  ];

  return { reels, stories, production, avgInteractionsPerMedia, totalInteractions };
}
