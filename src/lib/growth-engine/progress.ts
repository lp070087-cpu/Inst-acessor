import type {
  GrowthActionView,
  GrowthContext,
  GrowthPriority,
  GrowthRecommendation,
  DailyMission,
  DayPlan,
  GrowthPlan7Days,
  GrowthPlan30Days,
} from "./types";

/**
 * PROGRESSO — MISSÃO DO DIA + PLANOS 7/30 DIAS (Fase 8, Partes 8-10)
 * ===================================================================
 * Transforma prioridades/recomendações/ações em:
 *   - Missão do Dia (Parte 8): UMA ação de maior prioridade executável hoje.
 *   - Plano de 7 dias (Parte 9): conteúdo, otimização, comunidade, análise,
 *     experimentos, metas — poucas ações por dia.
 *   - Plano de 30 dias (Parte 10): semana 1 diagnóstico/base, 2 execução,
 *     3 otimização, 4 análise/escala — adaptado ao estágio real.
 *
 * Tudo derivado de dados reais. Sem dados → DADO INSUFICIENTE explícito.
 */

function iso(d: Date): string {
  return d.toISOString();
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// MISSÃO DO DIA (Parte 8)
// ------------------------------------------------------------

/**
 * Escolhe a missão do dia: a ação PENDING de maior prioridade executável
 * hoje. Se não houver ação, usa a primeira recomendação. Se nada, DADO
 * INSUFICIENTE.
 */
export function pickDailyMission(
  ctx: GrowthContext,
  priorities: GrowthPriority[],
  recommendations: GrowthRecommendation[],
  actions: GrowthActionView[]
): DailyMission {
  const today = fmtDate(new Date());

  // Ações pendentes do usuário, ordenadas por prioridade (1 > 2 > 3)
  const pending = actions
    .filter((a) => a.status === "PENDING" || a.status === "IN_PROGRESS")
    .sort((a, b) => a.priority - b.priority);

  if (pending.length > 0) {
    const top = pending[0];
    const rationale = top.reason
      ? `Prioridade ${top.priority}: ${top.reason}`
      : `Prioridade ${top.priority} na sua lista de ações.`;
    return {
      action: top,
      rationale,
      sourceSignal: top.sourceSignal,
      platform: top.platform,
      date: today,
    };
  }

  // Sem ação pendente, usa a primeira recomendação
  if (recommendations.length > 0) {
    const rec = recommendations[0];
    return {
      action: null,
      rationale: `${rec.oQue} — ${rec.porQue}`,
      sourceSignal: rec.signalType,
      platform: rec.platform,
      date: today,
    };
  }

  return {
    action: null,
    rationale: "DADO INSUFICIENTE — conecte e sincronize uma rede social para receber sua missão do dia.",
    sourceSignal: "NO_CONNECTED_ACCOUNT",
    platform: null,
    date: today,
  };
}

// ------------------------------------------------------------
// PLANO DE 7 DIAS (Parte 9)
// ------------------------------------------------------------

function planItem(
  type: DayPlan["items"][number]["type"],
  action: string,
  recommendationSlug: string | null,
  platform: "instagram" | "tiktok" | null
): DayPlan["items"][number] {
  return { type, action, recommendationSlug, platform };
}

/**
 * Plano de 7 dias baseado no contexto real. Foco do dia e itens derivados
 * dos sinais/recomendações. Nunca inventa conteúdo — só planeja ações.
 */
export function buildPlan7Days(
  ctx: GrowthContext,
  priorities: GrowthPriority[],
  recommendations: GrowthRecommendation[]
): GrowthPlan7Days {
  const start = new Date();
  const primaryPlatform = ctx.instagram.connected ? "instagram" : "tiktok";
  const recBySignal = new Map<string, GrowthRecommendation>();
  for (const r of recommendations) recBySignal.set(r.signalType, r);

  const signalSet = new Set(priorities.map((p) => p.signalType));

  const days: DayPlan[] = [
    {
      day: 1,
      date: fmtDate(addDays(start, 0)),
      focus: "Diagnóstico e base",
      items: [
        planItem("analise", "Sincronizar métricas e revisar o diagnóstico", null, primaryPlatform),
        ...(signalSet.has("LOW_POSTING_FREQUENCY") || signalSet.has("INCONSISTENT_POSTING")
          ? [planItem("conteudo", recBySignal.get("LOW_POSTING_FREQUENCY")?.oQue ?? "Definir rotina de postagem semanal", recBySignal.get("LOW_POSTING_FREQUENCY")?.slug ?? null, primaryPlatform)]
          : []),
      ],
    },
    {
      day: 2,
      date: fmtDate(addDays(start, 1)),
      focus: "Conteúdo",
      items: [
        planItem("conteudo", "Selecionar 3 ideias na Central de Ideias e gerar copies", null, primaryPlatform),
        ...(signalSet.has("CONTENT_GAP")
          ? [planItem("conteudo", "Agendar os próximos 7 dias no Calendário", recBySignal.get("CONTENT_GAP")?.slug ?? null, primaryPlatform)]
          : []),
      ],
    },
    {
      day: 3,
      date: fmtDate(addDays(start, 2)),
      focus: "Otimização",
      items: [
        ...(signalSet.has("PROFILE_OPTIMIZATION_NEEDED")
          ? [planItem("otimizacao", "Reescrever bio com objetivo e CTA", recBySignal.get("PROFILE_OPTIMIZATION_NEEDED")?.slug ?? null, primaryPlatform)]
          : [planItem("otimizacao", "Revisar destaques e capa do perfil", null, primaryPlatform)]),
      ],
    },
    {
      day: 4,
      date: fmtDate(addDays(start, 3)),
      focus: "Comunidade",
      items: [
        planItem("comunidade", "Responder comentários e DMs pendentes", null, primaryPlatform),
      ],
    },
    {
      day: 5,
      date: fmtDate(addDays(start, 4)),
      focus: "Conteúdo",
      items: [
        planItem("conteudo", "Produzir o 1º conteúdo da semana com copy aprovada", null, primaryPlatform),
        ...(signalSet.has("HIGH_PERFORMING_CONTENT")
          ? [planItem("conteudo", "Criar variação do conteúdo de alto desempenho", recBySignal.get("HIGH_PERFORMING_CONTENT")?.slug ?? null, primaryPlatform)]
          : []),
      ],
    },
    {
      day: 6,
      date: fmtDate(addDays(start, 5)),
      focus: "Experimentos e metas",
      items: [
        ...(signalSet.has("GOAL_AT_RISK")
          ? [planItem("meta", "Executar ação para destravar meta em risco", recBySignal.get("GOAL_AT_RISK")?.slug ?? null, primaryPlatform)]
          : []),
        ...(signalSet.has("EXPERIMENT_INCONCLUSIVE")
          ? [planItem("experimento", "Replanejar experimento inconclusivo", recBySignal.get("EXPERIMENT_INCONCLUSIVE")?.slug ?? null, primaryPlatform)]
          : [planItem("experimento", "Definir 1 experimento da semana (hipótese + variável)", null, primaryPlatform)]),
      ],
    },
    {
      day: 7,
      date: fmtDate(addDays(start, 6)),
      focus: "Análise",
      items: [
        planItem("analise", "Analisar resultados da semana e calcular Score", null, primaryPlatform),
        planItem("meta", "Atualizar progresso das metas no Rank", null, primaryPlatform),
      ],
    },
  ];

  return {
    days,
    generatedAt: iso(new Date()),
    note: "Plano derivado de dados reais. Sem conexão/sincronização, itens refletem DADO INSUFICIENTE.",
  };
}

// ------------------------------------------------------------
// PLANO DE 30 DIAS (Parte 10)
// ------------------------------------------------------------

/**
 * Plano de 30 dias em 4 semanas. Adaptado ao estágio real:
 *   - sem dados: foco em conexão e primeira sincronização.
 *   - início: base de conteúdo e perfil.
 *   - crescimento: consistência e experimentos.
 *   - escala: análise, otimização e escalar o que funciona.
 */
export function buildPlan30Days(ctx: GrowthContext): GrowthPlan30Days {
  const stage = ctx.stage;
  const platform = ctx.instagram.connected ? "instagram" : "tiktok";

  const weeks: GrowthPlan30Days["weeks"] = [];

  if (!ctx.instagram.connected && !ctx.tiktok.connected) {
    weeks.push(
      { week: 1, theme: "Diagnóstico", focus: "Conexão", items: ["Conectar Instagram ou TikTok", "Sincronizar métricas iniciais", "Definir objetivo no perfil"] },
      { week: 2, theme: "Base", focus: "Perfil e conteúdo", items: ["Otimizar bio e destaques", "Selecionar 5 ideias de conteúdo", "Agendar primeiras 3 publicações"] },
      { week: 3, theme: "Consistência", focus: "Publicação", items: ["Publicar 3 vezes na semana", "Responder comentários", "Revisar primeiras métricas"] },
      { week: 4, theme: "Análise", focus: "Resultados", items: ["Calcular Score", "Analisar o que funcionou", "Ajustar estratégia para o mês seguinte"] }
    );
  } else if (stage === "inicio") {
    weeks.push(
      { week: 1, theme: "Diagnóstico", focus: "Base", items: ["Sincronizar métricas", "Revisar diagnóstico", "Definir metas de 30 dias"] },
      { week: 2, theme: "Execução", focus: "Conteúdo", items: ["Publicar 4-5 conteúdos", "Criar rotina de resposta", "Rodar 1 experimento simples"] },
      { week: 3, theme: "Otimização", focus: "Perfil e formatos", items: ["Ajustar bio com CTA", "Testar 2 formatos diferentes", "Analisar melhores horários"] },
      { week: 4, theme: "Escala", focus: "Resultados", items: ["Calcular Score", "Identificar o que funcionou", "Planejar o próximo mês"] }
    );
  } else {
    weeks.push(
      { week: 1, theme: "Diagnóstico", focus: "Base", items: ["Sincronizar métricas e Score", "Revisar sinais e prioridades", "Atualizar metas"] },
      { week: 2, theme: "Execução", focus: "Consistência", items: ["Manter frequência de 3+/semana", "Escalar conteúdo de alto desempenho", "Responder comunidade"] },
      { week: 3, theme: "Otimização", focus: "Experimentos", items: ["Rodar experimentos com amostra suficiente", "Analisar resultados", "Ajustar formato com base em dados"] },
      { week: 4, theme: "Escala", focus: "Análise", items: ["Analisar crescimento do mês", "Revisar Score e diagnóstico", "Definir próximo ciclo"] }
    );
  }

  return {
    weeks,
    generatedAt: iso(new Date()),
    note: `Plano adaptado ao estágio real ("${stage ?? "sem-dados"}") e aos dados disponíveis. Sem conexão, a base é conectar e sincronizar.`,
  };
}

// ------------------------------------------------------------
// BARREL interno
// ------------------------------------------------------------
export { iso, addDays };
