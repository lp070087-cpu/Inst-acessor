/**
 * SEED OFICIAL — BASE DE CONHECIMENTO (Fase 4.5)
 * ===============================================
 * Insere SOMENTE o conhecimento oficial fornecido pela DONA (30 módulos).
 *
 * IDEMPOTENTE: usa `upsert` por `slug + version` — rodar duas vezes não
 * duplica conteúdo.
 *
 * ⚠️ NÃO executar automaticamente contra produção. Rodar manualmente:
 *   npx tsx prisma/seed-knowledge.ts
 *   (ou equivalente de execução de TS local).
 *
 * Conhecimento é GLOBAL (sem userId). Aprendizado individual fica por
 * userId nos models próprios (AIProfile, ProfileInsight, experimentos).
 */
import { PrismaClient } from "@prisma/client";
import type {
  KnowledgeVersion,
  KnowledgeModule,
  KnowledgeRule,
} from "@prisma/client";
import { KNOWLEDGE_MODULES, KNOWLEDGE_RULES } from "../src/lib/knowledge/rules/registry";

const prisma = new PrismaClient();

/**
 * Mesma estratégia do repository da Fase 4.5 (`src/lib/knowledge/repository.ts`):
 * o client gerado no sandbox ainda não conhece os models 4.5 (sem `prisma generate`),
 * então expomos delegates via cast controlado usando os tipos do shim.
 * Após a DONA rodar `npx prisma generate`, o client real passa a ter os
 * delegates nativamente e este seed continua válido.
 */
type AnyPrisma = PrismaClient & Record<string, unknown>;
const p = prisma as AnyPrisma;

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

const kb = {
  version: p.knowledgeVersion as Delegate<KnowledgeVersion>,
  module: p.knowledgeModule as Delegate<KnowledgeModule>,
  rule: p.knowledgeRule as Delegate<KnowledgeRule>,
};

async function main() {
  console.log(`[seed-knowledge] Iniciando com ${KNOWLEDGE_MODULES.length} módulos e ${KNOWLEDGE_RULES.length} regras...`);

  // 1) Versão ativa da base de conhecimento
  const versionRow = await kb.version.upsert({
    where: { version: 1 },
    update: { active: true, label: "v1 — conteúdo oficial da DONA (Fase 4.5)" },
    create: {
      version: 1,
      active: true,
      label: "v1 — conteúdo oficial da DONA (Fase 4.5)",
    },
  });

  // 2) Módulos (upsert por slug)
  const moduleRows = new Map<string, { id: string }>();
  for (const mod of KNOWLEDGE_MODULES) {
    const row = await kb.module.upsert({
      where: { slug: mod.slug },
      update: {
        number: mod.number,
        title: mod.title,
        description: mod.description,
        version: 1,
        active: true,
      },
      create: {
        number: mod.number,
        slug: mod.slug,
        title: mod.title,
        description: mod.description,
        version: 1,
        active: true,
      },
    });
    moduleRows.set(mod.slug, { id: row.id });
  }

  // 3) Regras (upsert por slug+version)
  for (const rule of KNOWLEDGE_RULES) {
    // busca o módulo dono da regra pelo número do módulo
    const ownerModule = KNOWLEDGE_MODULES.find((m) => m.number === rule.module);
    const ownerId = ownerModule ? moduleRows.get(ownerModule.slug)?.id : null;

    await kb.rule.upsert({
      where: { slug_version: { slug: rule.slug, version: rule.version } },
      update: {
        module: rule.module,
        title: rule.title,
        category: rule.category,
        content: rule.content,
        type: rule.type,
        priority: rule.priority,
        tags: rule.tags,
        moduleId: ownerId ?? undefined,
        active: true,
      },
      create: {
        slug: rule.slug,
        module: rule.module,
        title: rule.title,
        category: rule.category,
        content: rule.content,
        type: rule.type,
        priority: rule.priority,
        tags: rule.tags,
        version: rule.version,
        moduleId: ownerId ?? undefined,
        active: true,
        versionId: versionRow.id,
      },
    });
  }

  const count = await kb.rule.count();
  console.log(`[seed-knowledge] Concluído. Total de regras ativas: ${count}`);
}

main()
  .catch((e) => {
    console.error("[seed-knowledge] Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
