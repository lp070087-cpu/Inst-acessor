import { kb } from "./repository";
import type { ExperimentStatus } from "./types";
import { EXPERIMENT_STATUSES } from "./types";

/**
 * MOTOR DE EXPERIMENTAÇÃO (Fase 4.5)
 * ===================================
 * Fluxo oficial: RESULTADO → IDENTIFICAR ELEMENTOS → CRIAR HIPÓTESE →
 * PROPOR VARIAÇÃO → EXECUTAR → MEDIR → COMPARAR → CONFIRMAR/REJEITAR → APRENDER.
 *
 * NUNCA implementar testes estatísticos avançados fictícios. Sem amostra
 * suficiente → INCONCLUSIVE.
 *
 * Segurança: todos os modelos são por userId (owner-check em cada operação).
 */

export interface ExperimentVariantData {
  contentId?: string;
  variation?: string;
  hookType?: string;
  format?: string;
  theme?: string;
  structure?: string;
}

export interface ExperimentObservationData {
  metric: string;
  before?: number;
  after?: number;
  delta?: number;
  conclusion?: string;
  confidence?: "BAIXA" | "MEDIA" | "ALTA";
}

export interface ExperimentDto {
  id: string;
  platform: string;
  hypothesis: string;
  variable: string;
  baseline?: string | null;
  status: ExperimentStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  variants: ExperimentVariantData[];
  observations: ExperimentObservationData[];
}

const VALID_STATUS: ExperimentStatus[] = EXPERIMENT_STATUSES;

function isStatus(v: string): v is ExperimentStatus {
  return (VALID_STATUS as string[]).includes(v);
}

export async function createExperiment(
  userId: string,
  data: { platform: string; hypothesis: string; variable: string; baseline?: string }
): Promise<ExperimentDto | null> {
  const created = await kb.experiment.create({
    data: {
      userId,
      platform: data.platform,
      hypothesis: data.hypothesis,
      variable: data.variable,
      baseline: data.baseline ?? null,
      status: "DRAFT",
    },
  });
  return toDto(created as unknown as ExperimentDto);
}

export async function listExperiments(userId: string): Promise<ExperimentDto[]> {
  const rows = await kb.experiment.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const out: ExperimentDto[] = [];
  for (const row of rows) {
    const dto = await enrich(row as unknown as ExperimentDto);
    if (dto) out.push(dto);
  }
  return out;
}

export async function getExperiment(userId: string, id: string): Promise<ExperimentDto | null> {
  const row = await kb.experiment.findUnique({ where: { id } });
  if (!row) return null;
  if ((row as { userId: string }).userId !== userId) return null;
  return enrich(row as unknown as ExperimentDto);
}

export async function updateExperimentStatus(
  userId: string,
  id: string,
  status: string
): Promise<ExperimentDto | null> {
  if (!isStatus(status)) return null;
  const existing = await kb.experiment.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return null;

  const now = new Date();
  const data: Record<string, unknown> = { status };
  if (status === "RUNNING" && !(existing as { startedAt?: Date | null }).startedAt) {
    data.startedAt = now;
  }
  if (["CONFIRMED", "REJECTED", "INCONCLUSIVE", "ARCHIVED"].includes(status)) {
    data.endedAt = now;
  }

  const updated = await kb.experiment.update({ where: { id }, data });
  return enrich(updated as unknown as ExperimentDto);
}

export async function addVariant(
  userId: string,
  experimentId: string,
  data: ExperimentVariantData
): Promise<ExperimentVariantData | null> {
  const exp = await kb.experiment.findUnique({ where: { id: experimentId } });
  if (!exp || (exp as { userId: string }).userId !== userId) return null;

  const created = await kb.variant.create({
    data: { experimentId, ...data },
  });
  return toVariant(created as unknown as ExperimentVariantData);
}

export async function addObservation(
  userId: string,
  experimentId: string,
  data: ExperimentObservationData
): Promise<ExperimentObservationData | null> {
  const exp = await kb.experiment.findUnique({ where: { id: experimentId } });
  if (!exp || (exp as { userId: string }).userId !== userId) return null;

  const created = await kb.observation.create({
    data: {
      experimentId,
      metric: data.metric,
      before: data.before ?? null,
      after: data.after ?? null,
      delta: data.delta ?? (data.before != null && data.after != null ? data.after - data.before : null),
      conclusion: data.conclusion ?? null,
      confidence: data.confidence ?? null,
    },
  });
  return toObservation(created as unknown as ExperimentObservationData);
}

export async function deleteExperiment(userId: string, id: string): Promise<boolean> {
  const existing = await kb.experiment.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return false;
  await kb.experiment.delete({ where: { id } });
  return true;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

async function enrich(row: ExperimentDto): Promise<ExperimentDto | null> {
  const [variants, observations] = await Promise.all([
    kb.variant.findMany({ where: { experimentId: row.id } }),
    kb.observation.findMany({ where: { experimentId: row.id } }),
  ]);
  return {
    ...row,
    variants: (variants as unknown as ExperimentVariantData[]).map(toVariant),
    observations: (observations as unknown as ExperimentObservationData[]).map(toObservation),
  };
}

function toVariant(v: ExperimentVariantData): ExperimentVariantData {
  return {
    contentId: v.contentId ?? undefined,
    variation: v.variation ?? undefined,
    hookType: v.hookType ?? undefined,
    format: v.format ?? undefined,
    theme: v.theme ?? undefined,
    structure: v.structure ?? undefined,
  };
}

function toObservation(o: ExperimentObservationData): ExperimentObservationData {
  return {
    metric: o.metric,
    before: o.before ?? undefined,
    after: o.after ?? undefined,
    delta: o.delta ?? undefined,
    conclusion: o.conclusion ?? undefined,
    confidence: o.confidence ?? undefined,
  };
}

function toDto(row: ExperimentDto): ExperimentDto {
  return {
    id: row.id,
    platform: row.platform,
    hypothesis: row.hypothesis,
    variable: row.variable,
    baseline: row.baseline ?? null,
    status: isStatus(row.status) ? row.status : "DRAFT",
    startedAt: row.startedAt ?? null,
    endedAt: row.endedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    variants: [],
    observations: [],
  };
}
