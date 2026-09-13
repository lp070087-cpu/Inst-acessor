import { pl } from "@/lib/planning/db";
import { kb } from "@/lib/knowledge/repository";
import type { PlannedContentView } from "@/lib/planning/content";

/**
 * CALENDÁRIO — Fase 6
 * ====================
 * Agregação dos conteúdos planejados em visões de calendário
 * (mês / semana / lista), para a página /calendario.
 *
 * Regras:
 * - Conteúdo sem data agendada aparece em "Sem data" (lista) e é tratado
 *   como pendente de agendamento nas visões mês/semana.
 * - NUNCA inventa datas, horários ou "melhores momentos" — apenas agrupa
 *   o que o usuário definiu.
 */

export interface CalendarDay {
  date: string; // yyyy-mm-dd
  items: PlannedContentView[];
}

export interface CalendarView {
  view: "month" | "week" | "list";
  /** Conteúdo sem data agendada (fora da grade). */
  unscheduled: PlannedContentView[];
  /** Dias com conteúdo (mês/semana) ou lista plana (lista). */
  days: CalendarDay[];
  total: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Monta a visão de calendário a partir dos conteúdos já filtrados.
 * `anchor` = data âncora (ISO) para o mês/semana; sem âncora usa hoje.
 */
export function buildCalendarView(
  contents: PlannedContentView[],
  view: "month" | "week" | "list",
  anchorIso?: string
): CalendarView {
  const anchor = anchorIso ? new Date(anchorIso) : new Date();

  const unscheduled: PlannedContentView[] = [];
  const byDay = new Map<string, PlannedContentView[]>();

  for (const c of contents) {
    if (!c.scheduledAt) {
      unscheduled.push(c);
      continue;
    }
    const key = toDayKey(new Date(c.scheduledAt));
    const list = byDay.get(key) ?? [];
    list.push(c);
    byDay.set(key, list);
  }

  // Determina o conjunto de dias visíveis (mês ou semana da âncora).
  const visibleDays = new Set<string>();
  if (view === "month") {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      visibleDays.add(toDayKey(d));
    }
  } else if (view === "week") {
    const start = new Date(anchor);
    const day = start.getDay();
    start.setDate(start.getDate() - day); // domingo como início
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      visibleDays.add(toDayKey(d));
    }
  }

  const days: CalendarDay[] = [];
  if (view === "list") {
    // Lista: agrupa por data, incluindo itens fora do período (agrupados).
    const keys = [...byDay.keys()].sort();
    for (const key of keys) {
      days.push({ date: key, items: byDay.get(key) ?? [] });
    }
  } else {
    for (const key of [...visibleDays]) {
      days.push({ date: key, items: byDay.get(key) ?? [] });
    }
    days.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  return { view, unscheduled, days, total: contents.length };
}

/**
 * Métricas de pipeline — contagem por estado, para os cards da página.
 */
export interface PipelineCounts {
  total: number;
  rascunho: number;
  ideia: number;
  emProducao: number;
  pronto: number;
  agendado: number;
  publicado: number;
  cancelado: number;
  falhou: number;
}

export function computePipelineCounts(contents: PlannedContentView[]): PipelineCounts {
  const counts: PipelineCounts = {
    total: contents.length,
    rascunho: 0,
    ideia: 0,
    emProducao: 0,
    pronto: 0,
    agendado: 0,
    publicado: 0,
    cancelado: 0,
    falhou: 0,
  };
  for (const c of contents) {
    switch (c.status) {
      case "RASCUNHO":
        counts.rascunho++;
        break;
      case "IDEIA":
        counts.ideia++;
        break;
      case "EM_PRODUCAO":
        counts.emProducao++;
        break;
      case "PRONTO":
        counts.pronto++;
        break;
      case "AGENDADO":
        counts.agendado++;
        break;
      case "PUBLICADO":
        counts.publicado++;
        break;
      case "CANCELADO":
        counts.cancelado++;
        break;
      case "FALHOU":
        counts.falhou++;
        break;
    }
  }
  return counts;
}

/**
 * Associação conteúdo ↔ experimento (N:N).
 * Idempotente via @@unique([contentId, experimentId]).
 * NUNCA inventa resultados — apenas prepara a associação para medição futura.
 */
export async function attachExperimentToContent(
  userId: string,
  contentId: string,
  experimentId: string
): Promise<boolean> {
  const content = (await pl.content.findUnique({ where: { id: contentId } })) as unknown as
    | { userId: string }
    | null;
  if (!content || content.userId !== userId) return false;

  const experiment = (await kb.experiment.findUnique({
    where: { id: experimentId },
  })) as unknown as { userId: string } | null;
  if (!experiment || experiment.userId !== userId) return false;

  try {
    await pl.contentExperiment.create({
      data: { contentId, experimentId },
    });
  } catch {
    // Já associado (constraint única) — não é erro.
  }
  return true;
}

/** Remove a associação conteúdo ↔ experimento. */
export async function detachExperimentFromContent(
  userId: string,
  contentId: string,
  experimentId: string
): Promise<boolean> {
  const content = (await pl.content.findUnique({ where: { id: contentId } })) as unknown as
    | { userId: string }
    | null;
  if (!content || content.userId !== userId) return false;

  await pl.contentExperiment.deleteMany({
    where: { contentId, experimentId },
  });
  return true;
}
