"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWLEDGE_RULES = exports.KNOWLEDGE_MODULES = void 0;
exports.getKnowledgeModule = getKnowledgeModule;
exports.getRulesByCategory = getRulesByCategory;
exports.getRulesByTags = getRulesByTags;
exports.getRuleBySlug = getRuleBySlug;
exports.knowledgeModuleTitles = knowledgeModuleTitles;
const core_1 = require("./core");
const content_1 = require("./content");
const metrics_1 = require("./metrics");
const strategy_1 = require("./strategy");
/**
 * REGISTRO OFICIAL DE CONHECIMENTO — 30 MÓDULOS
 * ==============================================
 * Fonte: conhecimento oficial fornecido pela DONA (Fase 4.5).
 * Esta é a ÚNICA metodologia proprietária ativa do Inst Acessor.
 * Nada de conteúdo externo/genérico é adicionado aqui.
 */
exports.KNOWLEDGE_MODULES = [
    ...core_1.coreModules,
    ...content_1.contentModules,
    ...metrics_1.metricsModules,
    ...strategy_1.strategyModules,
].sort((a, b) => a.number - b.number);
/** Todas as regras, na ordem dos módulos. */
exports.KNOWLEDGE_RULES = exports.KNOWLEDGE_MODULES.flatMap((m) => m.rules);
const MODULE_NUMBERS = new Set(exports.KNOWLEDGE_MODULES.map((m) => m.number));
if (MODULE_NUMBERS.size !== 30) {
    throw new Error(`[knowledge] Esperado 30 módulos oficiais, encontrado ${MODULE_NUMBERS.size}`);
}
/** Busca um módulo pelo número (01–30). */
function getKnowledgeModule(number) {
    return exports.KNOWLEDGE_MODULES.find((m) => m.number === number);
}
/** Busca regras por categoria. */
function getRulesByCategory(category) {
    const c = category.toLowerCase();
    return exports.KNOWLEDGE_RULES.filter((r) => r.category.toLowerCase() === c);
}
/** Busca regras por tags (qualquer tag coincide). */
function getRulesByTags(tags) {
    if (tags.length === 0)
        return [];
    const set = new Set(tags.map((t) => t.toLowerCase()));
    return exports.KNOWLEDGE_RULES.filter((r) => r.tags.some((t) => set.has(t.toLowerCase())));
}
/** Busca uma regra pelo slug. */
function getRuleBySlug(slug) {
    return exports.KNOWLEDGE_RULES.find((r) => r.slug === slug);
}
/** Retorna os 30 títulos de módulo para documentação. */
function knowledgeModuleTitles() {
    return exports.KNOWLEDGE_MODULES.map((m) => ({ number: m.number, title: m.title }));
}
