import type { KnowledgeModule, KnowledgeRule } from "../types";
import { coreModules } from "./core";
import { contentModules } from "./content";
import { metricsModules } from "./metrics";
import { strategyModules } from "./strategy";

/**
 * REGISTRO OFICIAL DE CONHECIMENTO — 30 MÓDULOS
 * ==============================================
 * Fonte: conhecimento oficial fornecido pela DONA (Fase 4.5).
 * Esta é a ÚNICA metodologia proprietária ativa do Inst Acessor.
 * Nada de conteúdo externo/genérico é adicionado aqui.
 */

export const KNOWLEDGE_MODULES: KnowledgeModule[] = [
  ...coreModules,
  ...contentModules,
  ...metricsModules,
  ...strategyModules,
].sort((a, b) => a.number - b.number);

/** Todas as regras, na ordem dos módulos. */
export const KNOWLEDGE_RULES: KnowledgeRule[] = KNOWLEDGE_MODULES.flatMap(
  (m) => m.rules
);

const MODULE_NUMBERS = new Set(KNOWLEDGE_MODULES.map((m) => m.number));
if (MODULE_NUMBERS.size !== 30) {
  throw new Error(
    `[knowledge] Esperado 30 módulos oficiais, encontrado ${MODULE_NUMBERS.size}`
  );
}

/** Busca um módulo pelo número (01–30). */
export function getKnowledgeModule(number: number): KnowledgeModule | undefined {
  return KNOWLEDGE_MODULES.find((m) => m.number === number);
}

/** Busca regras por categoria. */
export function getRulesByCategory(category: string): KnowledgeRule[] {
  const c = category.toLowerCase();
  return KNOWLEDGE_RULES.filter((r) => r.category.toLowerCase() === c);
}

/** Busca regras por tags (qualquer tag coincide). */
export function getRulesByTags(tags: string[]): KnowledgeRule[] {
  if (tags.length === 0) return [];
  const set = new Set(tags.map((t) => t.toLowerCase()));
  return KNOWLEDGE_RULES.filter((r) => r.tags.some((t) => set.has(t.toLowerCase())));
}

/** Busca uma regra pelo slug. */
export function getRuleBySlug(slug: string): KnowledgeRule | undefined {
  return KNOWLEDGE_RULES.find((r) => r.slug === slug);
}

/** Retorna os 30 títulos de módulo para documentação. */
export function knowledgeModuleTitles(): { number: number; title: string }[] {
  return KNOWLEDGE_MODULES.map((m) => ({ number: m.number, title: m.title }));
}
