import { prisma } from "@/lib/db";
import type { Plan, Subscription, Payment } from "@prisma/client";

/**
 * REPOSITORY — acesso tipado aos models da Fase 6.5 (Planos/Assinatura).
 *
 * Mesma estratégia das Fases 4/4.5/5/6 (`src/lib/ai/db.ts`,
 * `src/lib/gamification/db.ts`, `src/lib/planning/db.ts`):
 * o client gerado no sandbox ainda não conhece os models 6.5, então usamos
 * delegates via cast controlado com os tipos do shim
 * (`src/types/prisma-shim.d.ts`).
 *
 * A DONA DEVE rodar `npx prisma generate` localmente. Após isso, o client real
 * passa a ter os delegates nativamente e este módulo continua válido.
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

export const bll = {
  plan: p.plan as Delegate<Plan>,
  subscription: p.subscription as Delegate<Subscription>,
  payment: p.payment as Delegate<Payment>,
};

export { prisma };
