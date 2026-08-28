/**
 * SEED OFICIAL — CATÁLOGO DE CONQUISTAS (Fase 5)
 * ===============================================
 * Insere o catálogo GLOBAL de conquistas (badges) na tabela `Achievement`.
 * As definições são a fonte de verdade em `src/lib/gamification/achievements.ts`
 * (15 conquistas: uso, consistência, estratégia + 3 desafios ocultos).
 *
 * IDEMPOTENTE: usa `upsert` por `slug` — rodar duas vezes não duplica.
 *
 * ⚠️ NÃO executar automaticamente contra produção. Rodar manualmente:
 *   npx tsx prisma/seed-achievements.ts
 *   (ou equivalente de execução de TS local).
 *
 * NOTA: o sistema também se auto-cria as linhas via `ensureUserAchievements`
 * no primeiro acesso à página /rank (upsert idempotente). Este seed é a forma
 * de popular o catálogo global antecipadamente.
 */
import { PrismaClient } from "@prisma/client";
import type { Achievement } from "@prisma/client";
import { ACHIEVEMENT_CATALOG, toAchievementModel } from "../src/lib/gamification/achievements";

const prisma = new PrismaClient();

/**
 * Mesma estratégia do seed da Fase 4.5 (`prisma/seed-knowledge.ts`):
 * o client gerado no sandbox ainda não conhece os models 5 (sem `prisma generate`),
 * então expomos delegates via cast controlado usando os tipos do shim.
 * Após a DONA rodar `npx prisma generate`, o client real passa a ter os
 * delegates nativamente e este seed continua válido.
 */
type AnyPrisma = PrismaClient & Record<string, unknown>;
const p = prisma as AnyPrisma;

interface Delegate<T> {
  upsert(args: unknown): Promise<T>;
}

const achievement = p.achievement as unknown as Delegate<Achievement>;

async function main() {
  console.log(
    `[seed-achievements] Iniciando com ${ACHIEVEMENT_CATALOG.length} conquistas...`
  );

  let count = 0;
  for (const def of ACHIEVEMENT_CATALOG) {
    const data = toAchievementModel(def);
    await achievement.upsert({
      where: { slug: def.slug },
      update: data,
      create: data,
    });
    count += 1;
  }

  console.log(`[seed-achievements] OK — ${count} conquistas garantidas (idempotente).`);
  console.log(
    `[seed-achievements] Desafios ocultos: ${ACHIEVEMENT_CATALOG.filter((a) => a.hidden).length}`
  );
}

main()
  .catch((err) => {
    console.error("[seed-achievements] erro", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
