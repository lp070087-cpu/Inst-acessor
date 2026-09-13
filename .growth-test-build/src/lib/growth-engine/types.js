"use strict";
/**
 * TIPOS CENTRAIS DO GROWTH ENGINE — Fase 8
 * =========================================
 * Motor Operacional de Crescimento. Interpreta dados REAIS já persistidos
 * (dashboard, baseline, score, metas, experimentos, conteúdo) e produz:
 *   sinais → prioridades → recomendações → ações → acompanhamento.
 *
 * REGRA ABSOLUTA (ESCOPO-OFICIAL): nunca inventar dados. Quando um dado não
 * existe ou está desatualizado, o sinal/prioridade/recomendação declara
 * `DADO INSUFICIENTE` e a confiança reduz — jamais preenche com estimativa.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrowthEngineError = exports.GROWTH_ACTION_STATUSES = exports.SIGNAL_SEVERITY_ORDER = exports.DATA_STATUS_LABELS = void 0;
exports.DATA_STATUS_LABELS = {
    SEM_REDE: "Nenhuma rede conectada",
    SEM_SYNC: "Conectada, aguardando primeira sincronização",
    POUCOS_DADOS: "Poucos dados ainda",
    DADOS_SUFICIENTES: "Dados suficientes",
};
exports.SIGNAL_SEVERITY_ORDER = [
    "INFO",
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
];
// ------------------------------------------------------------
// AÇÕES (Parte 7) — persistidas em GrowthAction
// ------------------------------------------------------------
exports.GROWTH_ACTION_STATUSES = [
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
    "DISMISSED",
    "EXPIRED",
];
// ------------------------------------------------------------
// ERROS
// ------------------------------------------------------------
class GrowthEngineError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
exports.GrowthEngineError = GrowthEngineError;
