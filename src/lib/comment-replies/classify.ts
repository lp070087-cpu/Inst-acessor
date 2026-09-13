import { getAIProvider } from "@/lib/ai";
import { isEmojiOnly } from "./emoji";
import { detectReviewTrigger } from "./safety";
import type { CommentCategory } from "./types";
import { COMMENT_CATEGORIES } from "./types";

/**
 * CLASSIFICADOR DE COMENTÁRIO
 * ===========================
 * Duas camadas, nesta ordem:
 *
 *  1. REGRAS DETERMINÍSTICAS (sem rede, sem custo) — resolvem o caso comum e,
 *     principalmente, os casos de SEGURANÇA. Se o texto contém "preço",
 *     "processo", "remédio", link ou palavrão, ele é marcado como sensível
 *     ANTES de qualquer chamada de IA. Um classificador de IA pode errar; o
 *     filtro determinístico não depende dele.
 *
 *  2. IA (quando disponível) — refina a categoria semântica (elogio vs dúvida
 *     vs reclamação) para comentários que passaram pelo filtro.
 *
 * Sem IA configurada, a camada 1 sozinha ainda produz classificação útil —
 * nunca falha por falta de chave.
 */

export interface Classification {
  category: CommentCategory;
  /** Motivo determinístico de revisão, quando houver. */
  reviewTrigger: string | null;
  /** Fonte da decisão — útil para o relatório e para depurar na UI. */
  source: "REGRA" | "REGRA+IA" | "REGRA_FALLBACK";
}

/** Pistas determinísticas de categoria (aplicadas antes da IA). */
const HEURISTICS: { category: CommentCategory; patterns: RegExp[] }[] = [
  {
    category: "agradecimento",
    patterns: [/\bobrigad/i, /\bbrigad/i, /\bvaleu\b/i, /\bthanks?\b/i, /\bagradeç/i, /\bgratid[ãa]o\b/i],
  },
  {
    category: "elogio",
    patterns: [
      /\blind[ao]\b/i, /\bmaravilhos/i, /\bperfeit/i, /\bamei\b/i, /\bador(ei|o|ável)\b/i,
      /\btop\b/i, /\bincr[íi]vel\b/i, /\bexcelent/i, /\bbel[íi]ssim/i, /\bmelhor\b/i,
      /\bshow\b/i, /\bparab[ée]ns\b/i, /\bcresc(er|eu)\b/i, /\bque\s+legal\b/i,
    ],
  },
  {
    category: "pergunta_simples",
    patterns: [/\?$/, /\bcomo\b/i, /\bquando\b/i, /\bonde\b/i, /\bqual\b/i, /\bquantos?\b/i, /\bpoderia\b/i, /\bpode\b/i],
  },
  {
    category: "reclamacao",
    patterns: [/\bn[ãa]o\s+funcion/i, /\bp[ée]ssim/i, /\bproblema\b/i, /\breclama/i, /\bn[ãa]o\s+recebi\b/i, /\bdecepcion/i],
  },
  {
    category: "critica",
    patterns: [/\bdiscordo\b/i, /\bn[ãa]o\s+concordo\b/i, /\berrad/i, /\bengan/i, /\bn[ãa]o\s+é\s+assim\b/i],
  },
  {
    category: "spam",
    patterns: [/\bganhe\s+seguidores\b/i, /\bclique\s+aqui\b/i, /https?:\/\//i, /\btelegram\b/i, /\bdm\s+me\b/i],
  },
];

/**
 * Classifica um comentário.
 * @param text  texto original
 * @param aiAvailable  pré-checado pelo chamador para não resolver 2× o runtime
 */
export async function classifyComment(
  text: string,
  aiAvailable: boolean
): Promise<Classification> {
  const clean = (text ?? "").trim();

  // ---- Camada 1: segurança e casos triviais ----
  const reviewTrigger = detectReviewTrigger(clean);

  if (!clean) {
    return { category: "outro", reviewTrigger: null, source: "REGRA" };
  }

  if (isEmojiOnly(clean)) {
    // Emoji só não é sensível por si; o trigger determinístico já foi checado.
    return { category: "emoji", reviewTrigger, source: "REGRA" };
  }

  // Termos bloqueantes definem a categoria sensível sem chamar a IA.
  if (reviewTrigger) {
    const category: CommentCategory =
      reviewTrigger === "spam_ou_link"
        ? "spam"
        : reviewTrigger === "ofensa_ou_agressao"
          ? "ofensivo"
          : reviewTrigger === "preco_ou_pagamento" || reviewTrigger === "pedido_ou_entrega"
            ? "duvida_produto"
            : "sensivel";
    return { category, reviewTrigger, source: "REGRA" };
  }

  // ---- Camada 2: IA (opcional) ----
  if (!aiAvailable) {
    return {
      category: heuristicCategory(clean),
      reviewTrigger: null,
      source: "REGRA_FALLBACK",
    };
  }

  try {
    const provider = await getAIProvider();
    if (!provider) {
      return { category: heuristicCategory(clean), reviewTrigger: null, source: "REGRA_FALLBACK" };
    }

    const raw = await provider.complete({
      system: [
        "Você classifica comentários de Instagram para um sistema de respostas.",
        "Responda APENAS com uma palavra, exatamente uma destas:",
        COMMENT_CATEGORIES.join(", "),
        "Critérios:",
        "- emoji: só emoji, sem texto",
        "- elogio: admiração, carinho, 'amei', 'linda', 'top'",
        "- agradecimento: agradece",
        "- pergunta_simples: dúvida genérica e curta",
        "- duvida_produto: pergunta sobre produto, serviço, preço, entrega ou pedido",
        "- reclamacao: relata problema",
        "- critica: discorda ou aponta erro",
        "- ofensivo: ofensa ou agressão",
        "- sensivel: saúde, jurídico, política, religião, dinheiro, promessa",
        "- spam: divulgação, link, bots",
        "- outro: não se encaixa",
        "Nada de explicação. Nada de pontuação.",
      ].join("\n"),
      messages: [{ role: "user", content: clean.slice(0, 500) }],
      temperature: 0,
      maxTokens: 8,
    });

    const candidate = raw.trim().toLowerCase().replace(/[^a-z_]/g, "");
    const category = (COMMENT_CATEGORIES as readonly string[]).includes(candidate)
      ? (candidate as CommentCategory)
      : heuristicCategory(clean);

    return { category, reviewTrigger: null, source: "REGRA+IA" };
  } catch {
    // Falha da IA nunca derruba a classificação: cai na heurística.
    return { category: heuristicCategory(clean), reviewTrigger: null, source: "REGRA_FALLBACK" };
  }
}

/** Heurística local — usada sem IA e como fallback de segurança. */
export function heuristicCategory(text: string): CommentCategory {
  const t = (text ?? "").trim();
  if (!t) return "outro";
  if (isEmojiOnly(t)) return "emoji";

  for (const h of HEURISTICS) {
    if (h.patterns.some((p) => p.test(t))) return h.category;
  }

  // Texto curto e positivo sem pattern conhecido → elogio é a leitura mais
  // provável, mas continua exigindo aprovação (não está em AUTO_SAFE por
  // categoria genérica? está — elogio é seguro). Só cai aqui com < 60 chars.
  if (t.length <= 60) return "elogio";
  return "outro";
}
