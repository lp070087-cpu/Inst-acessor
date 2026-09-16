import { getDashboardInstagramData } from "./instagram-data";
import type { MediaProductionData } from "./media-production";

/**
 * INSIGHTS RÁPIDOS DO DASHBOARD
 * ==============================
 * Duas camadas, deliberadamente separadas:
 *
 *   1. `buildDeterministicInsights` — PURO. Traduz em frase o que os dados
 *      REAIS mostram (crescimento, alcance, publicações, engajamento). Não
 *      inventa nada: cada insight só nasce de um número que existe, e traz o
 *      valor que o sustenta. Funciona SEM IA configurada.
 *
 *   2. `generateAIInsights` — opcional. Usa EXATAMENTE a IA central do Admin
 *      (`resolveRuntimeAI`), nunca uma segunda configuração. Regras duras:
 *        - sem IA configurada → não chama nada, devolve estado "sem IA";
 *        - sem dados suficientes → não chama nada, devolve estado "sem dados";
 *        - falha da API → devolve o erro de forma controlada (nunca inventa
 *          um insight de reserva para parecer que funcionou).
 *
 * NENHUM número demonstrativo é criado em nenhum dos caminhos.
 */

export interface DeterministicInsight {
  key: string;
  /** Frase curta, pronta para exibir. */
  text: string;
  /** Valor real que sustenta a frase (auditável pelo usuário). */
  evidence: string;
  tone: "positive" | "attention" | "neutral";
}

export type AIInsightState = "ok" | "not_configured" | "insufficient_data" | "error";

export interface AIInsightsResult {
  state: AIInsightState;
  /** Texto devolvido pela IA (só quando `state === "ok"`). */
  insights: string | null;
  /** Mensagem discreta para a UI explicar o estado. */
  message: string | null;
  /**
   * `true` somente quando a IA ESTAVA configurada e a chamada falhou.
   * Permite a rota responder 502 (falha real) sem depender de comparar texto
   * de mensagem — "sem IA" e "sem dados" não são erro de servidor.
   */
  providerFailed: boolean;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/**
 * Insights derivados APENAS de dados persistidos. Puro — sem rede, sem banco.
 * A ordem das frases segue a prioridade das métricas (crescimento primeiro).
 */
export function buildDeterministicInsights(
  data: Awaited<ReturnType<typeof getDashboardInstagramData>>,
  media: MediaProductionData
): DeterministicInsight[] {
  const out: DeterministicInsight[] = [];

  // 1) Crescimento semanal de seguidores (só com base real de 7 dias atrás).
  const weekly = data.comparison.weeklyGrowth;
  const gained7d = data.comparison.followersGained7d;
  if (weekly != null && gained7d != null) {
    out.push({
      key: "weekly_growth",
      text:
        gained7d >= 0
          ? `Seus seguidores cresceram ${formatPct(weekly)} na última semana.`
          : `Seus seguidores recuaram ${formatPct(weekly)} na última semana.`,
      evidence:
        gained7d >= 0
          ? `${formatNumber(gained7d)} seguidores ganhos em 7 dias`
          : `${formatNumber(Math.abs(gained7d))} seguidores perdidos em 7 dias`,
      tone: gained7d >= 0 ? "positive" : "attention",
    });
  }

  // 2) Alcance de 7 dias, sempre com o número de dias reais que o compõem.
  if (data.cards.reach7d.available && data.reach7dDays > 0) {
    out.push({
      key: "reach_7d",
      text: `Seu conteúdo alcançou ${formatNumber(data.cards.reach7d.value!)} pessoas nos últimos 7 dias.`,
      evidence: `Soma de ${data.reach7dDays} ${data.reach7dDays === 1 ? "registro" : "registros"} de alcance`,
      tone: "neutral",
    });
  }

  // 3) Ritmo de publicação (usa o mediaCount real do perfil).
  if (data.cards.media.available) {
    out.push({
      key: "media_count",
      text: `Você tem ${formatNumber(data.cards.media.value!)} publicações no perfil.`,
      evidence: "Contagem informada pela própria API do Instagram",
      tone: "neutral",
    });
  }

  // 4) Engajamento médio real (curtidas + comentários por publicação coletada).
  if (media.avgInteractionsPerMedia != null && media.totalInteractions != null) {
    out.push({
      key: "avg_interactions",
      text: `Suas publicações coletadas somam ${formatNumber(media.totalInteractions)} interações, uma média de ${formatNumber(media.avgInteractionsPerMedia)} por publicação.`,
      evidence: "Curtidas + comentários das publicações lidas na integração",
      tone: "neutral",
    });
  }

  // 5) Vídeos publicados. Só fala em "Reels" quando TODAS as mídias de vídeo
  // têm `media_product_type` — se a classificação é parcial, o texto diz
  // "vídeos", que é o que a contagem realmente prova.
  if (media.reels.count != null && media.reels.count > 0) {
    const classified = media.reels.distinguishesReels && media.reels.reelsCount != null;
    out.push({
      key: "video_media",
      text: classified
        ? `Foram publicados ${formatNumber(media.reels.count)} vídeos até agora, ${formatNumber(media.reels.reelsCount!)} deles como Reels.`
        : `Foram publicados ${formatNumber(media.reels.count)} vídeos até agora.`,
      evidence: classified
        ? "Mídias com tipo VIDEO e media_product_type lidos na integração"
        : "Mídias com tipo VIDEO lidas na integração",
      tone: "neutral",
    });
  }

  // 6) Produção dentro do Inst Acessor.
  const published = media.production.find((i) => i.key === "published");
  if (published?.value != null && published.value > 0) {
    out.push({
      key: "production_published",
      text: `Você já confirmou ${formatNumber(published.value)} publicações por aqui.`,
      evidence: "Conteúdos com publicação confirmada no Calendário",
      tone: "positive",
    });
  }

  return out;
}

/** Monta o contexto factual enviado à IA. Sempre números reais ou "sem dado". */
function buildAIContext(
  data: Awaited<ReturnType<typeof getDashboardInstagramData>>,
  media: MediaProductionData
): string {
  const line = (label: string, value: number | null, suffix = "") =>
    `- ${label}: ${value == null ? "sem dado coletado" : `${formatNumber(value)}${suffix}`}`;

  return [
    "Dados reais do perfil do usuário (não invente nada além disto):",
    line("Seguidores", data.cards.followers.value),
    line("Publicações no perfil", data.cards.media.value),
    line("Alcance acumulado em 7 dias", data.cards.reach7d.value, ` (${data.reach7dDays} registros)`),
    line("Visualizações", data.cards.impressions.value),
    line("Visitas ao perfil", data.cards.profileViews.value),
    line("Vídeos publicados", media.reels.count),
    line("Interações totais (curtidas + comentários)", media.totalInteractions),
    `- Crescimento semanal de seguidores: ${
      data.comparison.weeklyGrowth == null
        ? "sem histórico suficiente"
        : formatPct(data.comparison.weeklyGrowth)
    }`,
    `- Crescimento mensal de seguidores: ${
      data.comparison.monthlyGrowth == null
        ? "sem histórico suficiente"
        : formatPct(data.comparison.monthlyGrowth)
    }`,
    `- Registros de sincronização acumulados: ${data.snapshotCount}`,
  ].join("\n");
}

/**
 * Insights via IA central. NÃO chama a API quando não há chave ativa ou
 * quando não há dado real suficiente para dizer qualquer coisa.
 */
export async function generateAIInsights(
  data: Awaited<ReturnType<typeof getDashboardInstagramData>>,
  media: MediaProductionData
): Promise<AIInsightsResult> {
  // Dados mínimos: sem um único número real, a IA não teria o que analisar.
  const hasRealData =
    data.cards.followers.available ||
    data.cards.reach7d.available ||
    data.snapshotCount >= 2;
  if (!hasRealData) {
    return {
      state: "insufficient_data",
      insights: null,
      message: "Sincronize seu Instagram para liberar os insights da IA.",
      providerFailed: false,
    };
  }

  // A IA central vive em `@/lib/ai` (config do Admin → fallback de env).
  // Import dinâmico para a Dashboard continuar de pé mesmo se a camada de IA
  // estiver indisponível no ambiente.
  let provider: Awaited<ReturnType<typeof import("@/lib/ai").getAIProvider>>;
  try {
    const ai = await import("@/lib/ai");
    provider = await ai.getAIProvider();
  } catch {
    return {
      state: "error",
      insights: null,
      message: "Não foi possível carregar a configuração de IA.",
      providerFailed: true,
    };
  }

  if (!provider) {
    return {
      state: "not_configured",
      insights: null,
      message: "Insights por IA disponíveis após a configuração no painel administrativo.",
      providerFailed: false,
    };
  }

  try {
    const text = await provider.complete({
      system:
        "Você analisa perfis de Instagram profissionais. Escreva em português do Brasil. " +
        "Use SOMENTE os números fornecidos. Se um dado não foi fornecido, não comente sobre ele. " +
        "Nunca estime, projete ou invente valores. Responda em no máximo 3 frases curtas e objetivas, " +
        "sem markdown, sem listas e sem emojis.",
      messages: [
        {
          role: "user",
          content: `${buildAIContext(data, media)}\n\nEscreva de 2 a 3 observações curtas sobre o desempenho deste perfil, sempre citando os números reais acima.`,
        },
      ],
      temperature: 0.4,
      maxTokens: 320,
    });

    return { state: "ok", insights: text, message: null, providerFailed: false };
  } catch (err) {
    // Erro real → estado controlado. NUNCA um insight inventado de reserva.
    console.error(
      "[dashboard-insights] falha ao gerar insights",
      err instanceof Error ? err.message.slice(0, 160) : "erro desconhecido"
    );
    return {
      state: "error",
      insights: null,
      message: "A IA não conseguiu responder agora. Tente novamente mais tarde.",
      providerFailed: true,
    };
  }
}
