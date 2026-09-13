"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeScore = computeScore;
exports.persistScore = persistScore;
exports.getScoreHistory = getScoreHistory;
exports.getLatestScore = getLatestScore;
const db_1 = require("@/lib/ai/db");
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
const knowledge_1 = require("@/lib/knowledge");
// ------------------------------------------------------------
// Leitura de sinais reais
// ------------------------------------------------------------
async function signalsForPlatform(userId, platform) {
    if (platform === "instagram") {
        const d = await (0, instagram_data_1.getDashboardInstagramData)(userId);
        return {
            followers: d.followersCount ?? null,
            engagement: d.cards.engagement.value ?? null,
            reach: d.cards.reach.value ?? null,
            media: d.mediaCount ?? null,
            snapshotCount: d.snapshotCount,
            hasTwoPoints: d.snapshotCount >= 2,
            periodGrowthPct: d.comparison.monthlyGrowth ?? null,
        };
    }
    const d = await (0, tiktok_data_1.getTikTokDashboardData)(userId);
    return {
        followers: d.followersCount ?? null,
        engagement: d.cards.likes.value ?? null,
        reach: null,
        media: d.videoCount ?? null,
        snapshotCount: d.snapshotCount,
        hasTwoPoints: d.snapshotCount >= 2,
        periodGrowthPct: d.comparison.monthlyGrowth ?? null,
    };
}
// ------------------------------------------------------------
// Heurísticas determinísticas (explicáveis, sem inventar dados)
// ------------------------------------------------------------
function clamp01(v) {
    return Math.min(1, Math.max(0, v));
}
/** Normaliza crescimento mensal % em 0..1 (teto +100% considerado excelente). */
function growthScore(pct) {
    if (pct == null)
        return null;
    return Math.round(clamp01(pct / 100) * 100);
}
/** Normaliza engajamento bruto em 0..1 (teto 10% do followers como referência relativa). */
function engagementScore(followers, engagement) {
    if (followers == null || followers === 0 || engagement == null)
        return null;
    const rate = engagement / followers;
    return Math.round(clamp01(rate / 0.1) * 100); // 10% = nota 100
}
/** Alcance relativo à base de seguidores. */
function reachScore(followers, reach) {
    if (followers == null || followers === 0 || reach == null)
        return null;
    const rate = reach / followers;
    return Math.round(clamp01(rate / 2) * 100); // 2x base = nota 100
}
/** Consistência: frequência de sincronização + volume de dados. */
function consistencyScore(signal) {
    if (signal.snapshotCount < 2)
        return null;
    return Math.min(50 + signal.snapshotCount * 5, 100);
}
/** Frequência: publicações quando disponíveis (complementar, não pesa). */
function frequencyScore(signal) {
    if (signal.media == null || signal.media === 0)
        return null;
    return Math.round(clamp01(signal.media / 30) * 100);
}
/** Desempenho de conteúdo (complementar, não pesa). */
function contentScore(signal) {
    if (!signal.hasTwoPoints)
        return null;
    const current = signal.engagement ?? signal.reach;
    if (current == null)
        return null;
    return Math.round(clamp01(current / 1000) * 100);
}
// ------------------------------------------------------------
// Cálculo principal — growth-score-v1
// ------------------------------------------------------------
async function computeScore(userId, platform) {
    const signal = await signalsForPlatform(userId, platform);
    const W = knowledge_1.GROWTH_SCORE_V1;
    const pillars = [
        {
            key: "engagement",
            label: "Engajamento",
            value: engagementScore(signal.followers, signal.engagement),
            available: signal.engagement != null,
            weight: W.engagement,
            complementary: false,
        },
        {
            key: "growth",
            label: "Crescimento",
            value: growthScore(signal.periodGrowthPct),
            available: signal.periodGrowthPct != null,
            weight: W.growth,
            complementary: false,
        },
        {
            key: "reach",
            label: "Alcance",
            value: reachScore(signal.followers, signal.reach),
            available: signal.reach != null,
            weight: W.reach,
            complementary: false,
        },
        {
            key: "consistency",
            label: "Consistência",
            value: consistencyScore(signal),
            available: signal.snapshotCount >= 2,
            weight: W.consistency,
            complementary: false,
        },
        // Complementares (não pesam no overall; ainda informam quando disponíveis)
        {
            key: "frequency",
            label: "Frequência",
            value: frequencyScore(signal),
            available: signal.media != null,
            weight: 0,
            complementary: true,
        },
        {
            key: "content",
            label: "Desempenho",
            value: contentScore(signal),
            available: signal.hasTwoPoints,
            weight: 0,
            complementary: true,
        },
    ];
    // Pilares oficiais disponíveis (não complementares)
    const weighted = pillars.filter((p) => !p.complementary);
    const available = weighted.filter((p) => p.available);
    // Cobertura: soma dos pesos dos pilares oficiais disponíveis / 100
    const totalWeight = weighted.reduce((acc, p) => acc + p.weight, 0); // deve ser 100
    const coveredWeight = available.reduce((acc, p) => acc + p.weight, 0);
    const coverage = available.length > 0 ? Math.round((coveredWeight / totalWeight) * 100) : null;
    // Overall = média ponderada dos pilares disponíveis (redistribuição de peso)
    let overall = null;
    if (available.length > 0) {
        const sum = available.reduce((acc, p) => acc + (p.value ?? 0) * p.weight, 0);
        overall = Math.round(sum / coveredWeight);
    }
    const factors = {
        positive: [],
        attention: [],
        unavailable: [],
    };
    for (const p of pillars) {
        if (!p.available) {
            factors.unavailable.push(p.key === "growth"
                ? "Crescimento: dados insuficientes para calcular"
                : p.key === "engagement"
                    ? "Engajamento: sem dados de engajamento"
                    : p.key === "reach"
                        ? "Alcance: sem dados de alcance"
                        : p.key === "consistency"
                            ? "Consistência: precisa de mais sincronizações"
                            : p.key === "frequency"
                                ? "Frequência: sem dados de publicações"
                                : "Desempenho: precisa de histórico");
            continue;
        }
        const v = p.value ?? 0;
        if (v >= 70)
            factors.positive.push(`${p.label} (${v})`);
        else if (v <= 35)
            factors.attention.push(`${p.label} (${v})`);
    }
    return {
        platform,
        overall,
        pillars,
        factors,
        version: W.version,
        source: `${platform}-snapshots`,
        coverage,
        weighting: {
            engagement: W.engagement,
            growth: W.growth,
            reach: W.reach,
            consistency: W.consistency,
        },
    };
}
// ------------------------------------------------------------
// Persistência (ProfileScore + Snapshot)
// ------------------------------------------------------------
async function persistScore(userId, result) {
    if (result.overall == null)
        return null;
    const score = await db_1.ai.score.create({
        data: {
            userId,
            platform: result.platform,
            overall: result.overall,
            growth: result.pillars.find((p) => p.key === "growth")?.value ?? null,
            engagement: result.pillars.find((p) => p.key === "engagement")?.value ?? null,
            reach: result.pillars.find((p) => p.key === "reach")?.value ?? null,
            consistency: result.pillars.find((p) => p.key === "consistency")?.value ?? null,
            frequency: result.pillars.find((p) => p.key === "frequency")?.value ?? null,
            content: result.pillars.find((p) => p.key === "content")?.value ?? null,
            factors: JSON.parse(JSON.stringify(result.factors)),
            version: result.version,
            coverage: result.coverage,
            weighting: JSON.parse(JSON.stringify(result.weighting)),
        },
    });
    const scoreRow = score;
    await db_1.ai.scoreSnapshot.create({
        data: {
            userId,
            platform: result.platform,
            scoreId: scoreRow.id,
            overall: scoreRow.overall,
        },
    });
    return score;
}
async function getScoreHistory(userId, platform) {
    const rows = await db_1.ai.score.findMany({
        where: { userId, platform },
        orderBy: { createdAt: "desc" },
        take: 30,
    });
    return rows;
}
async function getLatestScore(userId, platform) {
    const row = await db_1.ai.score.findFirst({
        where: { userId, platform },
        orderBy: { createdAt: "desc" },
    });
    return row;
}
