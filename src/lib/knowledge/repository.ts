import { prisma } from "@/lib/db";
import type {
  KnowledgeVersion,
  KnowledgeModule,
  KnowledgeRule,
  GrowthExperiment,
  ExperimentVariant,
  ExperimentObservation,
  ProfileInsight,
} from "@prisma/client";

/**
 * REPOSITORY — acesso tipado aos models do Cérebro Estratégico.
 *
 * Mesma estratégia da Fase 4 (`src/lib/ai/db.ts`): o client gerado no sandbox
 * ainda não conhece os models 4.5, então usamos delegates via cast controlado
 * com os tipos do shim (`src/types/prisma-shim.d.ts`).
 *
 * A DONA DEVE rodar `npx prisma generate` localmente. Após isso, o client
 * real passa a ter os delegates nativamente e este módulo continua válido.
 */

type AnyPrismaClient = typeof prisma & Record<string, unknown>;
const p = prisma as AnyPrismaClient;

interface Delegate<T> {
  create(args: unknown): Promise<T>;
  findMany(args?: unknown): Promise<T[]>;
  findFirst(args?: unknown): Promise<T | null>;
  findUnique(args: unknown): Promise<T | null>;
  update(args: unknown): Promise<T>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<T>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  upsert(args: unknown): Promise<T>;
}

export const kb = {
  version: p.knowledgeVersion as Delegate<KnowledgeVersion>,
  module: p.knowledgeModule as Delegate<KnowledgeModule>,
  rule: p.knowledgeRule as Delegate<KnowledgeRule>,
  experiment: p.growthExperiment as Delegate<GrowthExperiment>,
  variant: p.experimentVariant as Delegate<ExperimentVariant>,
  observation: p.experimentObservation as Delegate<ExperimentObservation>,
  insight: p.profileInsight as Delegate<ProfileInsight>,
};

export { prisma };
