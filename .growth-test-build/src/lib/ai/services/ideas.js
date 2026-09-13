"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIConfiguredError = void 0;
exports.generateIdeas = generateIdeas;
exports.listIdeas = listIdeas;
exports.saveIdea = saveIdea;
exports.updateIdeaStatus = updateIdeaStatus;
exports.deleteIdea = deleteIdea;
const db_1 = require("@/lib/ai/db");
const ai_1 = require("@/lib/ai");
const context_1 = require("@/lib/ai/context");
const registry_1 = require("@/lib/knowledge/rules/registry");
/**
 * Serviço da Central de Ideias.
 * Gera ideias via IA (provider ativo) — sem inventar tendências externas.
 */
class AIConfiguredError extends Error {
    constructor() {
        super("IA_NAO_CONFIGURADA");
    }
}
exports.AIConfiguredError = AIConfiguredError;
const CATEGORY_LABEL = {
    reels: "Reels (Instagram)",
    stories: "Stories (Instagram)",
    carrossel: "Carrossel (Instagram)",
    tiktok: "TikTok",
    educativo: "conteúdo educativo",
    autoridade: "conteúdo de autoridade",
    venda: "conteúdo de venda",
    engajamento: "conteúdo de engajamento",
};
async function generateIdeas(userId, params) {
    const provider = await (0, ai_1.getAIProvider)();
    if (!provider)
        throw new AIConfiguredError();
    const ctx = await (0, context_1.buildUserContext)(userId);
    const categoryLabel = CATEGORY_LABEL[params.category] ?? params.category;
    // Regra oficial: ideias precisam de contexto (nicho + público + conteúdo anterior + desempenho + objetivo)
    const ideaRule = (0, registry_1.getRuleBySlug)("ideias-precisam-contexto");
    const system = [
        "Você é a IA Acessor do Inst Acessor, especialista em planejamento de conteúdo para redes sociais.",
        "Use apenas o contexto real fornecido. Não invente tendências externas, métricas ou conhecimento proprietário.",
        "Aplique a regra oficial: ideias devem considerar NICHO + PÚBLICO + CONTEÚDO ANTERIOR + DESEMPENHO + OBJETIVO.",
        "Responda SEMPRE em JSON, sem comentários, sem markdown, exatamente neste formato:",
        '[{"title":"...","format":"...","objective":"...","context":"...","rationale":"..."}]',
        "Cada ideia deve ter: title (curto e claro), format (ex.: Reel, Story, Carrossel), objective (qual objetivo serve), context (ideia de abordagem) e rationale (POR QUE esta ideia foi sugerida, com base no contexto).",
        ideaRule ? `Regra oficial aplicada: ${ideaRule.content}` : "",
        "--- CONTEXTO REAL DO USUÁRIO ---",
        (0, context_1.contextToPrompt)(ctx),
    ].join("\n");
    const userPrompt = `Gere ${params.count} ideias de conteúdo para a categoria "${categoryLabel}".`;
    const raw = await provider.complete({
        system,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.9,
        maxTokens: 1500,
    });
    const ideas = parseIdeaJson(raw);
    return ideas.slice(0, params.count);
}
function parseIdeaJson(raw) {
    try {
        const cleaned = raw
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();
        const arr = JSON.parse(cleaned);
        if (!Array.isArray(arr))
            return [];
        const out = [];
        for (const item of arr) {
            if (typeof item !== "object" || item === null)
                continue;
            const o = item;
            const title = String(o.title ?? "").trim();
            if (!title)
                continue;
            out.push({
                title,
                format: o.format != null ? String(o.format).trim() : undefined,
                objective: o.objective != null ? String(o.objective).trim() : undefined,
                context: o.context != null ? String(o.context).trim() : undefined,
                rationale: o.rationale != null ? String(o.rationale).trim() : undefined,
            });
        }
        return out;
    }
    catch {
        return [];
    }
}
/** Lista ideias do usuário. */
async function listIdeas(userId) {
    const rows = await db_1.ai.idea.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
    return rows;
}
async function saveIdea(userId, data) {
    return db_1.ai.idea.create({ data: { userId, ...data } });
}
/** Atualiza status (NOVA/FAVORITA/DESCARTADA/PRODUZIDA). */
async function updateIdeaStatus(userId, id, status) {
    const existing = await db_1.ai.idea.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return null;
    return db_1.ai.idea.update({ where: { id }, data: { status } });
}
async function deleteIdea(userId, id) {
    const existing = await db_1.ai.idea.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return false;
    await db_1.ai.idea.delete({ where: { id } });
    return true;
}
