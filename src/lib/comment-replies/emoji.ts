import type { CommentCategory } from "./types";

/**
 * TRATAMENTO DE COMENTÁRIOS SÓ COM EMOJI
 * ======================================
 * Regra de produto: comentário composto SOMENTE por emoji NUNCA recebe
 * parágrafo. Recebe resposta curta — idealmente espelhando o emoji.
 *
 * Ordem de decisão (resolvida no orquestrador, não aqui):
 *   1. template exato do usuário para aquele emoji  → usa exatamente
 *   2. perfil especial com resposta fixa            → usa exatamente
 *   3. IA com instrução de brevidade               → frase curta
 *   4. fallback local (este arquivo)                → espelho curto
 *
 * Este módulo é PURO (sem banco, sem rede) para poder ser testado.
 */

/**
 * Detecta se o texto é composto apenas por emoji/espaços/pontuação.
 *
 * Estratégia: remove espaços e pontuação neutra. O que sobra precisa estar
 * inteiramente na faixa de emoji/símbolos (Unicode) — via `\p{Extended_Pictographic}`,
 * que cobre ❤️ 😍 🔥 👏 😂 e também sequências com modificadores (skin tone)
 * e joiner ZWJ (👩💻, ❤️🔥).
 */
export function isEmojiOnly(raw: string): boolean {
  const text = (raw ?? "").trim();
  if (!text) return false;

  // Remove espaços, quebras e pontuação neutra (inclui ZWJ e variation selector,
  // que fazem parte das sequências de emoji).
  const stripped = text
    .replace(/[\s‍️⃣]/gu, "")
    .replace(/[\p{P}\p{S}]/gu, (ch) =>
      // `\p{S}` inclui símbolos que fazem parte de emoji (ex.: ©, ®, ™);
      // mantenha-os, mas descarte pontuação neutra pura.
      /\p{Extended_Pictographic}/u.test(ch) ? ch : ""
    );

  if (!stripped) return false;

  // Tudo o que restou deve ser pictográfico (ou dígito de keycap: 1️⃣).
  return /^[\p{Extended_Pictographic}\p{Emoji_Component}0-9]+$/u.test(stripped);
}

/**
 * Extrai os emojis distintos de um texto (na ordem em que aparecem).
 * Usado para casar templates por emoji.
 */
export function extractEmojis(raw: string): string[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  const matches = text.match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|\p{Emoji_Modifier})*/gu);
  return matches ?? [];
}

/**
 * Resposta local de emergência para comentário só-emoji, quando NÃO há template
 * nem IA disponível. Deliberadamente curtíssima.
 *
 * Para ❤️ 😍 🥰 👏 🔥 devolve um espelho/curtinha coerente; para qualquer outro
 * emoji, espelha o próprio emoji (a resposta mais segura e menos inventiva).
 */
export function fallbackEmojiReply(raw: string): string {
  const emojis = extractEmojis(raw);
  const first = emojis[0] ?? "";

  switch (first) {
    case "❤️":
    case "❤":
    case "🧡":
    case "💛":
    case "💚":
    case "💙":
    case "💜":
    case "🖤":
    case "🤍":
      return `${first}${first}`;
    case "😍":
      return "Amei! 🥰";
    case "🥰":
      return "🥰";
    case "🔥":
      return "Valeu demais 🔥";
    case "👏":
      return "Obrigada! 👏";
    case "😂":
    case "🤣":
      return "😂";
    case "🙌":
      return "🙌";
    case "👏🏻":
    case "👏🏼":
    case "👏🏽":
    case "👏🏾":
    case "👏🏿":
      return "Obrigada! 👏";
    default:
      // Espelhar o próprio emoji é a resposta mais curta e menos inventiva.
      return first || "❤️";
  }
}

/** Categoria derivada quando o comentário é só emoji. */
export function emojiCategory(): CommentCategory {
  return "emoji";
}

/**
 * Instrução de sistema injetada no prompt quando o comentário é só emoji.
 * Mantém a IA curta mesmo quando ela é quem escreve a resposta.
 */
export const EMOJI_SYSTEM_INSTRUCTION =
  "O comentário contém APENAS emoji(s). Responda com no MÁXIMO 4 palavras " +
  "(ou repetindo o emoji). NUNCA escreva uma frase longa ou um parágrafo. " +
  "Não use emoji diferente do que o comentário usou, salvo se o estilo do " +
  "usuário claramente fizer isso.";
