"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInternalAutomations = buildInternalAutomations;
exports.automationSafetyNotes = automationSafetyNotes;
function base(signal, output, title, description, linkedRecommendationSlug) {
    return {
        id: `${signal.type}::${signal.platform ?? "ambas"}`,
        rule: signal.type === "GOAL_AT_RISK"
            ? "GOAL_AT_RISK_ALERTA"
            : signal.type === "HIGH_PERFORMING_CONTENT"
                ? "HIGH_PERFORMING_REPLICAR"
                : "INCONSISTENT_PLANEJAR",
        sourceSignal: signal.type,
        title,
        description,
        platform: signal.platform,
        severity: signal.severity,
        output,
        linkedRecommendationSlug,
    };
}
/**
 * Deriva as automações internas ativas a partir dos sinais atuais.
 * Reutiliza os sinais já calculados (não roda o motor de novo).
 */
function buildInternalAutomations(signals, recommendations) {
    const out = [];
    const recBySignal = new Map();
    for (const rec of recommendations)
        recBySignal.set(rec.signalType, rec);
    for (const signal of signals) {
        if (signal.type === "GOAL_AT_RISK") {
            const rec = recBySignal.get("GOAL_AT_RISK");
            out.push(base(signal, "alerta", "Meta em risco", signal.evidence[0]?.detail ?? "Uma meta ativa está perto do prazo sem progresso suficiente.", rec?.slug ?? null));
        }
        else if (signal.type === "HIGH_PERFORMING_CONTENT") {
            const rec = recBySignal.get("HIGH_PERFORMING_CONTENT");
            out.push(base(signal, "recomendacao", "Conteúdo de alto desempenho", signal.evidence[0]?.detail ?? "Conteúdo com bom resultado detectado — replique.", rec?.slug ?? null));
        }
        else if (signal.type === "INCONSISTENT_POSTING") {
            const rec = recBySignal.get("INCONSISTENT_POSTING");
            out.push(base(signal, "acao", "Rotina de postagem irregular", signal.evidence[0]?.detail ?? "Postagens irregulares — planeje o calendário.", rec?.slug ?? null));
        }
    }
    return out;
}
/** Confirma que as ações geradas estão ligadas à automação interna, sem ação externa real. */
function automationSafetyNotes() {
    return [
        "Nenhuma DM real é enviada automaticamente.",
        "Nenhum conteúdo é publicado automaticamente.",
        "Nenhum comentário é respondido automaticamente.",
        "Todas as automações são internas (alertas, recomendações e ações no app).",
    ];
}
