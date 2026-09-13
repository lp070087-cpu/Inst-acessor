/**
 * COMENTÁRIO → DIRECT — GATILHOS (NÚCLEO PURO)
 * ============================================
 * Decide se um comentário deve disparar uma mensagem privada.
 *
 * IMPORTANTE — este módulo NÃO tem I/O:
 *   - não importa Prisma, não faz fetch, não lê env vars, não toca token;
 *   - não depende de nenhuma permissão da Meta;
 *   - é 100% determinístico e testável.
 *
 * R E G R A   D E   O U R O
 * --------------------------
 * O casamento do gatilho é DETERMINÍSTICO. A IA pode escrever o TEXTO da
 * mensagem, mas NUNCA decide se um comentário dispara ou não. Isso mantém a
 * automação auditável e previsível — e é o oposto do que as Respostas
 * Inteligentes fazem (lá a IA classifica o comentário).
 *
 * Nada aqui envia mensagem. Nada aqui é chamado pelo webhook ainda: a
 * automação Comentário → Direct ainda não está ligada em produção
 * (ver docs/RELATORIO-COMENTARIO-DIRECT.md).
 */

/** Tipos de gatilho suportados, do mais preciso para o mais amplo. */
export const TRIGGER_TYPES = [
  "EXACT_WORD",
  "ANY_OF_LIST",
  "CONTAINS_TEXT",
  "ANY_COMMENT",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const TRIGGER_TYPE_LABEL: Record<TriggerType, string> = {
  EXACT_WORD: "Palavra exata",
  ANY_OF_LIST: "Qualquer palavra da lista",
  CONTAINS_TEXT: "Texto contém",
  ANY_COMMENT: "Qualquer comentário",
};

export const TRIGGER_TYPE_HINT: Record<TriggerType, string> = {
  EXACT_WORD:
    'O comentário precisa ser exatamente esta palavra. Ex.: "QUERO" — "quero!" também casa.',
  ANY_OF_LIST:
    "O comentário precisa ser uma destas palavras. Ex.: QUERO, LINK, MANDA.",
  CONTAINS_TEXT:
    'O comentário precisa conter esta expressão em qualquer posição. Ex.: "quero saber mais".',
  ANY_COMMENT:
    "Dispara em qualquer comentário elegível. Use com limite de envios — é o gatilho mais amplo.",
};

/** Teto defensivo para a lista de termos (evita configuração absurda). */
export const MAX_TRIGGER_TERMS = 50;
/** Teto defensivo para o tamanho de cada termo. */
export const MAX_TERM_LENGTH = 120;
/** Teto para o texto da mensagem privada. */
export const MAX_MESSAGE_LENGTH = 900;

/** Marcas combinantes (acentos) — categoria Unicode \p{M}. */
const COMBINING_MARKS = /\p{M}/gu;
/** Pontuação/símbolo no início do texto (preserva letras e números). */
const LEADING_NON_ALNUM = /^[^\p{L}\p{N}]+/u;
/** Pontuação/símbolo no fim do texto. */
const TRAILING_NON_ALNUM = /[^\p{L}\p{N}]+$/u;

/**
 * Normaliza um texto para comparação:
 *   - minúsculas;
 *   - remove acentos (NFD + descarte das marcas combinantes);
 *   - colapsa espaços repetidos;
 *   - remove pontuação/emoji das BORDAS (mas preserva o miolo).
 *
 * Assim `"QUERO!"`, `"quero"` e `"  Quero. "` normalizam para `"quero"`.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_NON_ALNUM, "")
    .replace(TRAILING_NON_ALNUM, "")
    .trim();
}

/** Resultado do teste de um gatilho. */
export interface TriggerMatchResult {
  /** true quando o comentário deve disparar a mensagem privada. */
  matched: boolean;
  /** Qual termo casou — usado para auditoria no histórico. Só em match. */
  matchedTerm: string | null;
}

/** Resultado "não casou" reutilizável. */
const NO_MATCH: TriggerMatchResult = { matched: false, matchedTerm: null };

/**
 * Decide se `commentText` casa com o gatilho configurado.
 *
 * @param triggerType tipo do gatilho
 * @param terms       termos configurados (ignorados em ANY_COMMENT)
 * @param commentText texto do comentário, como veio da API
 *
 * Em caso de configuração inválida (tipo desconhecido, lista vazia em gatilho
 * que exige termos) devolve **não casou** — fail-closed: na dúvida, não envia.
 */
export function matchesTrigger(
  triggerType: string,
  terms: readonly string[],
  commentText: string | null | undefined
): TriggerMatchResult {
  // Sem texto não há como casar nada — nem em ANY_COMMENT (um comentário
  // apagado ou só com emoji não justifica uma mensagem privada).
  const comment = normalizeText(commentText ?? "");
  if (!comment) return NO_MATCH;

  switch (triggerType) {
    case "ANY_COMMENT":
      // Qualquer comentário não vazio é elegível. Os limites da regra
      // (diário / por pessoa / pausa) são aplicados ANTES do envio.
      return { matched: true, matchedTerm: null };

    case "EXACT_WORD": {
      const term = normalizeText(terms[0] ?? "");
      if (!term) return NO_MATCH;
      return comment === term ? { matched: true, matchedTerm: terms[0] } : NO_MATCH;
    }

    case "ANY_OF_LIST": {
      for (const raw of terms) {
        const term = normalizeText(raw ?? "");
        if (term && comment === term) return { matched: true, matchedTerm: raw };
      }
      return NO_MATCH;
    }

    case "CONTAINS_TEXT": {
      for (const raw of terms) {
        const term = normalizeText(raw ?? "");
        // O termo precisa ter ao menos 2 caracteres: um termo de 1 letra
        // casaria com quase tudo e viraria disparo em massa.
        if (term.length >= 2 && comment.includes(term)) {
          return { matched: true, matchedTerm: raw };
        }
      }
      return NO_MATCH;
    }

    default:
      // Tipo desconhecido → fail-closed.
      return NO_MATCH;
  }
}

/** Erro de validação de configuração (mostrado na UI, nunca enviado à Meta). */
export interface TriggerValidationError {
  field: "triggerType" | "triggerTerms" | "messageText";
  message: string;
}

/**
 * Valida a configuração de um gatilho antes de salvar.
 * Devolve a lista de problemas (vazia = configuração válida).
 */
export function validateTriggerConfig(input: {
  triggerType: string;
  triggerTerms: readonly string[];
  messageText: string;
}): TriggerValidationError[] {
  const errors: TriggerValidationError[] = [];

  if (!TRIGGER_TYPES.includes(input.triggerType as TriggerType)) {
    errors.push({ field: "triggerType", message: "Tipo de gatilho inválido." });
    return errors;
  }

  const type = input.triggerType as TriggerType;
  const terms = input.triggerTerms.map((t) => (t ?? "").trim()).filter(Boolean);

  if (type !== "ANY_COMMENT") {
    if (terms.length === 0) {
      errors.push({
        field: "triggerTerms",
        message: "Informe ao menos um termo para este tipo de gatilho.",
      });
    }
    if (type === "EXACT_WORD" && terms.length > 1) {
      errors.push({
        field: "triggerTerms",
        message:
          "O gatilho de palavra exata aceita um único termo. Para vários, use “Qualquer palavra da lista”.",
      });
    }
    if (type === "ANY_OF_LIST" && terms.length < 2) {
      errors.push({
        field: "triggerTerms",
        message:
          "A lista precisa de pelo menos dois termos. Para um só, use “Palavra exata”.",
      });
    }
    if (terms.length > MAX_TRIGGER_TERMS) {
      errors.push({
        field: "triggerTerms",
        message: `Máximo de ${MAX_TRIGGER_TERMS} termos por gatilho.`,
      });
    }
    for (const t of terms) {
      if (t.length > MAX_TERM_LENGTH) {
        errors.push({
          field: "triggerTerms",
          message: `Cada termo pode ter no máximo ${MAX_TERM_LENGTH} caracteres.`,
        });
        break;
      }
    }
    if (type === "CONTAINS_TEXT" && terms.every((t) => normalizeText(t).length < 2)) {
      errors.push({
        field: "triggerTerms",
        message: "A expressão precisa ter ao menos 2 caracteres.",
      });
    }
  }

  const message = (input.messageText ?? "").trim();
  if (!message) {
    errors.push({ field: "messageText", message: "Escreva a mensagem que será enviada no Direct." });
  } else if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push({
      field: "messageText",
      message: `A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`,
    });
  } else if (message.includes("{{")) {
    // Placeholders não são suportados: nada de variável não resolvida indo
    // para o Direct de um cliente.
    errors.push({
      field: "messageText",
      message: "A mensagem não pode conter variáveis ({{...}}).",
    });
  }

  return errors;
}

/**
 * Motivo pelo qual um envio NÃO aconteceu. Fica registrado no histórico —
 * é o que permite ao usuário entender por que a automação não disparou.
 */
export const SKIP_REASONS = {
  TRIGGER_NOT_MATCHED: "O comentário não corresponde ao gatilho.",
  DUPLICATE: "Já existe uma mensagem registrada para este comentário.",
  DAILY_LIMIT: "Limite diário de envios da regra foi atingido.",
  RULE_DISABLED: "A automação está desligada.",
  RULE_PAUSED: "A automação está pausada.",
  ALREADY_MESSAGED_USER: "Esta pessoa já recebeu uma mensagem desta automação.",
  MISSING_PERMISSION:
    "A conexão do Instagram não tem a permissão necessária para enviar mensagens privadas.",
  NOT_CONNECTED: "A conexão com o Instagram não está ativa.",
  NO_MEDIA_MATCH: "A automação não se aplica a esta publicação.",
} as const;
export type SkipReason = keyof typeof SKIP_REASONS;
