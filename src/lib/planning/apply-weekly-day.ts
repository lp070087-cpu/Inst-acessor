import { pl } from "@/lib/planning/db";
import {
  createPlannedContent,
  getPlannedContent,
  type PlannedContentView,
} from "@/lib/planning/content";
import { buildWeeklyPlan } from "@/lib/planning/weekly-plan";

/**
 * OPERAÇÃO REAL DO PLANO SEMANAL
 * ===============================
 * Transforma a sugestão de UM dia do plano em conteúdo planejado de verdade,
 * persistido em `PlannedContent` (mesmo modelo/rotas do calendário — nada de
 * armazenamento paralelo).
 *
 * Regras:
 * - A sugestão é RECALCULADA no servidor a partir do plano real. O cliente só
 *   informa QUAL dia (weekday) quer aceitar; o texto nunca vem do navegador.
 * - DEDUP: cada dia de cada semana tem um marcador estável gravado em `notes`
 *   (`[plano-semanal:<yyyy-mm-dd>]`). Se já existir conteúdo com o mesmo
 *   marcador, NÃO cria de novo — devolve o que já existe. Assim, clicar duas
 *   vezes (ou regerar o plano) nunca duplica a mesma sugestão.
 * - NUNCA inventa horário: sem `scheduledAt` informado, o conteúdo nasce como
 *   RASCUNHO (sem data) e a DONA define o horário no calendário.
 */

export interface ApplyWeeklyDayInput {
  userId: string;
  /** 0 = Domingo … 6 = Sábado. */
  weekday: number;
  /** Data ISO opcional para já agendar (escolhida pela usuária, nunca inferida). */
  scheduledAt?: string | null;
}

export type ApplyWeeklyDayResult =
  | {
      ok: true;
      created: boolean;
      alreadyExisted: boolean;
      content: PlannedContentView;
      marker: string;
    }
  | { ok: false; error: string };

/** Marcador estável e auditável (busca por `notes contains`). */
export function weeklyDayMarker(dayIso: string): string {
  return `[plano-semanal:${dayIso.slice(0, 10)}]`;
}

export async function applyWeeklyPlanDay(
  input: ApplyWeeklyDayInput
): Promise<ApplyWeeklyDayResult> {
  const { userId, weekday } = input;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, error: "Dia inválido." };
  }

  // Recalcula o plano REAL no servidor — a fonte de verdade da sugestão.
  const plan = await buildWeeklyPlan(userId);
  const day = plan.days.find((d) => d.weekday === weekday);
  if (!day) {
    return { ok: false, error: "Dia não encontrado no plano da semana." };
  }
  if (!day.suggestion) {
    return { ok: false, error: "Este dia já tem conteúdo planejado nesta semana." };
  }

  const marker = weeklyDayMarker(day.dateIso);

  // DEDUP: se já existe um conteúdo com este marcador, devolve o existente.
  const existing = (await pl.content.findMany({
    where: { userId, notes: { contains: marker } },
    take: 1,
  })) as unknown as
    | { id: string }[]
    | undefined;

  if (existing && existing.length > 0) {
    const found = await getPlannedContent(userId, existing[0].id);
    if (found) {
      return { ok: true, created: false, alreadyExisted: true, content: found, marker };
    }
  }

  const created = await createPlannedContent(userId, {
    platform: day.suggestion.platform,
    format: day.suggestion.format,
    title: day.suggestion.title,
    objective: day.suggestion.objective,
    // Sem horário informado → RASCUNHO (nunca um horário inventado).
    scheduledAt: input.scheduledAt ?? null,
    notes: `${day.suggestion.basedOn}\n\n${marker}`,
    hypothesis: "",
  });

  return { ok: true, created: true, alreadyExisted: false, content: created, marker };
}
