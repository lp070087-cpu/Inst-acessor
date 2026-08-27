/**
 * CÉREBRO ESTRATÉGICO — Barrel da base de conhecimento.
 * Exporta tipos, registro oficial (30 módulos) e utilitários de consulta.
 */

export * from "./types";

// Registro oficial (fonte única de conhecimento)
export {
  KNOWLEDGE_MODULES,
  KNOWLEDGE_RULES,
  getKnowledgeModule,
  getRulesByCategory,
  getRulesByTags,
  getRuleBySlug,
  knowledgeModuleTitles,
} from "./rules/registry";

// Baselines / utilitários que não dependem de banco
export * from "./baseline";
