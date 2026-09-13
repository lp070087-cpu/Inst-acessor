"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProactiveInsights = buildProactiveInsights;
exports.summarizeChanges = summarizeChanges;
function idFor(signal) {
    return `${signal.type}::${signal.platform ?? "ambas"}`;
}
function toInsight(signal) {
    const evidence = signal.evidence[0]?.detail ?? "";
    return {
        id: idFor(signal),
        kind: signal.confidence >= 0.9 ? "DADO_REAL" : signal.confidence >= 0.6 ? "INFERENCIA" : "DADO_INSUFICIENTE",
        title: signal.type.replace(/_/g, " ").toLowerCase(),
        detail: evidence,
        signalType: signal.type,
        platform: signal.platform,
        severity: signal.severity,
        confidence: signal.confidence,
        detectedAt: signal.detectedAt,
    };
}
/**
 * Converte sinais em insights proativos. Ordena por severidade.
 * Sem sinais → vazio (nenhum insight inventado).
 */
function buildProactiveInsights(signals) {
    const order = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
        INFO: 4,
    };
    return signals
        .map(toInsight)
        .sort((a, b) => order[a.severity] - order[b.severity]);
}
/** Resumo em texto curto do que mudou (para notificação futura). */
function summarizeChanges(ctx, signals) {
    const out = [];
    for (const signal of signals) {
        if (signal.severity === "INFO" || signal.severity === "LOW")
            continue;
        const platform = signal.platform === "tiktok" ? "TikTok" : signal.platform === "instagram" ? "Instagram" : "perfil";
        out.push(`[${platform}] ${signal.evidence[0]?.detail ?? signal.type}`);
    }
    return out.slice(0, 5);
}
