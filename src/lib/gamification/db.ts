import { prisma } from "@/lib/db";
import type {
  UserLevel,
  XpLog,
  UserGoal,
  Achievement,
  UserAchievement,
} from "@prisma/client";

/**
 * REPOSITORY — acesso tipado aos models da Fase 5 (Rank/XP/Metas/Conquistas).
 *
 * Mesma estratégia da Fase 4 (`src/lib/ai/db.ts`) e Fase 4.5
 * (`src/lib/knowledge/repository.ts`): o client gerado no sandbox ainda não
 * conhece os models 5, então usamos delegates via cast controlado com os tipos
 * do shim (`src/types/prisma-shim.d.ts`).
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

export const gp = {
  level: p.userLevel as Delegate<UserLevel>,
  xpLog: p.xpLog as Delegate<XpLog>,
  goal: p.userGoal as Delegate<UserGoal>,
  achievement: p.achievement as Delegate<Achievement>,
  userAchievement: p.userAchievement as Delegate<UserAchievement>,
};

export { prisma };
