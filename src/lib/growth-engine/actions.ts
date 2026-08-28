import { ge } from "./db";
import type {
  CreateGrowthActionInput,
  GrowthActionStatus,
  GrowthActionView,
  GrowthContext,
  GrowthRecommendation,
} from "./types";
import { GrowthEngineError } from "./types";
import { notFoundError, validationError } from "./errors";
import { grantXpAmount } from "@/lib/gamification/xp";

/**
 * AÇÕES DE CRESCIMENTO (GrowthAction) — Fase 8 (Parte 7 + Parte 17)
 * ==================================================================
 * Plano de ação operacional. Persistido em `GrowthAction`.
 *
 * Regras:
 * - owner-check: `userId` da sessão é a fonte de verdade.
 * - Deduplicação: não criar ação repetida para o mesmo `sourceRecommendation`
 *   (quando existir) — evita spam de ações idênticas.
 * - XP (Parte 17): concedido SOMENTE quando a ação é concluída de verdade
 *   (status COMPLETED) e UMA ÚNICA vez (idempotente por source+refId).
 * - Não duplica UserGoal nem PlannedContent: ação é recomendação executável.
 */

function toView(row: Record<string, unknown>): GrowthActionView {
  return {
    id: row.id as string,
    platform: (row.platform as "instagram" | "tiktok") ?? "instagram",
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    reason: (row.reason as string | null) ?? null,
    priority: (row.priority as 1 | 2 | 3) ?? 2,
    status: (row.status as GrowthActionStatus) ?? "PENDING",
    dueAt: row.dueAt ? new Date(row.dueAt as string).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt as string).toISOString() : null,
    dismissedAt: row.dismissedAt ? new Date(row.dismissedAt as string).toISOString() : null,
    sourceSignal: (row.sourceSignal as GrowthActionView["sourceSignal"]) ?? null,
    sourceRecommendation: (row.sourceRecommendation as string | null) ?? null,
    metricToWatch: (row.metricToWatch as string | null) ?? null,
    baselineValue: (row.baselineValue as number | null) ?? null,
    resultValue: (row.resultValue as number | null) ?? null,
    resultNote: (row.resultNote as string | null) ?? null,
    xpGranted: Boolean(row.xpGranted),
    createdAt: new Date(row.createdAt as string).toISOString(),
  };
}

/** Lista ações do usuário (mais recentes primeiro). */
export async function listActions(
  userId: string,
  status?: GrowthActionStatus
): Promise<GrowthActionView[]> {
  const rows = await ge.action.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
  return (rows as unknown as Record<string, unknown>[]).map(toView);
}

/** Busca uma ação (owner-check). */
export async function getAction(
  userId: string,
  id: string
): Promise<GrowthActionView | null> {
  const row = await ge.action.findUnique({ where: { id } });
  if (!row) return null;
  if ((row as unknown as Record<string, unknown>).userId !== userId) return null;
  return toView(row as unknown as Record<string, unknown>);
}

/** Cria uma ação (com deduplicação por sourceRecommendation, quando houver). */
export async function createAction(
  userId: string,
  input: CreateGrowthActionInput
): Promise<GrowthActionView> {
  // Deduplicação: mesma recomendação não vira duas ações pendentes.
  if (input.sourceRecommendation) {
    const existing = await ge.action.findFirst({
      where: {
        userId,
        sourceRecommendation: input.sourceRecommendation,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });
    if (existing) {
      throw validationError(
        "Já existe uma ação pendente para esta recomendação."
      );
    }
  }

  const created = await ge.action.create({
    data: {
      userId,
      platform: input.platform,
      title: input.title,
      description: input.description ?? null,
      reason: input.reason ?? null,
      priority: input.priority,
      status: "PENDING",
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      sourceSignal: input.sourceSignal ?? null,
      sourceRecommendation: input.sourceRecommendation ?? null,
      metricToWatch: input.metricToWatch ?? null,
      baselineValue: input.baselineValue ?? null,
      xpGranted: false,
    },
  });
  return toView(created as unknown as Record<string, unknown>);
}

/** Atualiza o status de uma ação (com owner-check). */
export async function updateActionStatus(
  userId: string,
  id: string,
  status: GrowthActionStatus,
  extra?: { resultValue?: number; resultNote?: string }
): Promise<GrowthActionView | null> {
  const row = await ge.action.findUnique({ where: { id } });
  if (!row) return null;
  if ((row as unknown as Record<string, unknown>).userId !== userId) return null;

  const now = new Date();
  const data: Record<string, unknown> = { status };

  if (status === "COMPLETED") {
    data.completedAt = now;
    if (extra?.resultValue != null) data.resultValue = extra.resultValue;
    if (extra?.resultNote) data.resultNote = extra.resultNote;
  } else if (status === "DISMISSED") {
    data.dismissedAt = now;
  }

  const updated = await ge.action.update({
    where: { id },
    data,
  });
  return toView(updated as unknown as Record<string, unknown>);
}

/** Exclui uma ação (owner-check). */
export async function deleteAction(userId: string, id: string): Promise<boolean> {
  const row = await ge.action.findUnique({ where: { id } });
  if (!row) return false;
  if ((row as unknown as Record<string, unknown>).userId !== userId) return false;
  await ge.action.delete({ where: { id } });
  return true;
}

/**
 * Conclui uma ação e concede XP (Parte 17) — idempotente.
 * XP apenas quando a ação foi de fato concluída e nunca foi premiada.
 */
export async function completeActionWithXp(
  userId: string,
  id: string,
  extra?: { resultValue?: number; resultNote?: string }
): Promise<{ action: GrowthActionView | null; xp: { granted: boolean; amount: number; alreadyGranted: boolean } }> {
  const row = await ge.action.findUnique({ where: { id } });
  if (!row) return { action: null, xp: { granted: false, amount: 0, alreadyGranted: false } };
  const record = row as unknown as Record<string, unknown>;
  if (record.userId !== userId) return { action: null, xp: { granted: false, amount: 0, alreadyGranted: false } };

  const alreadyCompleted = record.status === "COMPLETED";
  const updated = await ge.action.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      ...(extra?.resultValue != null ? { resultValue: extra.resultValue } : {}),
      ...(extra?.resultNote ? { resultNote: extra.resultNote } : {}),
    },
  });
  const view = toView(updated as unknown as Record<string, unknown>);

  // Concede XP apenas se ainda não concedeu (idempotente por source+refId).
  const xpResult = await grantXpAmount(
    userId,
    "concluir-acao-crescimento",
    id,
    15
  );
  // Marca xpGranted apenas se concedeu de verdade agora (evita loop de chamadas).
  if (xpResult.granted && !alreadyCompleted) {
    await ge.action.update({
      where: { id },
      data: { xpGranted: true },
    });
    view.xpGranted = true;
  }

  return { action: view, xp: { granted: xpResult.granted, amount: xpResult.amount, alreadyGranted: xpResult.alreadyGranted } };
}

/** Expira ações pendentes com dueAt no passado (uso interno/jobs). */
export async function expireOverdueActions(userId: string): Promise<number> {
  const res = await ge.action.updateMany({
    where: {
      userId,
      status: "PENDING",
      dueAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return res.count;
}

/**
 * Sincroniza as recomendações atuais como ações (Parte 7): cria ações
 * PENDING para recomendações que ainda não viraram ação. Nunca duplica.
 */
export async function syncRecommendationsToActions(
  ctx: GrowthContext,
  recommendations: GrowthRecommendation[]
): Promise<GrowthActionView[]> {
  const created: GrowthActionView[] = [];
  for (const rec of recommendations) {
    const existing = await ge.action.findFirst({
      where: {
        userId: ctx.userId,
        sourceRecommendation: rec.slug,
        status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
      },
    });
    if (existing) continue;
    try {
      const action = await createAction(ctx.userId, {
        platform: rec.platform ?? "instagram",
        title: rec.oQue,
        description: `${rec.porQue} — Evidência: ${rec.evidencia}. Como: ${rec.como}.`,
        reason: rec.porQue,
        priority: rec.priorityLevel,
        sourceSignal: rec.signalType,
        sourceRecommendation: rec.slug,
        metricToWatch: rec.metrica,
      });
      created.push(action);
    } catch {
      // dedup por corrida — ignora
    }
  }
  return created;
}

// Re-exports para conveniência
export { notFoundError };
export type { GrowthEngineError };
