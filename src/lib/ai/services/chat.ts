import { ai } from "@/lib/ai/db";
import type { AIConversationWithMessages } from "@/lib/ai/db";
import { getAIProvider, AIConfiguredError } from "@/lib/ai";
import { buildKnowledgeContext, knowledgeContextToPrompt } from "@/lib/knowledge/context-builder";
import { buildGrowthContext, growthContextToPrompt } from "@/lib/growth-engine";

/**
 * Serviço do chat IA Acessor.
 * - Persiste conversas/mensagens no Neon (via delegates tipados).
 * - Usa o provider ativo (OpenAI/Gemini) ou lança erro controlado.
 * - Monta contexto real do usuário (perfil + métricas disponíveis).
 */

export interface ChatResult {
  conversation: AIConversationWithMessages;
  assistantReply: string;
}

/** Lista conversas do usuário (mais recentes primeiro). */
export async function listConversations(userId: string) {
  const rows = await ai.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows as AIConversationWithMessages[];
}

/** Busca uma conversa com todas as mensagens. */
export async function getConversation(userId: string, conversationId: string) {
  const conv = await ai.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return null;
  if ((conv as { userId: string }).userId !== userId) return null;

  const messages = await ai.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    // Limite de segurança: uma conversa nunca deve carregar centenas de mensagens.
    take: 100,
  });
  return { ...conv, messages } as AIConversationWithMessages;
}

/** Exclui uma conversa (e mensagens, por cascade). */
export async function deleteConversation(userId: string, conversationId: string) {
  const conv = await ai.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || (conv as { userId: string }).userId !== userId) return false;
  await ai.conversation.delete({ where: { id: conversationId } });
  return true;
}

/** Rótulo inicial da conversa, derivado da primeira mensagem do usuário. */
function makeTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
}

/**
 * Envia uma mensagem: cria (se preciso) a conversa, persiste a mensagem do
 * usuário, chama o provider com o contexto, persiste a resposta.
 */
export async function sendChatMessage(
  userId: string,
  opts: { conversationId?: string; message: string }
): Promise<ChatResult> {
  const provider = await getAIProvider();
  if (!provider) throw new AIConfiguredError();

  // 1) Conversa (existente ou nova)
  let conversationId = opts.conversationId;
  if (conversationId) {
    const existing = await ai.conversation.findUnique({ where: { id: conversationId } });
    if (!existing || (existing as { userId: string }).userId !== userId) {
      conversationId = undefined;
    }
  }

  if (!conversationId) {
    const created = await ai.conversation.create({
      data: { userId, title: makeTitle(opts.message) },
    });
    conversationId = (created as { id: string }).id;
  }

  // 2) Persiste a mensagem do usuário
  await ai.message.create({
    data: {
      conversationId,
      userId,
      role: "user",
      content: opts.message,
    },
  });

  // 3) Contexto real do usuário + conhecimento oficial relevante
  const [kctx, gctx] = await Promise.all([
    buildKnowledgeContext(userId, {
      query: opts.message,
    }),
    buildGrowthContext(userId),
  ]);
  const system = [
    "Você é a IA Acessor, assistente do Inst Acessor para creators e pequenos negócios no Instagram e TikTok.",
    "Use apenas os dados fornecidos no contexto e o CONHECIMENTO OFICIAL indicado. Se um dado não estiver listado, ele está indisponível — NÃO invente métricas, seguidores, alcance ou conhecimento proprietário.",
    "NUNCA invente métricas. Separe explicitamente: DADO REAL, CONHECIMENTO, INFERÊNCIA, HIPÓTESE e RECOMENDAÇÃO.",
    "Quando os dados operacionais do usuário estiverem ausentes (SEM_REDE, SEM_SYNC ou POUCOS_DADOS), diga claramente 'DADO INSUFICIENTE' e recomende conectar/sincronizar antes de sugerir números.",
    "Responda de forma prática, em português, direta e acionável.",
    knowledgeContextToPrompt(kctx),
    growthContextToPrompt(gctx),
  ].join("\n");

  // 4) Histórico recente (para continuidade)
  const history = await ai.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages = (history as { role: string; content: string }[]).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));

  // 5) Chama o provider
  let assistantReply: string;
  try {
    assistantReply = await provider.complete({ system, messages });
  } catch (err) {
    // Se o provider falhar, ainda assim registra a mensagem do usuário e relança.
    console.error("[ai/chat] falha no provider", err);
    throw err;
  }

  // 6) Persiste a resposta
  await ai.message.create({
    data: { conversationId, userId, role: "assistant", content: assistantReply },
  });

  // 7) Atualiza `updatedAt` da conversa
  await ai.conversation.update({
    where: { id: conversationId },
    data: {},
  });

  const full = await getConversation(userId, conversationId);
  if (!full) throw new Error("Conversa não encontrada após atualização");

  return { conversation: full, assistantReply };
}
