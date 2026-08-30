import { prisma } from "@/lib/db";
import type { SystemSetting } from "@prisma/client";

/**
 * REPOSITORY — acesso tipado ao model SystemSetting (Fase 10).
 *
 * Mesma estratégia das fases anteriores (src/lib/ai/db.ts,
 * src/lib/planning/db.ts): o client gerado no sandbox ainda não conhece o
 * model, então usamos um delegate via cast controlado com o tipo do shim
 * (src/types/prisma-shim.d.ts).
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

export const settings = {
  systemSetting: p.systemSetting as Delegate<SystemSetting>,
};

export { prisma };
