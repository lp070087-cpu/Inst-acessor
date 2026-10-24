/**
 * TELEFONE BRASILEIRO — MÁSCARA E NORMALIZAÇÃO (puro, sem DOM)
 * ============================================================
 * Usado pelo formulário da lista de espera. A pessoa digita só DDD + número
 * ("(11) 99999-9999" ou "(11) 3333-4444"); o "+55" é fixo na interface e o
 * payload continua em E.164 (`+55DDDNÚMERO`), exatamente o formato exigido por
 * `launchSignupSchema` (/^\+[1-9]\d{7,14}$/). Nenhuma regra do servidor muda.
 */

/** DDDs em uso no Brasil (plano de numeração da Anatel). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Quantidade máxima de dígitos nacionais (DDD + 9 dígitos de celular). */
export const BR_NATIONAL_MAX_DIGITS = 11;

/**
 * Extrai os dígitos NACIONAIS (DDD + número) de qualquer entrada: digitada,
 * colada ou vinda do preenchimento automático. Aceita "+55 11 99999-9999",
 * "55 11 99999-9999", "011 99999-9999" e "(11) 99999-9999".
 *
 * - Zeros à esquerda (prefixo de operadora/tronco) são descartados: nenhum DDD
 *   começa com 0.
 * - O código do país 55 só é removido quando a entrada começa com "+" ou quando
 *   sobram dígitos além de um número nacional completo — "55" sozinho também é
 *   um DDD válido (RS) e não pode ser apagado durante a digitação.
 * - O resultado é limitado a 11 dígitos.
 */
export function brazilianPhoneDigits(raw: string): string {
  const text = String(raw ?? "").trim();
  let digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) {
    if (digits.startsWith("55")) digits = digits.slice(2);
  } else if (digits.length > BR_NATIONAL_MAX_DIGITS && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, "");
  return digits.slice(0, BR_NATIONAL_MAX_DIGITS);
}

/**
 * Máscara progressiva a partir dos dígitos nacionais:
 * "1" → "(1", "11" → "(11", "119" → "(11) 9", "1133334444" → "(11) 3333-4444",
 * "11999998888" → "(11) 99999-8888".
 */
export function formatBrazilianPhone(digitsInput: string): string {
  const digits = digitsInput.replace(/\D/g, "").slice(0, BR_NATIONAL_MAX_DIGITS);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2), rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** Atalho: qualquer entrada → valor mascarado. */
export function maskBrazilianPhone(raw: string): string {
  return formatBrazilianPhone(brazilianPhoneDigits(raw));
}

export type BrazilianPhoneProblem = "empty" | "incomplete" | "ddd" | "mobile-nine" | "landline";

/** Diagnóstico dos dígitos nacionais; `null` quando o número é aceitável. */
export function brazilianPhoneProblem(digits: string): BrazilianPhoneProblem | null {
  if (!digits) return "empty";
  if (digits.length >= 2 && !VALID_DDDS.has(Number(digits.slice(0, 2)))) return "ddd";
  if (digits.length < 10) return "incomplete";
  const first = digits[2];
  if (digits.length === 11) return first === "9" ? null : "mobile-nine";
  // 10 dígitos: fixo começa com 2–5; 6–9 indica celular sem o 9 inicial.
  if (first >= "2" && first <= "5") return null;
  return first >= "6" ? "mobile-nine" : "landline";
}

export const BRAZILIAN_PHONE_MESSAGES: Record<BrazilianPhoneProblem, string> = {
  empty: "Informe seu WhatsApp com DDD.",
  incomplete: "Número incompleto. Use DDD + número, por exemplo (11) 99999-9999.",
  ddd: "DDD inválido. Confira os dois primeiros dígitos.",
  "mobile-nine": "Celulares têm 9 dígitos após o DDD. Confira se falta o 9 inicial.",
  landline: "Número inválido. Confira os dígitos após o DDD.",
};

/** E.164 brasileiro (`+55DDDNÚMERO`) ou `null` se o número não for válido. */
export function toBrazilianE164(raw: string): string | null {
  const digits = brazilianPhoneDigits(raw);
  return brazilianPhoneProblem(digits) ? null : `+55${digits}`;
}

/**
 * Aplica uma edição do campo mascarado preservando a posição do cursor.
 *
 * `previous` é o valor mascarado anterior, `next` o que o navegador produziu e
 * `caret` a posição do cursor em `next`. Se a pessoa apagou só um separador
 * ("(", ")", " " ou "-"), o dígito anterior a ele é removido — sem isso o
 * Backspace ficaria "preso" na máscara.
 */
export function applyBrazilianPhoneEdit(previous: string, next: string, caret: number): { value: string; caret: number } {
  const prevDigits = previous.replace(/\D/g, "");
  let nextText = next, pos = Math.max(0, Math.min(caret, next.length));
  const deletedSeparatorOnly = next.length < previous.length && next.replace(/\D/g, "") === prevDigits && prevDigits.length > 0;
  if (deletedSeparatorOnly) {
    // Remove o último dígito antes do cursor.
    let i = pos - 1;
    while (i >= 0 && !/\d/.test(nextText[i])) i--;
    if (i >= 0) { nextText = nextText.slice(0, i) + nextText.slice(i + 1); pos = i; }
  }
  const digits = brazilianPhoneDigits(nextText);
  const value = formatBrazilianPhone(digits);
  const plainDigits = nextText.replace(/\D/g, "");
  // Prefixo de país/tronco removido (colagem): cursor vai para o fim.
  if (plainDigits.slice(0, digits.length) !== digits) return { value, caret: value.length };
  const digitsBefore = Math.min(nextText.slice(0, pos).replace(/\D/g, "").length, digits.length);
  if (digitsBefore >= digits.length) return { value, caret: value.length };
  let seen = 0, index = 0;
  while (index < value.length && seen < digitsBefore) { if (/\d/.test(value[index])) seen++; index++; }
  return { value, caret: index };
}
