/**
 * IMPULSO / RITMO — NÚCLEO PURO (rodada #274)
 * ===========================================
 * Metas PRONTAS (diárias/semanais/mensais) + XP + sequência/streak.
 *
 * Este arquivo contém SOMENTE lógica pura (sem banco, sem APIs) para permitir
 * testes determinísticos no padrão dos demais harnesses (node:assert). As
 * funções que tocam Prisma vivem em `momentum.ts`, que re-exporta este módulo.
 *
 * Lista oficial (regras da DONA):
 *   DIÁRIAS   — Ganhar seguidores, Gerar ideias, Criar copy,
 *               Utilizar IA Acessor, Publicar conteúdo
 *   SEMANAIS  — Crescimento de seguidores, Crescimento de alcance,
 *               Crescimento de engajamento, Conteúdos publicados, Copies criadas
 *   MENSAIS   — Meta de seguidores, Meta de alcance, Meta de engajamento,
 *               Meta de crescimento geral
 *   STREAK    — 3 / 7 / 15 / 30 dias
 *
 * Princípios (ESCOPO-OFICIAL + regras da DONA):
 * - Nenhum dado inventado: cada progresso mede uma tabela REAL (XpLog,
 *   InstagramSnapshot/TikTokSnapshot, GeneratedCopy, ContentIdea, AIMessage,
 *   PublishLog). Sem evidência → current 0 e available=false (estado
 *   "sem-dados"), nunca um número fabricado.
 * - Nenhuma duplicidade de XP: a MESMA meta no MESMO período NUNCA paga duas
 *   vezes — reusa XpLog `@@unique([userId, source, refId])`.
 */

export type RitmoPeriod = "dia" | "semana" | "mes";
export type RitmoCardStatus = "pendente" | "concluida" | "sem-dados";

export interface RitmoCard {
  id: string; // `${bandId}:${periodKey}`
  bandId: string;
  period: RitmoPeriod;
  periodKey: string; // "2026-09-02" | "2026-W36" | "2026-09"
  title: string;
  subtitle: string;
  current: number;
  target: number;
  unit: string;
  isPercent: boolean;
  progressPercent: number;
  status: RitmoCardStatus;
  xpReward: number;
  remainingLabel: string;
  available: boolean;
  granted: boolean;
}

export interface RitmoState {
  cards: RitmoCard[];
  streakDays: number;
  activeWeekStreak: number;
  nextStreakBonus: number;
  todayXp: number;
  bonusXpGranted: number;
}

/** Linha de XP (projeção mínima usada nos derivadores puros). */
export interface XpRowLike {
  createdAt: Date;
  source: string;
  refId: string;
  amount: number;
}

export interface SnapshotRow {
  capturedAt: Date;
  followersCount: number | null;
  reach: number | null;
  engagement: number | null;
}

/** Evidências coletadas UMA vez e derivadas em memória para dia/semana/mês. */
export interface Gather {
  now: Date;
  ig: SnapshotRow[];
  tt: SnapshotRow[];
  xpRows: XpRowLike[];
  actions: {
    copies: Date[];
    ideias: Date[];
    ia: Date[];
    publicacoes: Date[];
  };
  /** Mês corrente (limite inferior de toda a série de ações). */
  monthStart: Date;
}

// ------------------------------------------------------------
// Janelas de tempo
// ------------------------------------------------------------

export function startOfDay(d = new Date()): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function startOfWeek(d = new Date()): Date {
  const c = startOfDay(d);
  const day = c.getDay();
  c.setDate(c.getDate() + (day === 0 ? -6 : 1 - day)); // segunda-feira
  return c;
}

export function startOfMonth(d = new Date()): Date {
  const c = new Date(d);
  c.setDate(1);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function fmtDay(d: Date): string {
  const c = new Date(d);
  return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
}

/** Chave ISO da semana (ex.: "2026-W36"), segunda = início. */
export function weekKey(d: Date): string {
  const c = new Date(startOfWeek(d));
  const yearStart = new Date(c.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((c.getTime() - yearStart.getTime()) / 864e5 + yearStart.getDay() + 1) / 7
  );
  return `${c.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// Configuração das metas prontas
// ------------------------------------------------------------

/** Unidade/plural de um alvo de contagem. */
function unitForCount(title: string, n: number): string {
  if (/seguidores/i.test(title)) return "seguidores";
  if (/ideia/i.test(title)) return n === 1 ? "ideia" : "ideias";
  if (/copy/i.test(title)) return n === 1 ? "copy" : "copies";
  if (/IA|consulta/i.test(title)) return n === 1 ? "consulta" : "consultas";
  if (/publica|conteúdo|conteudo/i.test(title)) return n === 1 ? "publicação" : "publicações";
  return "";
}

export type BandMetric =
  | "seguidores"
  | "ideias"
  | "copies"
  | "ia"
  | "publicacoes"
  | "alcance"
  | "engajamento"
  | "crescimento";

export interface CadenceBand {
  id: string;
  period: RitmoPeriod;
  title: string;
  metric: BandMetric;
  target: number;
  unit: string;
  isPercent: boolean;
  xp: number;
  source: string; // fonte de XP ("ritmo-*")
}

export const RITMO_BANDS: CadenceBand[] = [
  // --- Diárias ---
  { id: "ganhar-seguidores", period: "dia", title: "Ganhar seguidores", metric: "seguidores", target: 10, unit: "seguidores", isPercent: false, xp: 10, source: "ritmo-seguidores" },
  { id: "gerar-ideias", period: "dia", title: "Gerar ideias", metric: "ideias", target: 2, unit: "ideias", isPercent: false, xp: 8, source: "ritmo-ideias" },
  { id: "criar-copy", period: "dia", title: "Criar copy", metric: "copies", target: 1, unit: "copy", isPercent: false, xp: 8, source: "ritmo-copy" },
  { id: "usar-ia", period: "dia", title: "Utilizar IA Acessor", metric: "ia", target: 3, unit: "consultas", isPercent: false, xp: 10, source: "ritmo-ia" },
  { id: "publicar-conteudo", period: "dia", title: "Publicar conteúdo", metric: "publicacoes", target: 1, unit: "publicação", isPercent: false, xp: 12, source: "ritmo-publicar" },
  // --- Semanais ---
  { id: "crescer-seguidores", period: "semana", title: "Crescimento de seguidores", metric: "seguidores", target: 20, unit: "seguidores", isPercent: false, xp: 25, source: "ritmo-seguidores" },
  { id: "crescer-alcance", period: "semana", title: "Crescimento de alcance", metric: "alcance", target: 15, unit: "%", isPercent: true, xp: 30, source: "ritmo-alcance" },
  { id: "crescer-engajamento", period: "semana", title: "Crescimento de engajamento", metric: "engajamento", target: 15, unit: "%", isPercent: true, xp: 30, source: "ritmo-engajamento" },
  { id: "publicar-semana", period: "semana", title: "Conteúdos publicados", metric: "publicacoes", target: 3, unit: "publicações", isPercent: false, xp: 20, source: "ritmo-publicar" },
  { id: "copies-semana", period: "semana", title: "Copies criadas", metric: "copies", target: 5, unit: "copies", isPercent: false, xp: 20, source: "ritmo-copy" },
  // --- Mensais ---
  { id: "meta-seguidores", period: "mes", title: "Meta de seguidores", metric: "seguidores", target: 80, unit: "seguidores", isPercent: false, xp: 60, source: "ritmo-seguidores" },
  { id: "meta-alcance", period: "mes", title: "Meta de alcance", metric: "alcance", target: 25, unit: "%", isPercent: true, xp: 80, source: "ritmo-alcance" },
  { id: "meta-engajamento", period: "mes", title: "Meta de engajamento", metric: "engajamento", target: 25, unit: "%", isPercent: true, xp: 80, source: "ritmo-engajamento" },
  { id: "meta-crescimento", period: "mes", title: "Meta de crescimento geral", metric: "crescimento", target: 10, unit: "%", isPercent: true, xp: 100, source: "ritmo-crescimento" },
];

export const RITMO_KINDS = RITMO_BANDS.map((b) => b.id);
export const RITMO_PERIODS: RitmoPeriod[] = ["dia", "semana", "mes"];

const PERIOD_LABEL: Record<RitmoPeriod, string> = {
  dia: "hoje",
  semana: "na semana",
  mes: "no mês",
};

function bandSubtitle(band: CadenceBand): string {
  if (band.isPercent) {
    return `Meta: +${band.target}% ${band.metric === "alcance" ? "de alcance" : band.metric === "engajamento" ? "de engajamento" : "de crescimento"} ${PERIOD_LABEL[band.period]}`;
  }
  const u = band.unit || unitForCount(band.title, band.target);
  return `Meta: ${band.metric === "seguidores" ? "+" : ""}${band.target} ${u} ${PERIOD_LABEL[band.period]}`;
}

// ------------------------------------------------------------
// Streak (dias corridos) + semanas ativas — derivados de XpLog
// ------------------------------------------------------------

/** Deriva streak + semanas ativas a partir das linhas de XpLog (puro). */
export function deriveStreak(
  rows: XpRowLike[],
  today: Date = new Date()
): { streakDays: number; activeWeekStreak: number } {
  if (rows.length === 0) return { streakDays: 0, activeWeekStreak: 0 };

  const days = new Set<string>();
  for (const r of rows) days.add(fmtDay(r.createdAt));

  // Dias corridos (se hoje ainda não tem XP, conta a partir de ontem).
  let cursor = startOfDay(today);
  if (!days.has(fmtDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(fmtDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Semanas ativas consecutivas (≥3 dias com XP) — retrocede por chave de semana.
  const activeWeek = new Map<string, number>();
  for (const d of days) {
    const [y, m, dd] = d.split("-").map(Number);
    const wk = weekKey(new Date(y, m - 1, dd));
    activeWeek.set(wk, (activeWeek.get(wk) ?? 0) + 1);
  }

  let activeWeekStreak = 0;
  const anchor = startOfWeek(today); // segunda-feira corrente (âncora estável)
  let wkCursor = weekKey(anchor);
  for (;;) {
    if ((activeWeek.get(wkCursor) ?? 0) < 3) break;
    activeWeekStreak += 1;
    anchor.setDate(anchor.getDate() - 7); // recua exatamente uma semana
    wkCursor = weekKey(anchor);
  }

  return { streakDays: streak, activeWeekStreak };
}

// ------------------------------------------------------------
// Bônus de sequência (3/7/15/30) — idempotente por source+refId
// ------------------------------------------------------------

export const STREAK_BONUS_MILESTONES = [3, 7, 15, 30] as const;
export const STREAK_BONUS_XP: Record<number, number> = { 3: 20, 7: 50, 15: 120, 30: 300 };

// ------------------------------------------------------------
// Derivadores puros por janela
// ------------------------------------------------------------

/** Linha imediatamente anterior à janela (baseline), ou null. */
export function baselineBefore(
  series: SnapshotRow[],
  since: Date
): SnapshotRow | null {
  let base: SnapshotRow | null = null;
  for (const s of series) {
    if (s.capturedAt.getTime() >= since.getTime()) break;
    base = s;
  }
  return base;
}

export function inWindow(series: SnapshotRow[], since: Date): SnapshotRow[] {
  return series.filter((s) => s.capturedAt.getTime() >= since.getTime());
}

/**
 * Delta absoluto de seguidores IG+TikTok dentro da janela (real).
 * Só reporta valor se houver ao menos UM snapshot DENTRO da janela com
 * seguidores (senão não sabemos o número atual ainda → sem-dados honesto).
 * O baseline é a última leitura ANTES da janela.
 */
export function followersDelta(g: Gather, since: Date): { value: number; available: boolean } {
  const platforms = [g.ig, g.tt];
  let delta = 0;
  let measured = false;
  for (const series of platforms) {
    const rows = inWindow(series, since).filter((s) => s.followersCount != null);
    if (rows.length === 0) continue;
    measured = true;
    const last = rows[rows.length - 1].followersCount as number;
    const base = baselineBefore(series, since)?.followersCount;
    delta += typeof base === "number" ? Math.max(0, last - base) : 0;
  }
  return { value: measured ? delta : 0, available: measured };
}

/** Crescimento % de uma métrica de snapshot (alcance/engajamento). */
export function growthPct(
  series: SnapshotRow[],
  since: Date,
  key: "reach" | "engagement"
): { value: number; available: boolean } {
  const rows = inWindow(series, since)
    .filter((s) => s[key] != null)
    .map((s) => s[key] as number);
  if (rows.length === 0) return { value: 0, available: false };
  const latest = rows[rows.length - 1];
  const base = baselineBefore(series, since)?.[key];
  const startRef =
    typeof base === "number" ? base : rows.length >= 2 ? rows[0] : null;
  if (startRef === null) return { value: 0, available: false };
  if (startRef <= 0) {
    return { value: latest > 0 ? 100 : 0, available: true };
  }
  const pct = Math.max(0, Math.round(((latest - startRef) / startRef) * 100));
  return { value: pct, available: true };
}

/** Crescimento % de seguidores IG+TikTok combinados (crescimento geral). */
export function combinedGrowthPct(g: Gather, since: Date): { value: number; available: boolean } {
  let latestTotal = 0;
  let baseTotal: number | null = null;
  let measured = false;
  for (const series of [g.ig, g.tt]) {
    const rows = inWindow(series, since).filter((s) => s.followersCount != null);
    if (rows.length === 0) continue;
    measured = true;
    const last = rows[rows.length - 1].followersCount as number;
    const base = baselineBefore(series, since)?.followersCount;
    latestTotal += last;
    if (typeof base === "number") baseTotal = (baseTotal ?? 0) + base;
  }
  if (!measured) return { value: 0, available: false };
  if (baseTotal === null || baseTotal <= 0) return { value: 0, available: false };
  const pct = Math.max(0, Math.round(((latestTotal - baseTotal) / baseTotal) * 100));
  return { value: pct, available: true };
}

export function countSince(dates: Date[], since: Date): number {
  return dates.filter((d) => d.getTime() >= since.getTime()).length;
}

export function measureBand(
  g: Gather,
  band: CadenceBand,
  since: Date
): { value: number; available: boolean } {
  switch (band.metric) {
    case "seguidores":
      return followersDelta(g, since);
    case "alcance":
      return growthPct(g.ig, since, "reach");
    case "engajamento":
      return growthPct(g.ig, since, "engagement");
    case "crescimento":
      return combinedGrowthPct(g, since);
    case "ideias":
      return { value: countSince(g.actions.ideias, since), available: true };
    case "copies":
      return { value: countSince(g.actions.copies, since), available: true };
    case "ia":
      return { value: countSince(g.actions.ia, since), available: true };
    case "publicacoes":
      return { value: countSince(g.actions.publicacoes, since), available: true };
    default:
      return { value: 0, available: false };
  }
}

// ------------------------------------------------------------
// Montagem dos cards + estado
// ------------------------------------------------------------

export function windows(g: Gather): Record<RitmoPeriod, { since: Date; until: Date; key: string }> {
  return {
    dia: {
      since: startOfDay(g.now),
      until: startOfDay(new Date(g.now.getTime() + 864e5)),
      key: fmtDay(g.now),
    },
    semana: {
      since: startOfWeek(g.now),
      until: new Date(startOfWeek(g.now).getTime() + 7 * 864e5),
      key: weekKey(g.now),
    },
    mes: {
      since: startOfMonth(g.now),
      until: new Date(g.now.getFullYear(), g.now.getMonth() + 1, 1),
      key: monthKey(g.now),
    },
  };
}

export function remainingLabel(period: RitmoPeriod, until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "Encerra agora";
  if (period === "dia") {
    const h = Math.max(1, Math.ceil(ms / 36e5));
    return `Restam ${h}h`;
  }
  const d = Math.max(1, Math.ceil(ms / 864e5));
  return `Restam ${d} ${d === 1 ? "dia" : "dias"}`;
}

export function buildCards(
  g: Gather,
  w: ReturnType<typeof windows>,
  grantedSet: Set<string>
): RitmoCard[] {
  const cards: RitmoCard[] = [];
  for (const band of RITMO_BANDS) {
    const win = w[band.period];
    const ev = measureBand(g, band, win.since);
    const done = ev.available && ev.value >= band.target;
    const granted = ev.available
      ? grantedSet.has(`${band.source}:${win.key}`)
      : false;

    cards.push({
      id: `${band.id}:${win.key}`,
      bandId: band.id,
      period: band.period,
      periodKey: win.key,
      title: band.title,
      subtitle: bandSubtitle(band),
      // current mostra o valor REAL medido (não truncado) quando disponível.
      current: ev.available ? ev.value : 0,
      target: band.target,
      unit: band.isPercent ? "%" : band.unit || unitForCount(band.title, band.target),
      isPercent: band.isPercent,
      progressPercent: ev.available
        ? Math.min(100, Math.round((ev.value / band.target) * 100))
        : 0,
      status: !ev.available ? "sem-dados" : done ? "concluida" : "pendente",
      xpReward: band.xp,
      remainingLabel: ev.available
        ? remainingLabel(band.period, win.until)
        : band.metric === "seguidores" ||
            band.metric === "alcance" ||
            band.metric === "engajamento" ||
            band.metric === "crescimento"
          ? "Conecte e sincronize para medir"
          : "Sem dados no período",
      available: ev.available,
      granted,
    });
  }
  return cards;
}

export function buildState(
  g: Gather,
  grantedSet: Set<string>,
  bonusesGranted: number[]
): RitmoState {
  const w = windows(g);
  const { streakDays, activeWeekStreak } = deriveStreak(g.xpRows, g.now);
  const todayKey = fmtDay(g.now);
  const todayXp = g.xpRows
    .filter((r) => fmtDay(r.createdAt) === todayKey)
    .reduce((s, r) => s + r.amount, 0);
  const bonusXpGranted = bonusesGranted.reduce((s, d) => s + (STREAK_BONUS_XP[d] ?? 0), 0);

  return {
    cards: buildCards(g, w, grantedSet),
    streakDays,
    activeWeekStreak,
    nextStreakBonus:
      STREAK_BONUS_MILESTONES.find((m) => m > streakDays) ??
      STREAK_BONUS_MILESTONES[STREAK_BONUS_MILESTONES.length - 1],
    todayXp,
    bonusXpGranted,
  };
}
