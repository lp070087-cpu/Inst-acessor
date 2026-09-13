import type { CommentCategory, ReplySource } from "./types";
import { isEmojiOnly, extractEmojis, fallbackEmojiReply } from "./emoji";

/**
 * RESOLUÇÃO DE PRIORIDADE — NÚCLEO PURO
 * =====================================
 * Decide COMO uma resposta será produzida, na ordem exata definida pelo produto:
 *
 *   1. Perfil específico   (SpecialProfileRule do @username)
 *   2. Palavra/frase/emoji (ReplyTemplate que casa com o texto)
 *   3. Categoria/grupo     (ReplyTemplate da categoria do comentário)
 *   4. IA geral            (gera com contexto real)
 *   5. Sensível            (REVISÃO OBRIGATÓRIA — nunca responde sozinho)
 *
 * A prioridade 5 é um CURTO-CIRCUITO, não um degrau: se o comentário for
 * sensível, ele para na revisão mesmo que 1–4 encontrassem resposta.
 *
 * Este módulo não toca em banco nem rede. Ele recebe os dados já carregados e
 * devolve uma DECISÃO, o que torna a regra auditável e testável.
 */

export interface SpecialProfileInput {
  id: string;
  instagramUsername: string;
  displayName?: string | null;
  customInstructions: string;
  fixedReply?: string | null;
  useAI: boolean;
  priority: number;
  active: boolean;
}

export interface TemplateInput {
  id: string;
  text: string;
  category: string;
  exactReply: boolean;
  active: boolean;
}

export type PriorityDecision =
  | {
      /** Resposta pronta — a IA NÃO precisa ser chamada. */
      kind: "EXACT";
      source: ReplySource;
      reply: string;
      matchedId: string | null;
      reason: string;
    }
  | {
      /** A IA deve gerar, com estas instruções/estilo. */
      kind: "AI";
      source: ReplySource;
      instructions: string[];
      styleExamples: string[];
      emojiOnly: boolean;
      emojiFallback: string | null;
      matchedId: string | null;
      reason: string;
      /** Segurança: exige aprovação humana mesmo em modo AUTO. */
      forceReview: boolean;
      reviewReason: string | null;
    }
  | {
      /** Nada a fazer: revisão obrigatória sem geração automática. */
      kind: "REVIEW_ONLY";
      source: ReplySource;
      reason: string;
      reviewReason: string;
      matchedId: string | null;
    };

/** Normaliza @username para comparação (sem "@", minúsculo, sem espaços). */
export function normalizeUsername(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
}

/**
 * Verifica se o comentário corresponde a um template por palavra/frase/emoji.
 * Comparação insensível a caixa; para emoji, exige que os emojis do template
 * estejam presentes no comentário.
 */
export function templateMatchesComment(template: TemplateInput, commentText: string): boolean {
  const text = (commentText ?? "").trim().toLowerCase();
  const needle = (template.text ?? "").trim().toLowerCase();
  if (!needle) return false;

  // Casamento literal (frase/palavra)
  if (text.includes(needle)) return true;

  // Casamento por emoji: se o template tem emojis e todos aparecem no comentário
  const templateEmojis = extractEmojis(template.text ?? "");
  if (templateEmojis.length > 0) {
    const commentEmojis = extractEmojis(commentText ?? "");
    if (commentEmojis.length > 0 && templateEmojis.every((e) => commentEmojis.includes(e))) {
      return true;
    }
  }

  return false;
}

export interface ResolvePriorityInput {
  commentText: string;
  commenterUsername: string;
  category: CommentCategory;
  /** Motivo determinístico de revisão (de `safety.detectReviewTrigger`). */
  reviewTrigger: string | null;
  specialProfiles: SpecialProfileInput[];
  templates: TemplateInput[];
  /** Tom definido pelo usuário (para a IA seguir). */
  tone?: string | null;
}

/**
 * Aplica a ordem de prioridade e devolve a decisão.
 */
export function resolvePriority(input: ResolvePriorityInput): PriorityDecision {
  const emojiOnly = isEmojiOnly(input.commentText);
  const commenter = normalizeUsername(input.commenterUsername);

  // ---- PRIORIDADE 1 — perfil específico ----
  // Ordena por `priority` (menor = mais alta); empate resolvido pelo mais antigo
  // é irrelevante aqui porque a lista já vem ordenada do banco.
  const special = input.specialProfiles
    .filter((p) => p.active && normalizeUsername(p.instagramUsername) === commenter)
    .sort((a, b) => a.priority - b.priority)[0];

  if (special) {
    // Comentário sensível vence até a regra do perfil específico.
    if (input.reviewTrigger) {
      return {
        kind: "REVIEW_ONLY",
        source: "PERFIL_ESPECIAL",
        reason: `@${commenter} tem regra própria, mas o comentário exige revisão.`,
        reviewReason: input.reviewTrigger,
        matchedId: special.id,
      };
    }

    // Resposta fixa do perfil tem precedência sobre a IA.
    if (special.fixedReply && special.fixedReply.trim()) {
      return {
        kind: "EXACT",
        source: "PERFIL_ESPECIAL",
        reply: special.fixedReply.trim(),
        matchedId: special.id,
        reason: `Resposta fixa definida para @${commenter}.`,
      };
    }

    return {
      kind: "AI",
      source: "PERFIL_ESPECIAL",
      instructions: [special.customInstructions],
      styleExamples: [],
      emojiOnly,
      emojiFallback: emojiOnly ? fallbackEmojiReply(input.commentText) : null,
      matchedId: special.id,
      reason: `Instruções personalizadas para @${commenter}.`,
      forceReview: false,
      reviewReason: null,
    };
  }

  // ---- PRIORIDADE 2 — palavra/frase/emoji ----
  const exactTemplate = input.templates.find(
    (t) => t.active && t.exactReply && templateMatchesComment(t, input.commentText)
  );
  if (exactTemplate && !input.reviewTrigger) {
    return {
      kind: "EXACT",
      source: "TEMPLATE_FIXO",
      reply: exactTemplate.text.trim(),
      matchedId: exactTemplate.id,
      reason: "Resposta fixa que casa com o comentário.",
    };
  }

  const styleTemplate = input.templates.find(
    (t) => t.active && !t.exactReply && templateMatchesComment(t, input.commentText)
  );

  // ---- PRIORIDADE 5 (curto-circuito) — comentário sensível ----
  // Chega aqui depois de não haver resposta fixa aplicável.
  if (input.reviewTrigger) {
    return {
      kind: "REVIEW_ONLY",
      source: styleTemplate ? "TEMPLATE_FIXO" : "IA",
      reason: "Comentário exige revisão humana antes de qualquer resposta.",
      reviewReason: input.reviewTrigger,
      matchedId: styleTemplate?.id ?? null,
    };
  }

  // ---- Comentário só de emoji sem template específico ----
  // Não vale acionar a IA só para devolver "❤️❤️": o fallback local é curto,
  // coerente e determinístico. Se houver template de estilo, ele entra como
  // exemplo e a IA escreve — respeitando a instrução de brevidade.
  if (emojiOnly && !styleTemplate) {
    return {
      kind: "EXACT",
      source: "EMOJI",
      reply: fallbackEmojiReply(input.commentText),
      matchedId: null,
      reason: "Comentário só de emoji — resposta curta local.",
    };
  }

  // ---- PRIORIDADE 3 — categoria/grupo ----
  const categoryTemplate =
    styleTemplate ??
    input.templates.find((t) => t.active && !t.exactReply && t.category === input.category);

  const styleExamples = input.templates
    .filter((t) => t.active && !t.exactReply)
    .slice(0, 8)
    .map((t) => t.text.trim())
    .filter(Boolean);

  const instructions: string[] = [];
  if (input.tone && input.tone.trim()) {
    instructions.push(`Tom definido pelo usuário: ${input.tone.trim()}.`);
  }
  if (categoryTemplate) {
    instructions.push(`Categoria do comentário: ${input.category}.`);
  }

  // ---- PRIORIDADE 4 — IA geral ----
  return {
    kind: "AI",
    source: categoryTemplate ? "TEMPLATE_FIXO" : "IA",
    instructions,
    styleExamples,
    emojiOnly,
    emojiFallback: emojiOnly ? fallbackEmojiReply(input.commentText) : null,
    matchedId: categoryTemplate?.id ?? null,
    reason: categoryTemplate
      ? `Exemplo de estilo da categoria "${input.category}".`
      : "Geração geral pela IA.",
    forceReview: false,
    reviewReason: null,
  };
}
