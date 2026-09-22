/**
 * CALENDÁRIO INTELIGENTE DO INST ACESSOR — motor PURO
 * ===================================================
 * Recebe as evidências JÁ LIDAS do banco (nunca chama banco nem a API da
 * Meta) e devolve recomendações de calendário.
 *
 * REGRA ÚNICA E INVIOLÁVEL
 * ------------------------
 * Toda recomendação sai de um dado REAL. Quando o dado não existe, o campo
 * `body` recebe EXATAMENTE a frase:
 *
 *     "Dados insuficientes para gerar esta recomendação."
 *
 * Nunca um "melhor horário" genérico, nunca uma frequência ideal inventada,
 * nunca um dia da semana escolhido sem amostra. A frase de ausência é a mesma
 * literal em todos os pontos, é auditável por busca no código e é o único
 * texto permitido quando `available === false`.
 *
 * Cada recomendação carrega também `evidence` — o número real que a sustenta,
 * em texto — para que a tela possa mostrar de onde veio a conclusão. Sem isso,
 * uma recomendação correta seria indistinguível de um palpite.
 *
 * Módulo puro de propósito: é a parte testável sem subir o app.
 */

import { mediaInteractions } from "@/lib/media/derived-metrics";

/** Frase oficial de ausência. Não alterar sem revisar a especificação. */
export const INSUFFICIENT_DATA_MESSAGE =
  "Dados insuficientes para gerar esta recomendação.";

// ---------------------------------------------------------------
// Limiares mínimos de amostra
// ---------------------------------------------------------------
// Sem amostra suficiente, "melhor dia" e "melhor formato" seriam ruído
// apresentado como padrão. Os limiares são explícitos e nomeados para que a
// decisão seja auditável e ajustável em um único lugar.

/** Publicações com interação necessárias para afirmar um PADRÃO de dia. */
export const MIN_MEDIA_FOR_WEEKDAY_PATTERN = 8;
/** Publicações classificadas necessárias para afirmar um PADRÃO de formato. */
export const MIN_CLASSIFIED_FOR_FORMAT_PATTERN = 5;
/** Leituras de seguidores necessárias para afirmar direção de crescimento. */
export const MIN_SNAPSHOTS_FOR_TREND = 2;
/** Janela (em dias) usada para medir cadência e tendência. */
export const DEFAULT_WINDOW_DAYS = 30;

// ---------------------------------------------------------------
// Entradas (todas reais, já lidas do banco)
// ---------------------------------------------------------------

export interface PlannedContentInput {
  id: string;
  platform: string;
  format: string;
  status: string;
  /** ISO ou null quando ainda não agendado. */
  scheduledAt: string | null;
  title: string;
}

export interface MediaInput {
  igMediaId: string;
  /** ISO da publicação. */
  timestamp: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  likeCount: number | null;
  commentsCount: number | null;
}

export interface SnapshotInput {
  /** ISO da captura. */
  capturedAt: string;
  followersCount: number | null;
  reach: number | null;
  profileViews: number | null;
}

export interface GoalInput {
  id: string;
  title: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  /** ISO ou null. */
  deadline: string | null;
  status: string;
}

export interface SmartCalendarInput {
  plannedContents: PlannedContentInput[];
  media: MediaInput[];
  snapshots: SnapshotInput[];
  goals: GoalInput[];
  /** Data de referência (ISO). Injetada para o cálculo ser determinístico. */
  now: string;
}

// ---------------------------------------------------------------
// Saída
// ---------------------------------------------------------------

export type SmartRecommendationKind =
  | "lacunas-semana"
  | "cadencia"
  | "melhores-dias"
  | "melhores-formatos"
  | "tendencia-alcance"
  | "metas-prazo";

export interface SmartRecommendation {
  kind: SmartRecommendationKind;
  title: string;
  /** Texto final. Quando não há dado, é `INSUFFICIENT_DATA_MESSAGE`. */
  body: string;
  /** Números reais que sustentam a conclusão (vazio quando indisponível). */
  evidence: string[];
  available: boolean;
}

export interface SmartCalendarResult {
  recommendations: SmartRecommendation[];
  /** Quantas recomendações têm dado real. */
  availableCount: number;
  total: number;
  /** Transparência: o que foi considerado no cálculo. */
  context: {
    plannedCount: number;
    mediaCount: number;
    mediaWithInteractions: number;
    classifiedMediaCount: number;
    snapshotCount: number;
    activeGoals: number;
    windowDays: number;
  };
}

// ---------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function parse(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function unavailable(kind: SmartRecommendationKind, title: string): SmartRecommendation {
  return {
    kind,
    title,
    body: INSUFFICIENT_DATA_MESSAGE,
    evidence: [],
    available: false,
  };
}

function formatDay(iso: string): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---------------------------------------------------------------
// 1. LACUNAS DA SEMANA
// Real: quais dias dos PRÓXIMOS 7 dias não têm conteúdo agendado.
// ---------------------------------------------------------------

function weeklyGaps(input: SmartCalendarInput): SmartRecommendation {
  const now = parse(input.now);
  if (!now) return unavailable("lacunas-semana", "Lacunas da semana");

  const scheduled = input.plannedContents.filter(
    (c) => c.scheduledAt != null && parse(c.scheduledAt) != null
  );

  // Sem nenhum conteúdo agendado não existe "lacuna": existe semana vazia, e
  // apontar 7 lacunas seria só a ausência repetida.
  if (scheduled.length === 0) {
    return unavailable("lacunas-semana", "Lacunas da semana");
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: { date: Date; label: string; has: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const has = scheduled.some((c) => {
      const s = parse(c.scheduledAt)!;
      return `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}` === key;
    });
    days.push({
      date: d,
      label: WEEKDAY_LABELS[d.getDay()],
      has,
    });
  }

  const missing = days.filter((d) => !d.has);
  const evidence = [
    `${scheduled.length} conteúdo(s) com data definida`,
    `${days.length - missing.length} dos próximos 7 dias já têm conteúdo`,
  ];

  if (missing.length === 0) {
    return {
      kind: "lacunas-semana",
      title: "Lacunas da semana",
      body: "Os próximos 7 dias já têm conteúdo agendado. Nenhuma lacuna para preencher.",
      evidence,
      available: true,
    };
  }

  return {
    kind: "lacunas-semana",
    title: "Lacunas da semana",
    body: `Sem conteúdo agendado em: ${missing.map((d) => d.label).join(", ")}. Estes são os dias livres dos próximos 7 dias — o Inst Acessor não sugere horário, apenas mostra onde há espaço.`,
    evidence: [...evidence, `Dias livres: ${missing.length}`],
    available: true,
  };
}

// ---------------------------------------------------------------
// 2. CADÊNCIA REAL DE PUBLICAÇÃO
// Real: média de publicações por semana na janela, contada pelas datas de
// publicação efetivamente coletadas (nunca pelo que foi planejado).
// ---------------------------------------------------------------

function publishingCadence(input: SmartCalendarInput): SmartRecommendation {
  const now = parse(input.now);
  if (!now) return unavailable("cadencia", "Cadência de publicação");

  const stamps = input.media
    .map((m) => parse(m.timestamp))
    .filter((d): d is Date => d != null);
  if (stamps.length === 0) {
    return unavailable("cadencia", "Cadência de publicação");
  }

  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - DEFAULT_WINDOW_DAYS);
  const inWindow = stamps.filter((d) => d >= windowStart);

  if (inWindow.length === 0) {
    return unavailable("cadencia", "Cadência de publicação");
  }

  const weeks = DEFAULT_WINDOW_DAYS / 7;
  const perWeek = inWindow.length / weeks;
  const rounded = Math.round(perWeek * 10) / 10;

  return {
    kind: "cadencia",
    title: "Cadência de publicação",
    body: `Nas publicações coletadas dos últimos ${DEFAULT_WINDOW_DAYS} dias, você publicou em média ${rounded} por semana. Este número é medido, não recomendado — use-o como referência para decidir a frequência das próximas semanas.`,
    evidence: [
      `${inWindow.length} publicação(ões) com data nos últimos ${DEFAULT_WINDOW_DAYS} dias`,
      `${input.media.length} publicação(ões) coletadas no total`,
      `Média: ${rounded}/semana`,
    ],
    available: true,
  };
}

// ---------------------------------------------------------------
// 3. MELHORES DIAS DA SEMANA
// Real: agrupa a INTERAÇÃO medida (curtidas + comentários) por dia da semana.
// Só afirma padrão quando a amostra passa do limiar mínimo.
// ---------------------------------------------------------------

function bestWeekdays(input: SmartCalendarInput): SmartRecommendation {
  const rows = input.media
    .map((m) => {
      const d = parse(m.timestamp);
      if (!d) return null;
      // A interação medida é um DERIVADO (curtidas + comentários): só existe
      // quando os DOIS termos existem — regra única em `@/lib/media/derived-metrics`.
      // Com a ausência tratada como 0, o dia da semana de uma publicação sem
      // `comments_count` recebia uma interação MENOR do que a real — e o ranking
      // de "melhores dias" passava a ordenar dias por um artefato de dado
      // faltante, não por desempenho. Publicação incompleta fica de FORA da
      // amostra, e a amostra menor pode fazer o limiar mínimo recusar a
      // conclusão — que é a resposta honesta.
      const interactions = mediaInteractions(m.likeCount, m.commentsCount);
      if (interactions == null) return null;
      return { dow: d.getDay(), interactions };
    })
    .filter((r): r is { dow: number; interactions: number } => r != null);

  if (rows.length < MIN_MEDIA_FOR_WEEKDAY_PATTERN) {
    return unavailable("melhores-dias", "Melhores dias da semana");
  }

  const byDow = new Map<number, { total: number; count: number }>();
  for (const r of rows) {
    const cur = byDow.get(r.dow) ?? { total: 0, count: 0 };
    cur.total += r.interactions;
    cur.count += 1;
    byDow.set(r.dow, cur);
  }

  // Precisa de pelo menos 3 dias distintos: com 2 dias a "comparação" é só
  // dois números, e com 1 não existe comparação nenhuma.
  if (byDow.size < 3) {
    return unavailable("melhores-dias", "Melhores dias da semana");
  }

  const averages = [...byDow.entries()]
    .map(([dow, v]) => ({ dow, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  const top = averages.slice(0, 3);
  const rounding = (n: number) => Math.round(n * 10) / 10;

  return {
    kind: "melhores-dias",
    title: "Melhores dias da semana",
    body: `Considerando a interação média das publicações coletadas, os dias com melhor desempenho foram ${top
      .map((t) => WEEKDAY_LABELS[t.dow])
      .join(", ")}. A conclusão vem do histórico já coletado, não de um horário ideal de mercado.`,
    evidence: [
      `${rows.length} publicações com interação medida`,
      ...top.map(
        (t) => `${WEEKDAY_LABELS[t.dow]}: média ${rounding(t.avg)} de interações em ${t.count} publicação(ões)`
      ),
    ],
    available: true,
  };
}

// ---------------------------------------------------------------
// 4. MELHORES FORMATOS
// Real: agrupa a interação média por `media_product_type` informado pela Meta.
// Mídia sem classificação fica de fora — não é presumida Reel nem feed.
// ---------------------------------------------------------------

function bestFormats(input: SmartCalendarInput): SmartRecommendation {
  const rows = input.media
    .map((m) => {
      const product = m.mediaProductType?.trim().toUpperCase();
      if (!product) return null; // sem classificação da Meta → fora da conta
      // Mesma regra de `bestWeekdays`: derivado exige os dois termos. Sem isso,
      // um formato comparado só pelas curtidas pareceria pior que outro — e a
      // recomendação "melhor formato" apontaria para o lado errado.
      const interactions = mediaInteractions(m.likeCount, m.commentsCount);
      if (interactions == null) return null;
      return { product, interactions };
    })
    .filter((r): r is { product: string; interactions: number } => r != null);

  if (rows.length < MIN_CLASSIFIED_FOR_FORMAT_PATTERN) {
    return unavailable("melhores-formatos", "Desempenho por formato");
  }

  const byProduct = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const cur = byProduct.get(r.product) ?? { total: 0, count: 0 };
    cur.total += r.interactions;
    cur.count += 1;
    byProduct.set(r.product, cur);
  }

  if (byProduct.size < 2) {
    return unavailable("melhores-formatos", "Desempenho por formato");
  }

  const averages = [...byProduct.entries()]
    .map(([product, v]) => ({ product, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  const rounding = (n: number) => Math.round(n * 10) / 10;
  const productLabel = (p: string) =>
    p === "REELS" ? "Reels" : p === "FEED" ? "Feed" : p === "STORY" ? "Stories" : p;

  const best = averages[0];

  return {
    kind: "melhores-formatos",
    title: "Desempenho por formato",
    body: `Entre as publicações que a Meta classificou por formato, ${productLabel(best.product)} teve a maior interação média. A comparação usa apenas mídias com classificação informada pela Meta.`,
    evidence: [
      `${rows.length} publicações classificadas com interação medida`,
      ...averages.map(
        (a) => `${productLabel(a.product)}: média ${rounding(a.avg)} em ${a.count} publicação(ões)`
      ),
    ],
    available: true,
  };
}

// ---------------------------------------------------------------
// 5. TENDÊNCIA DE ALCANCE / SEGUIDORES
// Real: compara a leitura mais antiga e a mais recente dos snapshots.
// ---------------------------------------------------------------

function reachTrend(input: SmartCalendarInput): SmartRecommendation {
  const withFollowers = input.snapshots
    .map((s) => ({ d: parse(s.capturedAt), followers: s.followersCount }))
    .filter((s): s is { d: Date; followers: number } => s.d != null && s.followers != null)
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  if (withFollowers.length < MIN_SNAPSHOTS_FOR_TREND) {
    return unavailable("tendencia-alcance", "Tendência de seguidores");
  }

  const first = withFollowers[0];
  const last = withFollowers[withFollowers.length - 1];
  const delta = last.followers - first.followers;
  const days = Math.max(
    1,
    Math.round((last.d.getTime() - first.d.getTime()) / 86_400_000)
  );

  const direction = delta > 0 ? "aumento" : delta < 0 ? "queda" : "estabilidade";
  const sign = delta > 0 ? "+" : "";

  return {
    kind: "tendencia-alcance",
    title: "Tendência de seguidores",
    body: `Entre ${formatDay(first.d.toISOString())} e ${formatDay(
      last.d.toISOString()
    )} houve ${direction} de ${sign}${delta} seguidores. A leitura usa as sincronizações registradas — sem sincronizar novamente, a série não avança.`,
    evidence: [
      `${withFollowers.length} leituras de seguidores em ${days} dia(s)`,
      `${formatDay(first.d.toISOString())}: ${first.followers} · ${formatDay(last.d.toISOString())}: ${last.followers}`,
    ],
    available: true,
  };
}

// ---------------------------------------------------------------
// 6. METAS COM PRAZO
// Real: metas ATIVAS que têm prazo definido, ordenadas pelo prazo.
// ---------------------------------------------------------------

function goalDeadlines(input: SmartCalendarInput): SmartRecommendation {
  const now = parse(input.now);
  if (!now) return unavailable("metas-prazo", "Metas com prazo");

  const withDeadline = input.goals
    .filter((g) => g.status === "ATIVA")
    .map((g) => ({ goal: g, deadline: parse(g.deadline) }))
    .filter((g): g is { goal: GoalInput; deadline: Date } => g.deadline != null)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  if (withDeadline.length === 0) {
    return unavailable("metas-prazo", "Metas com prazo");
  }

  const lines = withDeadline.slice(0, 3).map(({ goal, deadline }) => {
    const remaining = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
    const progress =
      goal.targetValue > 0
        ? Math.round((goal.currentValue / goal.targetValue) * 1000) / 10
        : null;
    const when =
      remaining > 0
        ? `vence em ${remaining} dia(s)`
        : remaining === 0
          ? "vence hoje"
          : `venceu há ${Math.abs(remaining)} dia(s)`;
    const pct = progress != null ? ` · ${progress}% concluída` : "";
    return `${goal.title} — ${when}${pct}`;
  });

  return {
    kind: "metas-prazo",
    title: "Metas com prazo",
    body: `Você tem ${withDeadline.length} meta(s) ativa(s) com prazo definido. Use o calendário para reservar os dias que servem a elas.`,
    evidence: lines,
    available: true,
  };
}

// ---------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------

export function buildSmartCalendar(input: SmartCalendarInput): SmartCalendarResult {
  const recommendations: SmartRecommendation[] = [
    weeklyGaps(input),
    publishingCadence(input),
    bestWeekdays(input),
    bestFormats(input),
    reachTrend(input),
    goalDeadlines(input),
  ];

  const mediaWithInteractions = input.media.filter(
    (m) => m.likeCount != null || m.commentsCount != null
  ).length;
  const classifiedMediaCount = input.media.filter(
    (m) => typeof m.mediaProductType === "string" && m.mediaProductType.trim().length > 0
  ).length;

  return {
    recommendations,
    availableCount: recommendations.filter((r) => r.available).length,
    total: recommendations.length,
    context: {
      plannedCount: input.plannedContents.length,
      mediaCount: input.media.length,
      mediaWithInteractions,
      classifiedMediaCount,
      snapshotCount: input.snapshots.length,
      activeGoals: input.goals.filter((g) => g.status === "ATIVA").length,
      windowDays: DEFAULT_WINDOW_DAYS,
    },
  };
}
