"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIConfiguredError = void 0;
exports.generateCopy = generateCopy;
exports.listCopies = listCopies;
exports.saveCopy = saveCopy;
exports.toggleCopyFavorite = toggleCopyFavorite;
exports.deleteCopy = deleteCopy;
const db_1 = require("@/lib/ai/db");
const ai_1 = require("@/lib/ai");
const context_1 = require("@/lib/ai/context");
const registry_1 = require("@/lib/knowledge/rules/registry");
/**
 * Serviço de geração de copy (IA).
 * Usa o provider ativo; sem provider → lança erro controlado.
 */
class AIConfiguredError extends Error {
    constructor() {
        super("IA_NAO_CONFIGURADA");
    }
}
exports.AIConfiguredError = AIConfiguredError;
const FORMAT_LABEL = {
    legenda: "legenda de post",
    reel: "legenda de Reel",
    story: "texto para Story",
    carrossel: "legenda de carrossel",
    tiktok: "roteiro/texto para TikTok",
    cta: "chamada para ação (CTA)",
    headline: "headline / manchete",
    bio: "biografia de perfil",
    anuncio: "anúncio",
};
const SIZE_GUIDE = {
    curto: "máximo 1-2 frases (se aplicável)",
    medio: "texto equilibrado, ~3-5 frases",
    longo: "texto completo e detalhado",
};
async function generateCopy(userId, params) {
    const provider = await (0, ai_1.getAIProvider)();
    if (!provider)
        throw new AIConfiguredError();
    const ctx = await (0, context_1.buildUserContext)(userId);
    const formatLabel = FORMAT_LABEL[params.format] ?? params.format;
    // Conhecimento oficial aplicável: regras de gancho, retenção e copy.
    const hookRules = (0, registry_1.getRulesByCategory)("conteudo").filter((r) => r.tags.includes("gancho") || r.tags.includes("copy") || r.tags.includes("retencao"));
    const copyRule = (0, registry_1.getRuleBySlug)("copy-usa-estrategia");
    const knowledgeLines = [copyRule ? `• ${copyRule.title}: ${copyRule.content}` : ""]
        .concat(hookRules.map((r) => `• ${r.title}: ${r.content}`))
        .filter(Boolean);
    const system = [
        "Você é a IA Acessor do Inst Acessor, especialista em criação de conteúdo para redes sociais.",
        "Use apenas o contexto real fornecido. Não invente métricas nem conhecimento proprietário.",
        "Aplique apenas as REGRAS OFICIAIS de copy abaixo — não adicione metodologia externa.",
        "Responda APENAS com o texto gerado (sem comentários, sem aspas, sem marcações de markdown).",
        "Linguagem natural em português, adequada ao tom solicitado.",
        "--- CONTEXTO REAL DO USUÁRIO ---",
        (0, context_1.contextToPrompt)(ctx),
        "",
        "--- REGRAS OFICIAIS DE COPY (não substituir por dicas genéricas) ---",
        ...knowledgeLines,
        "Importante: o gancho deve combinar com a entrega. Não transforme todo texto em clickbait.",
    ].join("\n");
    const userPrompt = [
        `Gere um(a) ${formatLabel} para ${params.platform}.`,
        params.objective ? `Objetivo: ${params.objective}.` : "",
        params.audience ? `Público-alvo: ${params.audience}.` : "",
        params.tone ? `Tom: ${params.tone}.` : "",
        params.context ? `Contexto adicional: ${params.context}.` : "",
        SIZE_GUIDE[params.size ?? "medio"] ?? "",
        "Se aplicável, inclua sugestão de hashtags relevantes ao final.",
    ]
        .filter(Boolean)
        .join("\n");
    return provider.complete({ system, messages: [{ role: "user", content: userPrompt }] });
}
/** Lista copies salvos do usuário. */
async function listCopies(userId) {
    const rows = await db_1.ai.copy.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return rows;
}
/** Salva um copy gerado. */
async function saveCopy(userId, data) {
    const created = await db_1.ai.copy.create({
        data: { userId, ...data },
    });
    return created;
}
/** Alterna favorito. */
async function toggleCopyFavorite(userId, id) {
    const existing = await db_1.ai.copy.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return null;
    return db_1.ai.copy.update({
        where: { id },
        data: { isFavorite: !existing.isFavorite },
    });
}
async function deleteCopy(userId, id) {
    const existing = await db_1.ai.copy.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return false;
    await db_1.ai.copy.delete({ where: { id } });
    return true;
}
