/**
 * ORIENTAÇÃO POR PILAR DO SCORE — módulo PURO (sem banco, sem React)
 * ==================================================================
 * Cada pilar do Score Inteligente (Engajamento, Crescimento, Alcance e
 * Consistência) recebe, além da nota, uma FAIXA e uma RECOMENDAÇÃO.
 *
 * Regras de honestidade (as mesmas do resto do Score):
 * - A faixa só existe quando o pilar tem dado REAL. Sem dado → "indisponivel"
 *   e a recomendação é a de coletar o dado, nunca um conselho disfarçado de
 *   diagnóstico.
 * - A recomendação é derivada (a) do NOME do pilar, (b) da FAIXA medida e
 *   (c) do VALOR real. Ela descreve o que fazer — nunca afirma um número que
 *   não foi medido nem promete resultado.
 * - Pilar complementar (Frequência/Desempenho) não tem peso na fórmula; a
 *   orientação dele também não sugere mexer no Score Geral.
 *
 * Módulo puro de propósito: é a parte que a UI apenas renderiza, e por isso
 * pode ser provada por teste sem subir o app.
 */

/** Faixas de leitura de um pilar. Alinhadas aos cortes já usados na UI. */
export type PillarBand = "bom" | "desenvolvimento" | "atencao" | "indisponivel";

export interface PillarGuidance {
  band: PillarBand;
  /** Rótulo curto de status exibido ao lado da nota. */
  statusLabel: string;
  /** Frase de orientação ancorada no dado real. */
  recommendation: string;
}

/**
 * Cortes oficiais das faixas:
 *   >= 70  → bom
 *   >= 36  → em desenvolvimento
 *   <= 35  → atenção
 * A nota 0 é um valor MEDIDO (péssimo), não ausência — por isso cai em
 * "atenção" e não em "indisponivel".
 */
export function pillarBand(value: number | null, available: boolean): PillarBand {
  if (!available || value == null || !Number.isFinite(value)) return "indisponivel";
  if (value >= 70) return "bom";
  if (value <= 35) return "atencao";
  return "desenvolvimento";
}

export const PILLAR_BAND_LABEL: Record<PillarBand, string> = {
  bom: "Bom",
  desenvolvimento: "Em desenvolvimento",
  atencao: "Atenção",
  indisponivel: "Dados insuficientes",
};

/** Fórmula legível do peso do pilar (só os oficiais têm peso). */
export function pillarWeightLabel(weight: number, complementary: boolean): string | null {
  if (complementary || weight <= 0) return null;
  return `Peso ${weight}% no Score Geral`;
}

/**
 * Recomendações por pilar e faixa.
 *
 * Cada linha é uma AÇÃO, não um diagnóstico. O texto do pilar "bom" reconhece
 * o resultado e diz o que o sustenta; o de "atenção" aponta o movimento mais
 * direto para subir. Nenhuma frase cita número que não tenha sido medido.
 */
const RECOMMENDATIONS: Record<string, Record<Exclude<PillarBand, "indisponivel">, string>> = {
  engagement: {
    bom: "Seu engajamento está saudável. Mantenha o padrão: responda os comentários das últimas publicações e repita o formato que gerou mais interação.",
    desenvolvimento: "Reforce a chamada para ação no fim das publicações. Uma pergunta direta costuma converter mais comentário do que um pedido genérico de opinião.",
    atencao:
      "Priorize interação antes de volume: responda os comentários pendentes e ajuste a legenda para abrir uma conversa. Engajamento baixo com alcance normal costuma ser tema de conteúdo, não de frequência.",
  },
  growth: {
    bom: "Seu crescimento está consistente. Preserve a frequência que produziu esse resultado e observe quais publicações trouxeram seguidores.",
    desenvolvimento: "Defina uma frequência mínima semanal e cumpra por 4 semanas. Comparação de período só é confiável com histórico regular.",
    atencao:
      "Foque em atrair público novo: publique conteúdo que resolva um problema específico do seu nicho e use o perfil para deixar claro para quem você fala.",
  },
  reach: {
    bom: "Seu alcance está bom. Continue apostando no formato e no horário que mais entregaram visualização.",
    desenvolvimento: "Teste variações do seu melhor conteúdo recente. Alcance responde mais a formato do que a quantidade.",
    atencao:
      "Revise a abertura das publicações: os primeiros segundos decidem se o alcance se expande. Evite legenda longa antes do ponto principal.",
  },
  consistency: {
    bom: "Sua consistência está firme. Ela é o que dá confiabilidade às comparações de período — mantenha o ritmo.",
    desenvolvimento: "Programe as publicações da semana de uma vez. Consistência se sustenta em planejamento, não em disposição do dia.",
    atencao:
      "O histórico de sincronizações ainda é curto para medir regularidade. Sincronize os dados com frequência para que a comparação de períodos fique confiável.",
  },
  frequency: {
    bom: "Seu volume de publicações está adequado. O próximo ganho vem de qualidade, não de publicar mais.",
    desenvolvimento: "Ajuste o volume para o que você consegue sustentar por mês. Publicar de forma irregular custa mais do que publicar menos e sempre.",
    atencao: "Retome uma cadência mínima e estável. Frequência muito baixa derruba os outros indicadores em sequência.",
  },
  content: {
    bom: "O desempenho das suas publicações está bom. Identifique o que as melhores têm em comum e transforme isso em formato padrão.",
    desenvolvimento: "Compare as suas publicações com melhor e pior desempenho e repita o padrão das primeiras.",
    atencao:
      "Analise as publicações com pior desempenho: normalmente o problema está no tema ou na abertura, não no esforço de produção.",
  },
};

/** Texto usado quando não há dado suficiente para o pilar. */
const UNAVAILABLE_BY_PILLAR: Record<string, string> = {
  engagement:
    "Sincronize a rede para que curtidas, comentários e compartilhamentos sejam medidos. Sem esse dado não há como orientar o engajamento.",
  growth:
    "A comparação de período precisa de pelo menos duas leituras de seguidores. Sincronize agora e novamente em alguns dias.",
  reach:
    "O alcance vem dos insights da Meta. Reconecte a conta se ele continuar indisponível após sincronizar.",
  consistency:
    "A consistência depende do histórico de sincronizações. Continue sincronizando para formar a série.",
  frequency:
    "A frequência é medida pelas publicações sincronizadas. Sincronize para que suas publicações sejam contadas.",
  content:
    "O desempenho comparativo exige duas leituras de métricas. Sincronize novamente em alguns dias.",
};

const UNAVAILABLE_FALLBACK =
  "Ainda não há dado suficiente para orientar este indicador. Sincronize sua conta para formá-lo.";

/**
 * Monta a orientação de um pilar a partir do dado REAL.
 *
 * @param key          chave do pilar (engagement/growth/reach/consistency/...)
 * @param value        nota medida (null = sem dado)
 * @param available    o motor sinalizou o pilar como disponível
 * @param complementary pilar fora da fórmula do Score Geral
 */
export function pillarGuidance(
  key: string,
  value: number | null,
  available: boolean,
  complementary = false
): PillarGuidance {
  const band = pillarBand(value, available);

  if (band === "indisponivel") {
    return {
      band,
      statusLabel: PILLAR_BAND_LABEL.indisponivel,
      recommendation: UNAVAILABLE_BY_PILLAR[key] ?? UNAVAILABLE_FALLBACK,
    };
  }

  const table = RECOMMENDATIONS[key];
  const recommendation =
    table?.[band] ??
    (complementary
      ? UNAVAILABLE_FALLBACK
      : `Continue acompanhando este indicador e repetindo o que funcionou nas suas últimas publicações.`);

  return {
    band,
    statusLabel: PILLAR_BAND_LABEL[band],
    recommendation,
  };
}

/**
 * Quais pilares devem ser renderizados em destaque.
 * Ordem de exibição: os 4 oficiais (Engajamento, Crescimento, Alcance,
 * Consistência) nesta ordem, e só depois os complementares.
 */
export const OFFICIAL_PILLAR_ORDER = ["engagement", "growth", "reach", "consistency"] as const;

export function sortPillarsForDisplay<T extends { key: string; complementary?: boolean }>(
  pillars: T[]
): T[] {
  const rank = (p: T): number => {
    const i = OFFICIAL_PILLAR_ORDER.indexOf(p.key as (typeof OFFICIAL_PILLAR_ORDER)[number]);
    if (i >= 0) return i;
    return OFFICIAL_PILLAR_ORDER.length + (p.complementary ? 1 : 0);
  };
  // Cópia: nunca reordenar o array do servidor no lugar.
  return [...pillars].sort((a, b) => rank(a) - rank(b));
}
