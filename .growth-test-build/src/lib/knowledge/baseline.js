"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIndividualBaseline = computeIndividualBaseline;
exports.classifyAgainstBaseline = classifyAgainstBaseline;
exports.median = median;
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
/**
 * BASELINE INDIVIDUAL (MÓDULO 16 — "baseline")
 * =============================================
 * Toda análise deve priorizar comparação com o PRÓPRIO perfil. Um Reel com
 * 10 mil views pode ser excelente para um perfil e fraco para outro.
 *
 * Baselines possíveis (por histórico): mediana do perfil, média móvel,
 * período anterior, top quartile, média por formato.
 *
 * NUNCA comparar cegamente com números universais. Nada de causalidade
 * sem experimento.
 */
function median(values) {
    const nums = values
        .filter((v) => typeof v === "number" && Number.isFinite(v))
        .sort((a, b) => a - b);
    if (nums.length === 0)
        return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}
async function computeIndividualBaseline(userId, platform) {
    const signal = await collectSignals(userId, platform);
    return {
        platform,
        followers: signal.followers,
        engagement: signal.engagement,
        reach: signal.reach,
        mediaCount: signal.mediaCount,
        snapshotCount: signal.snapshotCount,
        byFormat: [],
    };
}
async function collectSignals(userId, platform) {
    if (platform === "instagram") {
        const d = await (0, instagram_data_1.getDashboardInstagramData)(userId);
        return {
            followers: d.followersCount ?? null,
            engagement: d.cards.engagement.value ?? null,
            reach: d.cards.reach.value ?? null,
            mediaCount: d.mediaCount ?? null,
            snapshotCount: d.snapshotCount,
        };
    }
    const d = await (0, tiktok_data_1.getTikTokDashboardData)(userId);
    return {
        followers: d.followersCount ?? null,
        engagement: d.cards.likes.value ?? null,
        reach: null,
        mediaCount: d.videoCount ?? null,
        snapshotCount: d.snapshotCount,
    };
}
/**
 * Classifica um valor em relação à mediana do perfil:
 *  - "acima-da-mediana" quando >= mediana * 1.25
 *  - "abaixo-da-mediana" quando <= mediana * 0.75
 *  - "na-media" caso contrário
 * Sem mediana → null (dados insuficientes, NUNCA inventar).
 */
function classifyAgainstBaseline(baseline, value) {
    if (baseline == null || value == null || baseline === 0)
        return null;
    if (value >= baseline * 1.25)
        return "acima-da-mediana";
    if (value <= baseline * 0.75)
        return "abaixo-da-mediana";
    return "na-media";
}
