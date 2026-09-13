import { prisma } from "@/lib/db";
import type {
  PublishQueue,
  PublishLog,
  AutomationRule,
  AutomationEvent,
  AutomationExecution,
} from "@prisma/client";

/**
 * REPOSITORY — acesso tipado aos models da Fase 7 (Publicação/Automação).
 *
 * Mesma estratégia das fases anteriores (`src/lib/planning/db.ts` etc.):
 * o client gerado no sandbox ainda não conhece os models 7, então usamos
 * delegates via cast controlado com os tipos do shim.
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

export const pub = {
  queue: p.publishQueue as Delegate<PublishQueue>,
  log: p.publishLog as Delegate<PublishLog>,
  automationRule: p.automationRule as Delegate<AutomationRule>,
  automationEvent: p.automationEvent as Delegate<AutomationEvent>,
  automationExecution: p.automationExecution as Delegate<AutomationExecution>,
};

export { prisma };
