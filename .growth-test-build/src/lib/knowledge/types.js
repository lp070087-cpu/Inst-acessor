"use strict";
/**
 * CÉREBRO ESTRATÉGICO — INST ACESSOR (FASE 4.5)
 * ===============================================
 * Tipos centrais do Knowledge Engine.
 *
 * A fonte oficial de conhecimento é a DONA do projeto (30 módulos registrados
 * em `src/lib/knowledge/rules/`). Nada de metodologia externa ou genérica.
 *
 * Categorias de confiabilidade (nunca misturar):
 *  - DADO REAL      → informação da API/snapshot/banco.
 *  - CONHECIMENTO   → regra/metodologia oficial fornecida pela DONA.
 *  - INFERÊNCIA     → interpretação derivada dos dados.
 *  - HIPÓTESE       → explicação possível que precisa de teste.
 *  - RECOMENDAÇÃO   → próxima ação sugerida.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROWTH_SCORE_V1 = exports.ALERT_SEVERITIES = exports.INSIGHT_TYPES = exports.EXPERIMENT_STATUSES = void 0;
exports.EXPERIMENT_STATUSES = [
    "DRAFT",
    "RUNNING",
    "ENOUGH_DATA",
    "CONFIRMED",
    "REJECTED",
    "INCONCLUSIVE",
    "ARCHIVED",
];
exports.INSIGHT_TYPES = [
    "OBSERVED",
    "INFERRED",
    "CONFIRMED_BY_EXPERIMENT",
];
exports.ALERT_SEVERITIES = ["ALTA", "MEDIA", "BAIXA"];
exports.GROWTH_SCORE_V1 = {
    version: "growth-score-v1",
    engagement: 30,
    growth: 25,
    reach: 25,
    consistency: 20,
};
