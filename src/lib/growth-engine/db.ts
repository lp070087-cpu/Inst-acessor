import { prisma } from "@/lib/db";
import type { GrowthAction } from "@prisma/client";

/**
 * REPOSITORY — acesso tipado ao model da Fase 8 (GrowthAction).
 *
 * Mesma estratégia das fases anteriores (ai/kb/gp/pl/pub): o client gerado no
 * sandbox ainda não conhece os models 8, então usamos delegate via cast
 * controlado com os tipos do shim (`src/types/prisma-shim.d.ts`).
 *
 * A DONA DEVE rodar `npx prisma generate` localmente. Após isso, o client
 * real passa a ter o delegate nativamente e este módulo continua válido.
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

export const ge = {
  action: p.growthAction as Delegate<GrowthAction>,
};

export { prisma };
