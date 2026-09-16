import { ai } from "@/lib/ai/db";
import type { AIConversationWithMessages } from "@/lib/ai/db";
import { getAIProvider } from "@/lib/ai";
import { buildKnowledgeContext, knowledgeContextToPrompt } from "@/lib/knowledge/context-builder";
import { absenceRules } from "@/lib/ai/context";

/**
 * Serviço do chat IA Acessor.
 * - Persiste conversas/mensagens no Neon (via delegates tipados).
 * - Usa o provider ativo (OpenAI/Gemini) ou lança erro controlado.
 * - Monta contexto real do usuário (perfil + métricas disponíveis).
 */

export class AIConfiguredError extends Error {
  constructor() {
    super("IA_NAO_CONFIGURADA");
  }
}

/**
 * TOM E TAMANHO DA RESPOSTA
 * -------------------------
 * O problema anterior: o prompt pedia categorias internas (DADO REAL,
 * INFERÊNCIA, HIPÓTESE...) e um "formato de resposta estratégica" com oito
 * seções. O resultado era um relatório para perguntas simples, começando por
 * "DADO REAL: ..." — linguagem de prompt vazando para o usuário.
 *
 * Agora as categorias continuam valendo como RACIOCÍNIO interno, mas a
 * conversa precisa parecer natural.
 */
const TONE_RULES = [
  "COMO RESPONDER (obrigatório):",
  "- Converse como um mentor experiente. NUNCA comece a resposta com rótulos internos como \"DADO REAL:\", \"CONTEXTO:\", \"RECOMENDAÇÃO:\", \"INFERÊNCIA:\" ou \"HIPÓTESE:\". Essas categorias são para o seu raciocínio, não para o texto final.",
  "- TAMANHO: por padrão, resposta CURTA a média. Responda a pergunta primeiro e pare. Não escreva artigo, não entregue relatório e não liste tudo o que você sabe.",
  "- Pergunta prática (\"como faço\", \"por onde começo\") → estrutura preferencial: 1) resposta direta em uma ou duas frases; 2) de 3 a 5 passos curtos; 3) uma dica contextual. Nada além disso.",
  "- Só aprofunde (plano completo, análise, várias opções) quando o usuário pedir explicitamente — \"detalha\", \"explique melhor\", \"me dá mais ideias\", \"quero um plano completo\". Aí sim use títulos e listas mais longas.",
  "- Use os dados reais para PERSONALIZAR a resposta, não para exibir um relatório de métricas. Só cite números quando eles sustentarem a resposta.",
  "- Markdown é permitido e será renderizado: **negrito**, listas com \"- \", passos com \"1. \", subtítulos com \"## \". Use com moderação — um título curto quando ajudar a organizar, nunca um cabeçalho para cada frase.",
  "- Escreva em português do Brasil, direto e acionável. Sem jargão técnico e sem citar nomes de campos do sistema.",
].join("\n");

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
  const kctx = await buildKnowledgeContext(userId, {
    query: opts.message,
  });
  const system = [
    "Você é a IA Acessor, assistente do Inst Acessor para creators e pequenos negócios no Instagram e TikTok.",
    "Use apenas os dados fornecidos no contexto e o CONHECIMENTO OFICIAL indicado. NÃO invente métricas, seguidores, alcance nem conhecimento proprietário.",
    absenceRules(),
    TONE_RULES,
    knowledgeContextToPrompt(kctx),
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
