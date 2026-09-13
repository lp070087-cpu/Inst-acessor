import type { CommentCategory } from "./types";
import { AUTO_SAFE_CATEGORIES, REVIEW_REQUIRED_CATEGORIES } from "./types";

/**
 * FILTROS DE SEGURANÇA — NÚCLEO PURO (sem rede, sem banco)
 * =======================================================
 * Decide se um comentário pode ser respondido AUTOMATICAMENTE (modo AUTO) ou
 * se exige revisão humana. Fail-closed: na dúvida, NUNCA automatiza.
 *
 * Regras de negócio que NUNCA são automatizadas, mesmo com IA disponível:
 * preço, pagamento, pedido, saúde, jurídico, política, agressão, sorteio,
 * promessa e qualquer conteúdo sensível ou complexo.
 *
 * Esta camada é determinística de propósito: um classificador de IA pode
 * errar, então os termos bloqueantes são checados ANTES e independentemente
 * da classificação — se a IA disser "elogio" mas o texto contiver "preço",
 * a resposta vai para revisão.
 */

/**
 * Blocos que forçam revisão humana. Agrupados por motivo para o relatório e
 * para a UI explicar POR QUE aquele comentário não foi automatizado.
 */
const REVIEW_TRIGGERS: { reason: string; patterns: RegExp[] }[] = [
  {
    reason: "preco_ou_pagamento",
    patterns: [
      /\bpre[çc]o\b/i,
      /\bvalor\b/i,
      /\bquanto\s+(custa|c[êe]|sai|fica)\b/i,
      /\bpix\b/i,
      /\bboleto\b/i,
      /\bcart[ãa]o\b/i,
      /\bparcel/i,
      /\bdesconto\b/i,
      /\bpromo[çc][ãa]o\b/i,
      /\bcupom\b/i,
      /\bfrete\b/i,
      /\bpagamento\b/i,
      /\bcobran[çc]a\b/i,
      /\breembolso\b/i,
      /\bestorno\b/i,
      /\bnota\s+fiscal\b/i,
    ],
  },
  {
    reason: "pedido_ou_entrega",
    patterns: [
      /\bpedido\b/i,
      /\bencomenda\b/i,
      /\bentrega\b/i,
      /\brastreio\b/i,
      /\brastreamento\b/i,
      /\bchegou\b/i,
      /\bn[ãa]o\s+recebi\b/i,
      /\batraso\b/i,
      /\bcancelar\b/i,
      /\bcancelamento\b/i,
      /\btroca\b/i,
      /\bdevolu[çc][ãa]o\b/i,
    ],
  },
  {
    reason: "saude",
    patterns: [
      /\bsa[úu]de\b/i,
      /\bm[ée]dic/i,
      /\bdor\b/i,
      /\bdoen[çc]a\b/i,
      /\bdiagn[óo]stic/i,
      /\brem[ée]dio\b/i,
      /\bmedicament/i,
      /\bgravidez\b/i,
      /\bgr[áa]vida\b/i,
      /\btratamento\b/i,
      /\bles[ãa]o\b/i,
      /\bcirurg/i,
    ],
  },
  {
    reason: "juridico",
    patterns: [
      /\badvogad/i,
      /\bprocesso\b/i,
      /\bjur[íi]dic/i,
      /\bprocon\b/i,
      /\bindeni[zs]a/i,
      /\bcontrato\b/i,
      /\bCNPJ\b/i,
      /\bLGPD\b/i,
      /\bdireitos?\b/i,
    ],
  },
  {
    reason: "politica_ou_religiao",
    patterns: [
      /\bpol[íi]tic/i,
      /\belei[çc][ãa]o\b/i,
      /\bpresidente\b/i,
      /\bgoverno\b/i,
      /\bpartido\b/i,
      /\bvoto\b/i,
      /\breligi[ãa]o\b/i,
      /\bigreja\b/i,
      /\bdeus\b/i,
    ],
  },
  {
    reason: "ofensa_ou_agressao",
    patterns: [
      /\b(idiota|imbecil|burr[ao]|ot[áa]ri[oa]|vagabund[ao]|lixo|porcaria|merda|bosta|bicho)\b/i,
      /\b(vai\s+se|v[aá]\s+tomar|cala\s+a\s+boca|otario)\b/i,
      /\b(horr[íi]vel|p[ée]ssim[ao]|nojento|rid[íi]cul[oa])\b/i,
      /[�]{1,}/,
    ],
  },
  {
    reason: "sorteio_ou_promessa",
    patterns: [
      /\bsorteio\b/i,
      /\bsortear\b/i,
      /\bconcorr/i,
      /\bganh(ar|ei|ador)\b/i,
      /\bbrinde\b/i,
      /\bpremi[oa]\b/i,
      /\bgarantia\s+de\s+resultado\b/i,
      /\bpromet/i,
      /\bcura\b/i,
      /\bmilagre\b/i,
    ],
  },
  {
    reason: "spam_ou_link",
    patterns: [
      /https?:\/\//i,
      /\bwww\./i,
      /\bclique\s+aqui\b/i,
      /\blink\s+na\s+bio\b/i,
      /\bganhe\s+seguidores\b/i,
      /\bcompre\s+seguidores\b/i,
      /@[a-z0-9._]{3,}\s+@[a-z0-9._]{3,}\s+@[a-z0-9._]{3,}/i,
      /\b\d{2,3}\s?%\s?(off|desconto)\b/i,
      /\btelegram\b/i,
      /\bwhatsapp\s*[:\-]?\s*\(?\d{2}\)?\s?9?\d{4}/i,
    ],
  },
];

/** Motivo do bloqueio automático, ou null quando nada foi detectado. */
export function detectReviewTrigger(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  for (const group of REVIEW_TRIGGERS) {
    for (const pattern of group.patterns) {
      if (pattern.test(t)) return group.reason;
    }
  }
  return null;
}

export interface AutoSendDecision {
  allowed: boolean;
  /** Motivo legível quando `allowed === false`. */
  reason?: string;
}

/**
 * Decide se o comentário pode ser respondido sem intervenção humana.
 *
 * @param category  classificação do comentário
 * @param text      texto original (checado independentemente da categoria)
 * @param mode      modo configurado pelo usuário
 * @param enabled   automação ativa?
 * @param paused    pausa global acionada?
 */
export function canAutoSend(input: {
  category: CommentCategory;
  text: string;
  mode: string;
  enabled: boolean;
  paused: boolean;
}): AutoSendDecision {
  if (input.paused) {
    return { allowed: false, reason: "Respostas Inteligentes estão pausadas." };
  }
  if (!input.enabled) {
    return { allowed: false, reason: "A automação está desativada." };
  }
  if (input.mode !== "AUTO") {
    return { allowed: false, reason: "O modo configurado exige aprovação humana." };
  }

  // 1) Termos bloqueantes vencem QUALQUER classificação — inclusive se a IA
  //    afirmou que é elogio. Determinístico e fail-closed.
  const trigger = detectReviewTrigger(input.text);
  if (trigger) {
    return {
      allowed: false,
      reason: `Conteúdo que exige revisão (${trigger}).`,
    };
  }

  // 2) Categorias explicitamente sensíveis nunca automatizam.
  if (REVIEW_REQUIRED_CATEGORIES.includes(input.category)) {
    return {
      allowed: false,
      reason: `Categoria "${input.category}" exige revisão humana.`,
    };
  }

  // 3) Só as categorias seguras são elegíveis.
  if (!AUTO_SAFE_CATEGORIES.includes(input.category)) {
    return {
      allowed: false,
      reason: `Categoria "${input.category}" não está autorizada para envio automático.`,
    };
  }

  return { allowed: true };
}

/** Explicação legível de por que um comentário caiu em revisão (para a UI). */
export const REVIEW_REASON_LABEL: Record<string, string> = {
  preco_ou_pagamento: "Envolve preço, pagamento ou cobrança",
  pedido_ou_entrega: "Envolve pedido, entrega ou troca",
  saude: "Envolve saúde",
  juridico: "Envolve questão jurídica",
  politica_ou_religiao: "Envolve política ou religião",
  ofensa_ou_agressao: "Contém ofensa ou agressão",
  sorteio_ou_promessa: "Envolve sorteio ou promessa",
  spam_ou_link: "Parece spam ou contém link",
};
