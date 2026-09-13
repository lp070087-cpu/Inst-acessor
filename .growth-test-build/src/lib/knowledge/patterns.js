"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInsights = listInsights;
exports.createInsight = createInsight;
exports.deleteInsight = deleteInsight;
exports.discoverObservedPatterns = discoverObservedPatterns;
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
const repository_1 = require("./repository");
const baseline_1 = require("./baseline");
const registry_1 = require("./rules/registry");
const types_1 = require("./types");
const VALID_INSIGHT = types_1.INSIGHT_TYPES;
function isInsightType(v) {
    return VALID_INSIGHT.includes(v);
}
async function listInsights(userId, platform) {
    const rows = await repository_1.kb.insight.findMany({
        where: { userId, platform },
        orderBy: { createdAt: "desc" },
        take: 40,
    });
    return rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        type: isInsightType(r.type) ? r.type : "OBSERVED",
        summary: r.summary,
        detail: r.detail ?? null,
        ruleSlug: r.ruleSlug ?? null,
        experimentId: r.experimentId ?? null,
        confidence: r.confidence ?? null,
        createdAt: r.createdAt,
    }));
}
async function createInsight(userId, data) {
    if (!isInsightType(data.type))
        return null;
    const created = await repository_1.kb.insight.create({
        data: {
            userId,
            platform: data.platform,
            type: data.type,
            summary: data.summary,
            detail: data.detail ?? null,
            ruleSlug: data.ruleSlug ?? null,
            experimentId: data.experimentId ?? null,
            confidence: data.confidence ?? null,
        },
    });
    const row = created;
    return {
        id: row.id,
        platform: row.platform,
        type: row.type,
        summary: row.summary,
        detail: row.detail ?? null,
        ruleSlug: row.ruleSlug ?? null,
        experimentId: row.experimentId ?? null,
        confidence: row.confidence ?? null,
        createdAt: row.createdAt,
    };
}
async function deleteInsight(userId, id) {
    const existing = await repository_1.kb.insight.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return false;
    await repository_1.kb.insight.delete({ where: { id } });
    return true;
}
/**
 * Gera padrões OBSERVED determinísticos por plataforma (associação observada,
 * nunca causalidade). Não persiste automaticamente — retorna para a camada
 * superior decidir.
 */
async function discoverObservedPatterns(userId, platform) {
    const [baseline] = await Promise.all([(0, baseline_1.computeIndividualBaseline)(userId, platform)]);
    const out = [];
    const rule = (0, registry_1.getRuleBySlug)("unidade-conteudo");
    const ruleSlug = rule?.slug ?? "unidade-conteudo";
    if (baseline.snapshotCount < 2) {
        return out;
    }
    if (platform === "instagram") {
        const d = await (0, instagram_data_1.getDashboardInstagramData)(userId);
        // Alcance relativo ao baseline
        if (d.cards.reach.value != null && baseline.reach != null) {
            const ratio = d.cards.reach.value / baseline.reach;
            if (ratio >= 1.25) {
                out.push({
                    summary: "Alcance atual acima da mediana do perfil",
                    detail: `Alcance de ${d.cards.reach.value} vs. baseline de ${Math.round(baseline.reach)} (associação observada, não causal).`,
                    ruleSlug,
                    confidence: "MEDIA",
                });
            }
            else if (ratio <= 0.75) {
                out.push({
                    summary: "Alcance atual abaixo da mediana do perfil",
                    detail: `Alcance de ${d.cards.reach.value} vs. baseline de ${Math.round(baseline.reach)} (associação observada, não causal).`,
                    ruleSlug,
                    confidence: "MEDIA",
                });
            }
        }
        // Melhor dia de alcance → candidato a padrão
        if (d.timeline.bestReachDay) {
            out.push({
                summary: "Pico de alcance registrado",
                detail: `Melhor alcance em ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(d.timeline.bestReachDay.date))} (${d.timeline.bestReachDay.value}). Candidato a padrão a estudar.`,
                ruleSlug: "conteudo-excepcional-candidato-padrao",
                confidence: "BAIXA",
            });
        }
    }
    else {
        const d = await (0, tiktok_data_1.getTikTokDashboardData)(userId);
        if (d.cards.likes.value != null && baseline.engagement != null) {
            const ratio = d.cards.likes.value / baseline.engagement;
            if (ratio >= 1.25) {
                out.push({
                    summary: "Curtidas atuais acima da mediana do perfil",
                    detail: `Curtidas de ${d.cards.likes.value} vs. baseline de ${Math.round(baseline.engagement)} (associação observada, não causal).`,
                    ruleSlug,
                    confidence: "MEDIA",
                });
            }
            else if (ratio <= 0.75) {
                out.push({
                    summary: "Curtidas atuais abaixo da mediana do perfil",
                    detail: `Curtidas de ${d.cards.likes.value} vs. baseline de ${Math.round(baseline.engagement)} (associação observada, não causal).`,
                    ruleSlug,
                    confidence: "MEDIA",
                });
            }
        }
        if (d.timeline.biggestFollowerPeak) {
            out.push({
                summary: "Pico de seguidores registrado",
                detail: `Maior número de seguidores registrado: ${d.timeline.biggestFollowerPeak.value}.`,
                ruleSlug: "conteudo-excepcional-candidato-padrao",
                confidence: "BAIXA",
            });
        }
    }
    return out;
}
