"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecommendations = generateRecommendations;
exports.listRecommendations = listRecommendations;
exports.updateRecommendationStatus = updateRecommendationStatus;
const db_1 = require("@/lib/ai/db");
const diagnosis_1 = require("./diagnosis");
const registry_1 = require("@/lib/knowledge/rules/registry");
const PRIORITY_MAP = {
    "ponto-fraco": "ALTA",
    atencao: "MEDIA",
    oportunidade: "BAIXA",
};
// Regras oficiais por categoria (Fase 4.5 — conhecimento da DONA)
const RULE_BY_CATEGORY = {
    crescimento: "monitorar-crescimento",
    engajamento: "monitorar-engajamento",
    frequencia: "monitorar-frequencia",
    consistencia: "regra-consistencia-sustentavel",
    conteudo: "unidade-conteudo",
    alcance: "monitorar-alcance",
    perfil: "diagnostico-bio",
};
const ACTION_BY_CATEGORY = {
    crescimento: "Revise a estratégia de crescimento com base no histórico do perfil.",
    engajamento: "Incentive mais interações (perguntas, enquetes, CTAs).",
    frequencia: "Crie um calendário regular de publicações (frequência sustentável).",
    consistencia: "Mantenha uma frequência de sincronização para acompanhar a evolução.",
    conteudo: "Identifique os formatos com melhor desempenho e repita-os.",
    alcance: "Teste horários e formatos para ampliar o alcance.",
    perfil: "Revise bio e posicionamento para clareza da proposta.",
};
const TEST_BY_CATEGORY = {
    crescimento: "Compare o crescimento dos próximos 7/30 dias com o baseline individual.",
    engajamento: "Meça curtidas/comentários após aplicar o ajuste e compare com a mediana do perfil.",
    frequencia: "Acompanhe a evolução do alcance/engajamento após regularizar a frequência.",
    consistencia: "Observe se a regularidade melhora o desempenho ao longo de 2-4 semanas.",
    conteudo: "Publique variações e compare o resultado com a mediana por formato.",
    alcance: "Teste variações controladas e compare alcance/engajamento com o baseline.",
    perfil: "Avalie se visitas ao perfil convertem melhor após o ajuste de bio.",
};
async function generateRecommendations(userId, platform) {
    const diagnosis = await (0, diagnosis_1.runDiagnosis)(userId, platform);
    // Filtra apenas estados acionáveis
    const actionable = diagnosis.filter((d) => d.state !== "dados-insuficientes" && d.state !== "ponto-forte");
    const created = [];
    for (const item of actionable) {
        const duplicate = await findDuplicate(userId, item.category);
        if (duplicate)
            continue; // evita duplicidade
        const priority = PRIORITY_MAP[item.state] ?? "MEDIA";
        const ruleSlug = RULE_BY_CATEGORY[item.category] ?? "ciclo-principal";
        const rule = (0, registry_1.getRuleBySlug)(ruleSlug);
        const row = await db_1.ai.recommendation.create({
            data: {
                userId,
                category: item.category,
                priority,
                problem: item.label,
                explanation: item.detail,
                action: ACTION_BY_CATEGORY[item.category] ?? "Acompanhe este indicador.",
                evidence: item.detail, // o dado real que gerou o diagnóstico
                ruleSlug,
                test: TEST_BY_CATEGORY[item.category] ?? "Monitore o indicador ao longo do tempo.",
                status: "NOVA",
                source: `${platform}-diagnostico`,
            },
        });
        created.push({
            id: row.id,
            category: item.category,
            label: item.label,
            priority,
            problem: item.label,
            explanation: item.detail,
            action: ACTION_BY_CATEGORY[item.category] ?? "Acompanhe este indicador.",
            evidence: item.detail,
            ruleSlug,
            test: TEST_BY_CATEGORY[item.category] ?? "Monitore o indicador ao longo do tempo.",
            status: "NOVA",
            createdAt: row.createdAt,
        });
    }
    return created;
}
async function findDuplicate(userId, category) {
    const existing = await db_1.ai.recommendation.findFirst({
        where: { userId, category, status: { in: ["NOVA", "APLICADA", "CONCLUIDA"] } },
    });
    return existing ?? null;
}
/** Lista recomendações do usuário. */
async function listRecommendations(userId) {
    const rows = await db_1.ai.recommendation.findMany({
        where: { userId },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 60,
    });
    // Ordenação manual por prioridade (ALTA > MEDIA > BAIXA)
    const rank = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
    return rows.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
/** Atualiza status de uma recomendação (NOVA/APLICADA/IGNORADA/CONCLUIDA). */
async function updateRecommendationStatus(userId, id, status) {
    const existing = await db_1.ai.recommendation.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return null;
    return db_1.ai.recommendation.update({ where: { id }, data: { status } });
}
