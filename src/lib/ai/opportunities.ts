import type { DashboardInstagramData } from "@/lib/dashboard/instagram-data";
import type { MediaProductionData } from "@/lib/dashboard/media-production";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getMediaProductionData } from "@/lib/dashboard/media-production";
import { withUsage } from "@/lib/billing/usage/meter";

/**
 * OPORTUNIDADES DETECTADAS PELA IA
 * =================================
 * Seção exibida dentro de "Análise de Desempenho". Duas camadas, no mesmo
 * espírito de `@/lib/dashboard/insights`:
 *
 *   1. `buildOpportunities` — PURO. Cada oportunidade nasce de um número que
 *      EXISTE nos dados reais do PRÓPRIO usuário (sempre escopado por userId
 *      pela camada de leitura). Ausência de dado → a oportunidade não é criada,
 *      jamais preenchida com estimativa. Cada cartão carrega a BASE do que
 *      afirma:
 *        - `DADO_REAL`   → a frase descreve um número medido (ex.: queda real).
 *        - `INFERENCIA`  → a frase parte de um número real, mas a AÇÃO sugerida
 *                          é uma tática — não um resultado medido. Fica marcada
 *                          como inferência para nunca passar por medição.
 *
 *   2. `generateAIOpportunitySummary` — opcional. Usa a IA CENTRAL
 *      (`@/lib/ai` → Admin ou env), nunca uma segunda configuração. Sem IA
 *      configurada ou sem dados → NÃO chama nada e devolve o estado honesto.
 *      Falha da API → estado controlado, nunca um texto inventado de reserva.
 *
 * CATEGORIAS: Reels, Stories, Conteúdo, Perfil, Crescimento, Engajamento.
 * "Anúncios" NÃO é emitida: o schema não possui nenhum modelo de anúncios
 * (campanha, gasto, impressões de anúncio). Sem dado real de anúncio, a
 * categoria simplesmente não aparece — nunca um cartão vazio ou fictício.
 *
 * NENHUM número demonstrativo é criado em nenhum caminho. Nada é persistido:
 * as oportunidades são calculadas sob demanda (sem migration, sem tabela nova).
 */

export type OpportunityCategory =
  | "Reels"
  | "Stories"
  | "Conteúdo"
  | "Perfil"
  | "Crescimento"
  | "Engajamento";

export type OpportunityPriority = "ALTA" | "MÉDIA" | "BAIXA";

/** De onde a afirmação do cartão vem. Nunca apresentar INFERENCIA como medição. */
export type OpportunityBasis = "DADO_REAL" | "INFERENCIA";

export interface OpportunityAction {
  label: string;
  /** Rota REAL e existente do app — nunca um botão morto. */
  href: string;
}

export interface Opportunity {
  /** Estável, para keys de lista e telemetria. */
  id: string;
  title: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  basis: OpportunityBasis;
  /** O que os dados REAIS mostram. */
  diagnosis: string;
  /** "Dados utilizados" — os números reais que sustentam o diagnóstico. */
  evidence: string[];
  /** O que fazer — sempre uma ação concreta. */
  recommendation: string;
  action: OpportunityAction;
  /** 0..1 — reduz quando falta profundidade de histórico. */
  confidence: number;
}

export interface OpportunityInput {
  instagram: DashboardInstagramData;
  media: MediaProductionData;
}

/** Pacote pronto para a UI (Server → Client). */
export interface OpportunitiesData {
  opportunities: Opportunity[];
  connected: boolean;
  snapshotCount: number;
  /**
   * `true` quando não há histórico suficiente (menos de 2 sincronizações) para
   * afirmar tendências. As oportunidades que dependem de tendência não são
   * criadas e a UI explica o porquê.
   */
  insufficientData: boolean;
  /** Texto honesto sobre o que NÃO é exibido por falta de coleta real. */
  omittedNote: string | null;
}

const PRIORITY_ORDER: Record<OpportunityPriority, number> = {
  ALTA: 0,
  MÉDIA: 1,
  BAIXA: 2,
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** Achata as oportunidades por prioridade. Estável e determinístico. */
function sortOpportunities(list: Opportunity[]): Opportunity[] {
  return [...list].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return p !== 0 ? p : b.confidence - a.confidence;
  });
}

function daysBetween(a: string, b: string): number {
  return Math.max(
    1,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5)
  );
}

/**
 * Motor determinístico. Puro — sem rede, sem banco. Recebe apenas os dados do
 * PRÓPRIO usuário (o escopo por userId vive na camada de leitura, abaixo).
 */
export function buildOpportunities({ instagram, media }: OpportunityInput): Opportunity[] {
  const out: Opportunity[] = [];
  const d = instagram;

  // Confiança base: sobe com profundidade de histórico e conexão real.
  const baseConfidence = Math.min(
    1,
    0.5 + (d.snapshotCount >= 2 ? 0.25 : 0) + (d.connected ? 0.15 : 0) + (d.snapshotCount >= 5 ? 0.1 : 0)
  );

  // ----------------------------------------------------------------
  // PERFIL — conexão e visitação (dados de estado/perfil, sempre reais)
  // ----------------------------------------------------------------
  if (!d.connected) {
    out.push({
      id: "perfil_conectar",
      title: "Conectar seu Instagram para liberar as oportunidades",
      category: "Perfil",
      priority: "ALTA",
      basis: "DADO_REAL",
      diagnosis: "Nenhuma conta do Instagram está conectada, então não há métricas para analisar.",
      evidence: ["Conta do Instagram: não conectada"],
      recommendation:
        "Conecte a conta em Redes Sociais e sincronize. Sem integração, nenhuma análise é possível — e nada é estimado.",
      action: { label: "Conectar Instagram", href: "/redes-sociais" },
      confidence: 1,
    });
  } else {
    const pv = d.cards.profileViews;
    if (pv.available && pv.changePercent != null && pv.changePercent < 0 && d.snapshotCount >= 2) {
      out.push({
        id: "perfil_visitas_queda",
        title: "Reativar as visitas ao seu perfil",
        category: "Perfil",
        priority: "MÉDIA",
        basis: "DADO_REAL",
        diagnosis: `As visitas ao perfil caíram ${formatPct(pv.changePercent)} frente à coleta anterior.`,
        evidence: [
          `Visitas ao perfil (última coleta): ${formatNumber(pv.value!)}`,
          `Variação: ${formatPct(pv.changePercent)}`,
        ],
        recommendation:
          "Revise bio, foto e o destaque mais recente: o que leva alguém do conteúdo até o perfil precisa deixar claro o próximo passo.",
        action: { label: "Ajustar perfil", href: "/perfil" },
        confidence: baseConfidence,
      });
    }
  }

  // ----------------------------------------------------------------
  // CRESCIMENTO — saldo real de seguidores em 7 dias
  // ----------------------------------------------------------------
  const weekly = d.comparison.weeklyGrowth;
  const gained7d = d.comparison.followersGained7d;
  if (weekly != null && gained7d != null && d.snapshotCount >= 2) {
    if (gained7d < 0) {
      out.push({
        id: "crescimento_queda",
        title: "Recuperar o ritmo de crescimento de seguidores",
        category: "Crescimento",
        priority: weekly <= -1 ? "ALTA" : "MÉDIA",
        basis: "DADO_REAL",
        diagnosis: `Você perdeu ${formatNumber(Math.abs(gained7d))} seguidores (saldo) na última semana — ${formatPct(weekly)}.`,
        evidence: [
          `Saldo líquido de 7 dias: ${formatNumber(gained7d)} seguidores`,
          `Variação semanal: ${formatPct(weekly)}`,
          d.followersCount != null ? `Seguidores atuais: ${formatNumber(d.followersCount)}` : "Seguidores atuais: não coletado",
        ],
        recommendation:
          "Compare o que foi publicado na semana que caiu com as semanas de alta e retome o padrão que funcionou, sem pausar a frequência.",
        action: { label: "Abrir plano de crescimento", href: "/growth" },
        confidence: baseConfidence,
      });
    } else if (gained7d > 0) {
      out.push({
        id: "crescimento_alta",
        title: "Capitalizar o crescimento da semana",
        category: "Crescimento",
        priority: "MÉDIA",
        basis: "DADO_REAL",
        diagnosis: `Você ganhou ${formatNumber(gained7d)} seguidores (saldo) na última semana — ${formatPct(weekly)}.`,
        evidence: [
          `Saldo líquido de 7 dias: ${formatNumber(gained7d)} seguidores`,
          `Variação semanal: ${formatPct(weekly)}`,
        ],
        recommendation:
          "Identifique o conteúdo da semana que mais puxou seguidores e repita o formato enquanto a curva está favorável.",
        action: { label: "Ver plano de crescimento", href: "/growth" },
        confidence: baseConfidence,
      });
    }
  }

  // ----------------------------------------------------------------
  // ENGAJAMENTO — variação real e comentários não aproveitados
  // ----------------------------------------------------------------
  const eng = d.cards.engagement;
  if (eng.available && eng.changePercent != null && eng.changePercent < 0 && d.snapshotCount >= 2) {
    out.push({
      id: "engajamento_queda",
      title: "Reaver o engajamento em queda",
      category: "Engajamento",
      priority: "ALTA",
      basis: "DADO_REAL",
      diagnosis: `O engajamento da última coleta caiu ${formatPct(eng.changePercent)} frente à anterior.`,
      evidence: [
        `Engajamento (última coleta): ${formatNumber(eng.value!)}`,
        `Variação: ${formatPct(eng.changePercent)}`,
      ],
      recommendation:
        "Publique formatos que geram comentário (pergunta direta, enquete no texto) e puxe as ideias já salvas que abordam dores reais do seu nicho.",
      action: { label: "Gerar ideias", href: "/ideias" },
      confidence: baseConfidence,
    });
  }

  const repliesAnalyzed = media.production.find((i) => i.key === "repliesAnalyzed");
  if (
    repliesAnalyzed?.value === 0 &&
    media.totalInteractions != null &&
    media.totalInteractions > 0
  ) {
    out.push({
      id: "engajamento_comentarios",
      title: "Aproveitar os comentários para ampliar o alcance",
      category: "Engajamento",
      priority: "MÉDIA",
      basis: "DADO_REAL",
      diagnosis:
        "Suas publicações coletadas já somam interações, mas nenhuma resposta a comentários foi processada — responder mantém a conversa viva no post.",
      evidence: [
        `Interações coletadas (curtidas + comentários): ${formatNumber(media.totalInteractions)}`,
        `Respostas analisadas: 0`,
      ],
      recommendation:
        "Analise e responda os comentários pendentes: cada resposta reabre a publicação para novas interações.",
      action: { label: "Abrir respostas inteligentes", href: "/respostas-inteligentes" },
      confidence: 0.9,
    });
  }

  // ----------------------------------------------------------------
  // CONTEÚDO — frequência real (delta de publicações do perfil) e agenda vazia
  // ----------------------------------------------------------------
  const evo = d.evolution["30d"];
  if (evo.length >= 2) {
    const first = evo[0];
    const last = evo[evo.length - 1];
    if (typeof first.mediaCount === "number" && typeof last.mediaCount === "number") {
      const delta = last.mediaCount - first.mediaCount;
      const days = daysBetween(first.capturedAt, last.capturedAt);
      if (delta <= 0 && days >= 14) {
        out.push({
          id: "conteudo_frequencia",
          title: "Retomar a frequência de publicações",
          category: "Conteúdo",
          priority: "ALTA",
          basis: "DADO_REAL",
          diagnosis: `Entre ${first.label} e ${last.label} (${days} dias) o total de publicações no perfil não aumentou.`,
          evidence: [
            `Publicações em ${first.label}: ${formatNumber(first.mediaCount)}`,
            `Publicações em ${last.label}: ${formatNumber(last.mediaCount)}`,
            `Janela observada: ${days} dias`,
          ],
          recommendation:
            "Defina dias fixos e agende conteúdo para os próximos 7 dias — consistência é o que reativa a distribuição.",
          action: { label: "Abrir calendário", href: "/calendario" },
          confidence: baseConfidence,
        });
      }
    }
  }

  const scheduled = media.production.find((i) => i.key === "scheduled");
  if (d.connected && scheduled?.value === 0) {
    out.push({
      id: "conteudo_sem_agenda",
      title: "Programar os próximos conteúdos",
      category: "Conteúdo",
      priority: "MÉDIA",
      basis: "DADO_REAL",
      diagnosis: "Você não tem nenhum conteúdo agendado no calendário.",
      evidence: ["Conteúdos agendados no Calendário: 0"],
      recommendation:
        "Use as ideias e cópias já salvas para montar a agenda da semana de uma vez.",
      action: { label: "Planejar no calendário", href: "/calendario" },
      confidence: 1,
    });
  }

  // ----------------------------------------------------------------
  // REELS — vídeo real coletado (contagem honesta, sem presumir classificação)
  // ----------------------------------------------------------------
  if (d.connected && media.reels.count === 0) {
    out.push({
      id: "reels_sem_video",
      title: "Publicar conteúdo em vídeo (Reels)",
      category: "Reels",
      priority: "ALTA",
      basis: "DADO_REAL",
      diagnosis:
        "Entre as publicações que a integração coletou, nenhuma é de vídeo — você está fora do formato com maior alcance fora de seguidores.",
      evidence: [
        "Mídias de vídeo coletadas: 0",
        "A integração coletou publicações, mas nenhuma como vídeo",
      ],
      recommendation:
        "Agende ao menos um vídeo curto na semana e acompanhe se ele puxa alcance acima das suas publicações estáticas.",
      action: { label: "Agendar um vídeo", href: "/calendario" },
      confidence: 0.85,
    });
  } else if (media.reels.count != null && media.reels.count > 0 && media.reels.videoViews != null && media.reels.videoViews > 0) {
    out.push({
      id: "reels_com_video",
      title: "Manter o ritmo de vídeos",
      category: "Reels",
      priority: "MÉDIA",
      basis: "DADO_REAL",
      diagnosis: `Suas publicações em vídeo somam ${formatNumber(media.reels.videoViews)} visualizações nas métricas coletadas.`,
      evidence: [
        `Visualizações somadas dos vídeos: ${formatNumber(media.reels.videoViews)}`,
        `Publicações em vídeo coletadas: ${formatNumber(media.reels.count)}`,
        media.reels.reached != null
          ? `Alcance somado dos vídeos: ${formatNumber(media.reels.reached)}`
          : "Alcance dos vídeos: não coletado",
      ],
      recommendation:
        "Mantenha a cadência de vídeos: é o formato que já movimenta visualizações no seu perfil.",
      action: { label: "Agendar próximo vídeo", href: "/calendario" },
      confidence: baseConfidence,
    });
  }

  // ----------------------------------------------------------------
  // STORIES — INFERÊNCIA a partir de queda REAL de alcance.
  // A coleta atual NÃO lê métricas de Stories (ver media-production). Por isso
  // este cartão é marcado como INFERENCIA: a evidência é o alcance real; a ação
  // (usar Stories) é uma tática sugerida, nunca um resultado medido.
  // ----------------------------------------------------------------
  const reach7d = d.cards.reach7d;
  if (
    reach7d.available &&
    reach7d.changePercent != null &&
    reach7d.changePercent < 0 &&
    d.snapshotCount >= 2
  ) {
    out.push({
      id: "stories_alcance",
      title: "Usar Stories para recuperar alcance",
      category: "Stories",
      priority: "MÉDIA",
      basis: "INFERENCIA",
      diagnosis: `O alcance somado dos últimos 7 dias caiu ${formatPct(reach7d.changePercent)} frente à semana anterior.`,
      evidence: [
        `Alcance somado de 7 dias (soma real): ${formatNumber(reach7d.value!)}`,
        `Variação: ${formatPct(reach7d.changePercent)}`,
        "Observação: a integração atual não lê métricas de Stories — a sugestão é tática, não medida.",
      ],
      recommendation:
        "Stories são uma via de baixo custo para reaparecer para quem já te segue. Sugestão tática com base na queda real de alcance — não há medição de Stories para confirmar o efeito.",
      action: { label: "Planejar Stories", href: "/calendario" },
      confidence: Math.min(baseConfidence, 0.8),
    });
  }

  return sortOpportunities(out);
}

/**
 * Camada de leitura — SEMPRE escopada por `userId`. Reaproveita os loaders
 * reais da Dashboard (nunca chama a API da Meta aqui). Nada é inventado.
 */
export async function getOpportunities(userId: string): Promise<OpportunitiesData> {
  const [instagram, media] = await Promise.all([
    getDashboardInstagramData(userId),
    getMediaProductionData(userId),
  ]);

  const opportunities = buildOpportunities({ instagram, media });

  // Sem dado algum → a UI explica honestamente, em vez de mostrar cartões vazios.
  const insufficientData = instagram.snapshotCount < 2;

  // O que NUNCA é exibido por falta de coleta real (não esconde na UI).
  const omitted: string[] = [];
  if (!media.stories.collected) omitted.push("métricas de Stories (não coletadas pela integração)");
  // Anúncios: não existe nenhum modelo de anúncio no schema → nunca aparecem.
  omitted.push("Anúncios (nenhum dado de anúncios é coletado)");

  return {
    opportunities,
    connected: instagram.connected,
    snapshotCount: instagram.snapshotCount,
    insufficientData,
    omittedNote:
      omitted.length > 0
        ? `Não são exibidas: ${omitted.join("; ")}. Nada é estimado para preencher lacunas.`
        : null,
  };
}

// ============================================================
// ENRIQUECIMENTO OPCIONAL POR IA
// ============================================================

export type AIOpportunityState = "ok" | "not_configured" | "insufficient_data" | "error";

export interface AIOpportunitySummary {
  state: AIOpportunityState;
  summary: string | null;
  message: string | null;
  /** `true` só quando a IA ESTAVA configurada e a chamada falhou. */
  providerFailed: boolean;
}

/** Contexto factual enviado à IA — apenas as oportunidades e evidências REAIS. */
function buildAIContext(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) return "Nenhuma oportunidade foi derivada dos dados atuais.";
  return [
    "Oportunidades já derivadas de dados reais do usuário (não invente nada além disto):",
    ...opportunities.map(
      (o) =>
        `- [${o.category} · ${o.priority}] ${o.title} — ${o.diagnosis} (base: ${o.basis}; evidências: ${o.evidence.join(" | ")})`
    ),
  ].join("\n");
}

/**
 * Priorização em texto via IA CENTRAL. Regras duras (idênticas a `insights.ts`):
 * sem IA → não chama nada; sem dados → não chama nada; falha → estado controlado.
 * NUNCA cria uma recomendação de reserva para parecer que funcionou.
 */
export async function generateAIOpportunitySummary(
  userId: string
): Promise<AIOpportunitySummary> {
  const data = await getOpportunities(userId);

  // Sem oportunidade real (ou sem histórico), a IA não teria o que analisar.
  if (data.opportunities.length === 0 || data.snapshotCount < 1) {
    return {
      state: "insufficient_data",
      summary: null,
      message: "Ainda não há dados reais suficientes para a IA analisar. Sincronize seu perfil.",
      providerFailed: false,
    };
  }

  // A IA central vive em `@/lib/ai` (Admin → env). Import dinâmico para a tela
  // continuar de pé mesmo se a camada de IA estiver indisponível no ambiente.
  let provider: Awaited<ReturnType<typeof import("@/lib/ai").getAIProvider>>;
  try {
    const ai = await import("@/lib/ai");
    provider = await ai.getAIProvider();
  } catch {
    return {
      state: "error",
      summary: null,
      message: "Não foi possível carregar a configuração de IA.",
      providerFailed: true,
    };
  }

  if (!provider) {
    return {
      state: "not_configured",
      summary: null,
      message: "Priorização por IA disponível após a configuração no painel administrativo.",
      providerFailed: false,
    };
  }

  try {
    // MEDIÇÃO: a priorização é uma GERAÇÃO de IA. `withUsage` grava o consumo
    // só se o provider responder; falha dele não consome franquia.
    const metered = await withUsage(
      { userId, feature: "ai_generation", origin: "oportunidades" },
      () =>
        provider.complete({
          system:
            "Você ajuda criadores de conteúdo a decidir por onde começar. Escreva em português do Brasil. " +
            "Use SOMENTE as oportunidades e evidências fornecidas — não invente números, tendências nem resultados. " +
            "Se uma oportunidade estiver marcada como INFERENCIA, trate-a como sugestão, nunca como medição. " +
            "Responda em no máximo 3 frases curtas, sem markdown, sem listas e sem emojis, dizendo por qual " +
            "oportunidade começar e por quê.",
          messages: [
            {
              role: "user",
              content: `${buildAIContext(data.opportunities)}\n\nDiga, em 2 a 3 frases, por qual oportunidade começar e por quê.`,
            },
          ],
          temperature: 0.4,
          maxTokens: 320,
        })
    );
    if (!metered.ok) throw new Error("QUOTA_EXCEDIDA");

    return { state: "ok", summary: metered.value, message: null, providerFailed: false };
  } catch (err) {
    console.error(
      "[opportunities] falha ao gerar priorização por IA",
      err instanceof Error ? err.message.slice(0, 160) : "erro desconhecido"
    );
    return {
      state: "error",
      summary: null,
      message: "A IA não conseguiu responder agora. Tente novamente mais tarde.",
      providerFailed: true,
    };
  }
}
