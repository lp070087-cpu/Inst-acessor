import { getAIProvider } from "@/lib/ai";
import type { AIProfileData } from "@/lib/ai/services/profile";
import { EMOJI_SYSTEM_INSTRUCTION } from "./emoji";
import type { PriorityDecision } from "./priority";

/**
 * GERAÇÃO DE RESPOSTA (IA)
 * ========================
 * Escreve a resposta de um comentário usando o provider de IA ATIVO — a mesma
 * configuração central do Admin resolvida por `resolveRuntimeAI()`. Não existe
 * segunda configuração de IA: se o Admin cadastrou OpenAI em /admin/ia, é essa
 * chave/modelo que responde aqui.
 *
 * Contexto injetado (somente dados REAIS do usuário):
 *   • Perfil de Inteligência (nicho, tom, estilo, objetivos)
 *   • Perfil do usuário (nicho/objetivo, quando o Perfil de Inteligência ainda
 *     não tiver sido construído)
 *   • Instruções do perfil especial, quando houver
 *   • Exemplos de estilo do usuário (templates)
 *   • Comentário e contexto da publicação
 *   • Respostas recentes — para NÃO repetir
 *
 * Se não houver IA configurada, devolve `null` em vez de inventar texto. O
 * chamador então mantém o comentário como PENDENTE com revisão manual.
 */

export interface GenerateInput {
  decision: PriorityDecision;
  commentText: string;
  commenterUsername: string;
  mediaCaption?: string | null;
  mediaType?: string | null;
  aiProfile: AIProfileData | null;
  profileNiche?: string | null;
  profileObjective?: string | null;
  /** Últimas respostas já enviadas — usadas como "não repita isto". */
  recentReplies: string[];
}

export interface GenerateResult {
  ok: boolean;
  reply?: string;
  /** Motivo controlado quando `ok === false`. */
  reason?: string;
}

/** Monta o prompt de sistema a partir do contexto real disponível. */
function buildSystemPrompt(input: GenerateInput): string {
  const lines: string[] = [];

  lines.push(
    "Você escreve respostas CURTAS e naturais para comentários no Instagram, em nome do próprio perfil.",
    "Escreva como uma pessoa responderia — nunca como um robô ou central de atendimento.",
    "Português do Brasil. Sem formalidade excessiva. Sem emoji inventado além do que o estilo indicar.",
    "NUNCA prometa resultado, cura, desconto, prazo, sorteio ou preço.",
    "NUNCA peça dados pessoais, nem peça para a pessoa chamar no direct para tratar de pagamento.",
    "NUNCA invente informação sobre produto, serviço ou prazo que não esteja no contexto.",
    "Se o comentário exigir informação que você não tem, responda de forma acolhedora e genérica, sem inventar."
  );

  const p = input.aiProfile;
  if (p) {
    const ctx: string[] = [];
    if (p.summary) ctx.push(`Resumo do perfil: ${p.summary}`);
    if (p.niche) ctx.push(`Nicho: ${p.niche}`);
    if (p.subNiche) ctx.push(`Sub-nicho: ${p.subNiche}`);
    if (p.objectives) ctx.push(`Objetivos: ${p.objectives}`);
    if (p.voiceTone) ctx.push(`Tom de voz: ${p.voiceTone}`);
    if (p.writingStyle) ctx.push(`Estilo de escrita: ${p.writingStyle}`);
    if (p.communicationStyle) ctx.push(`Estilo de comunicação: ${p.communicationStyle}`);
    if (p.ctaPatterns) ctx.push(`Padrões de CTA: ${p.ctaPatterns}`);
    if (ctx.length > 0) {
      lines.push("PERFIL DE INTELIGÊNCIA (dados reais do usuário):");
      lines.push(...ctx);
    }
  } else {
    const ctx: string[] = [];
    if (input.profileNiche) ctx.push(`Nicho: ${input.profileNiche}`);
    if (input.profileObjective) ctx.push(`Objetivo: ${input.profileObjective}`);
    if (ctx.length > 0) {
      lines.push(
        "PERFIL (o Perfil de Inteligência ainda está em construção — use apenas o que está abaixo):"
      );
      lines.push(...ctx);
    }
  }

  // Instruções do perfil especial / categoria vêm da decisão de prioridade.
  if (input.decision.kind === "AI" && input.decision.instructions.length > 0) {
    lines.push("INSTRUÇÕES ESPECÍFICAS PARA ESTA RESPOSTA (prioridade mais alta):");
    lines.push(...input.decision.instructions.map((i) => `- ${i}`));
  }

  if (input.decision.kind === "AI" && input.decision.styleExamples.length > 0) {
    lines.push(
      "EXEMPLOS DE ESTILO — são REFERÊNCIA DE ESTILO, NÃO frases para copiar:",
      ...input.decision.styleExamples.map((e) => `- ${e}`),
      "Escreva uma resposta NOVA, com esse mesmo jeito, sem repetir literalmente nenhum exemplo."
    );
  }

  if (input.decision.kind === "AI" && input.decision.emojiOnly) {
    lines.push(EMOJI_SYSTEM_INSTRUCTION);
  }

  if (input.recentReplies.length > 0) {
    lines.push(
      "RESPOSTAS JÁ USADAS RECENTEMENTE — NÃO repita nenhuma delas nem use estrutura parecida:",
      ...input.recentReplies.slice(0, 10).map((r) => `- ${r}`),
      "Vários comentários diferentes podem ter o mesmo conteúdo ('linda', 'amei'). Sua resposta precisa ser diferente da última que você deu."
    );
  }

  lines.push(
    "FORMATO: devolva APENAS o texto da resposta. Sem aspas, sem prefixo, sem explicação, sem hashtags."
  );

  return lines.join("\n");
}

/**
 * Gera a resposta. Nunca lança: devolve `{ ok:false, reason }` em qualquer
 * falha, para que o comentário permaneça em revisão humana.
 */
export async function generateReply(input: GenerateInput): Promise<GenerateResult> {
  // Resposta já pronta (template fixo / perfil especial com resposta fixa /
  // emoji local) não passa pela IA — economia e determinismo.
  if (input.decision.kind === "EXACT") {
    return { ok: true, reply: input.decision.reply };
  }

  if (input.decision.kind === "REVIEW_ONLY") {
    return { ok: false, reason: "Este comentário exige revisão humana." };
  }

  const provider = await getAIProvider();
  if (!provider) {
    // Sem IA configurada: emoji ainda tem fallback local curto e seguro.
    if (input.decision.emojiOnly && input.decision.emojiFallback) {
      return { ok: true, reply: input.decision.emojiFallback };
    }
    return {
      ok: false,
      reason: "IA não configurada. A resposta precisa ser escrita manualmente.",
    };
  }

  const system = buildSystemPrompt(input);

  const userContent = [
    `Comentário de @${input.commenterUsername || "usuario"}: "${input.commentText}"`,
    input.mediaCaption
      ? `Contexto da publicação: "${input.mediaCaption.slice(0, 300)}"`
      : "Contexto da publicação: indisponível.",
    input.mediaType ? `Tipo da publicação: ${input.mediaType}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await provider.complete({
      system,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.85, // variação é desejada aqui: evita respostas clonadas
      maxTokens: 120,
    });

    const reply = sanitizeReply(raw);
    if (!reply) {
      return { ok: false, reason: "A IA não devolveu uma resposta utilizável." };
    }
    return { ok: true, reply };
  } catch (err) {
    console.error("[comment-replies/generator] falha na IA", err);
    return {
      ok: false,
      reason: "Não foi possível gerar a resposta agora. Tente novamente ou escreva manualmente.",
    };
  }
}

/** Limpa a resposta: remove aspas envolventes, prefixos e quebras excessivas. */
export function sanitizeReply(raw: string): string {
  let text = (raw ?? "").trim();

  // Modelos às vezes respondem com o rótulo. Remove sem tocar no conteúdo.
  text = text.replace(/^(resposta|reply|sugest[ãa]o)\s*:\s*/i, "");

  // Aspas envolventes
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("“") && text.endsWith("”")) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/\s+/g, " ").trim();

  // Limite duro: comentário de Instagram não comporta parágrafo.
  if (text.length > 280) {
    text = `${text.slice(0, 277).trimEnd()}...`;
  }

  return text;
}

/**
 * Compara duas respostas em busca de repetição.
 *
 * Compara apenas as PALAVRAS (minúsculas, sem acento, sem pontuação) e usa
 * similaridade de Jaccard. Um limiar alto (0.8) pega o caso real — respostas
 * idênticas ou quase — sem acusar como repetição duas frases curtas que
 * compartilham palavras comuns ("Obrigada pelo carinho!" vs "Obrigada!").
 */
export function isTooSimilar(a: string, b: string): boolean {
  const norm = (s: string) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      // Remove as marcas combinantes (acentos) deixadas pelo NFD. Usa a
      // categoria Unicode `\p{M}` em vez de uma faixa literal, para não
      // depender de caracteres invisíveis no arquivo-fonte.
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const wordsX = new Set(x.split(" "));
  const wordsY = new Set(y.split(" "));
  const inter = [...wordsX].filter((w) => wordsY.has(w)).length;
  const union = new Set([...wordsX, ...wordsY]).size;
  return union > 0 && inter / union >= 0.8;
}
