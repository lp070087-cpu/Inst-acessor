"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIConfiguredError = void 0;
exports.listConversations = listConversations;
exports.getConversation = getConversation;
exports.deleteConversation = deleteConversation;
exports.sendChatMessage = sendChatMessage;
const db_1 = require("@/lib/ai/db");
const ai_1 = require("@/lib/ai");
const context_builder_1 = require("@/lib/knowledge/context-builder");
const growth_engine_1 = require("@/lib/growth-engine");
/**
 * Serviço do chat IA Acessor.
 * - Persiste conversas/mensagens no Neon (via delegates tipados).
 * - Usa o provider ativo (OpenAI/Gemini) ou lança erro controlado.
 * - Monta contexto real do usuário (perfil + métricas disponíveis).
 */
class AIConfiguredError extends Error {
    constructor() {
        super("IA_NAO_CONFIGURADA");
    }
}
exports.AIConfiguredError = AIConfiguredError;
/** Lista conversas do usuário (mais recentes primeiro). */
async function listConversations(userId) {
    const rows = await db_1.ai.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
    });
    return rows;
}
/** Busca uma conversa com todas as mensagens. */
async function getConversation(userId, conversationId) {
    const conv = await db_1.ai.conversation.findUnique({ where: { id: conversationId } });
    if (!conv)
        return null;
    if (conv.userId !== userId)
        return null;
    const messages = await db_1.ai.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        // Limite de segurança: uma conversa nunca deve carregar centenas de mensagens.
        take: 100,
    });
    return { ...conv, messages };
}
/** Exclui uma conversa (e mensagens, por cascade). */
async function deleteConversation(userId, conversationId) {
    const conv = await db_1.ai.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.userId !== userId)
        return false;
    await db_1.ai.conversation.delete({ where: { id: conversationId } });
    return true;
}
/** Rótulo inicial da conversa, derivado da primeira mensagem do usuário. */
function makeTitle(message) {
    const clean = message.trim().replace(/\s+/g, " ");
    return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
}
/**
 * Envia uma mensagem: cria (se preciso) a conversa, persiste a mensagem do
 * usuário, chama o provider com o contexto, persiste a resposta.
 */
async function sendChatMessage(userId, opts) {
    const provider = await (0, ai_1.getAIProvider)();
    if (!provider)
        throw new AIConfiguredError();
    // 1) Conversa (existente ou nova)
    let conversationId = opts.conversationId;
    if (conversationId) {
        const existing = await db_1.ai.conversation.findUnique({ where: { id: conversationId } });
        if (!existing || existing.userId !== userId) {
            conversationId = undefined;
        }
    }
    if (!conversationId) {
        const created = await db_1.ai.conversation.create({
            data: { userId, title: makeTitle(opts.message) },
        });
        conversationId = created.id;
    }
    // 2) Persiste a mensagem do usuário
    await db_1.ai.message.create({
        data: {
            conversationId,
            userId,
            role: "user",
            content: opts.message,
        },
    });
    // 3) Contexto real do usuário + conhecimento oficial relevante
    const [kctx, gctx] = await Promise.all([
        (0, context_builder_1.buildKnowledgeContext)(userId, {
            query: opts.message,
        }),
        (0, growth_engine_1.buildGrowthContext)(userId),
    ]);
    const system = [
        "Você é a IA Acessor, assistente do Inst Acessor para creators e pequenos negócios no Instagram e TikTok.",
        "Use apenas os dados fornecidos no contexto e o CONHECIMENTO OFICIAL indicado. Se um dado não estiver listado, ele está indisponível — NÃO invente métricas, seguidores, alcance ou conhecimento proprietário.",
        "NUNCA invente métricas. Separe explicitamente: DADO REAL, CONHECIMENTO, INFERÊNCIA, HIPÓTESE e RECOMENDAÇÃO.",
        "Quando os dados operacionais do usuário estiverem ausentes (SEM_REDE, SEM_SYNC ou POUCOS_DADOS), diga claramente 'DADO INSUFICIENTE' e recomende conectar/sincronizar antes de sugerir números.",
        "Responda de forma prática, em português, direta e acionável.",
        (0, context_builder_1.knowledgeContextToPrompt)(kctx),
        (0, growth_engine_1.growthContextToPrompt)(gctx),
    ].join("\n");
    // 4) Histórico recente (para continuidade)
    const history = await db_1.ai.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 20,
    });
    const messages = history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user"),
        content: m.content,
    }));
    // 5) Chama o provider
    let assistantReply;
    try {
        assistantReply = await provider.complete({ system, messages });
    }
    catch (err) {
        // Se o provider falhar, ainda assim registra a mensagem do usuário e relança.
        console.error("[ai/chat] falha no provider", err);
        throw err;
    }
    // 6) Persiste a resposta
    await db_1.ai.message.create({
        data: { conversationId, userId, role: "assistant", content: assistantReply },
    });
    // 7) Atualiza `updatedAt` da conversa
    await db_1.ai.conversation.update({
        where: { id: conversationId },
        data: {},
    });
    const full = await getConversation(userId, conversationId);
    if (!full)
        throw new Error("Conversa não encontrada após atualização");
    return { conversation: full, assistantReply };
}
