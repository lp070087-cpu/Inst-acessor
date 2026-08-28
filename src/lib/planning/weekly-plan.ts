import { getAIProvider } from "@/lib/ai";
import { buildKnowledgeContext, knowledgeContextToPrompt } from "@/lib/knowledge/context-builder";
import { buildUserContext, contextToPrompt } from "@/lib/ai/context";
import { listGoals } from "@/lib/gamification";
import { listPlannedContent } from "@/lib/planning/content";
import { getAIProfile } from "@/lib/ai/services/profile";

/**
 * PLANO SEMANAL ASSISTIDO — Fase 6
 * =================================
 * Plano personalizado (nunca templates genéricos) montado com:
 *   A. DADOS REAIS do perfil (nicho, objetivo, conexões, snapshots)
 *   B. APRENDIZADO DO PERFIL (AIProfile — padrões observados)
 *   C. CONHECIMENTO OFICIAL aplicável (Knowledge Engine)
 *   D. EXPERIMENTOS ATIVOS
 *   E. METAS ATIVAS (Fase 5)
 *   F. CONTEÚDO JÁ PLANEJADO (para preencher lacunas, sem duplicar)
 *
 * Se não houver dados suficientes → retorna DADO INSUFICIENTE.
 * NUNCA inventa frequência, horários ou "melhores momentos".
 */

export interface WeeklyPlanSuggestion {
  /** Racional completo em texto (para a IA/painel). */
  rationale: string;
  /** Sugestões de conteúdo (a DONA decide; nada é criado automaticamente). */
  suggestions: {
    title: string;
    platform: string;
    format: string;
    objective: string;
    /** Por que esta sugestão (baseada em dado real/conhecimento). */
    basedOn: string;
  }[];
  /** Metas ativas consideradas. */
  goals: { id: string; title: string; category: string }[];
  /** Experimentos ativos considerados. */
  experiments: { id: string; hypothesis: string; status: string }[];
  /** Indicadores de contexto disponível (para a UI mostrar transparência). */
  contextAvailable: {
    profile: boolean;
    aiProfile: boolean;
    instagramConnected: boolean;
    tiktokConnected: boolean;
    hasSnapshots: boolean;
    hasActiveGoals: boolean;
    hasActiveExperiments: boolean;
    hasPlannedContent: boolean;
  };
}

interface GoalRow {
  id: string;
  title: string;
  category: string;
  status: string;
}

interface ExperimentRow {
  id: string;
  hypothesis: string;
  status: string;
}

export async function buildWeeklyPlan(userId: string): Promise<WeeklyPlanSuggestion> {
  const [userContext, aiProfile, knowledge, goals, planned] = await Promise.all([
    buildUserContext(userId),
    getAIProfile(userId),
    buildKnowledgeContext(userId, {
      query: "plano semanal calendário frequência consistência conteúdo formato estratégia",
      platform: "instagram",
    }),
    listGoals(userId),
    listPlannedContent(userId),
  ]);

  const activeGoals = (goals as GoalRow[]).filter((g) => g.status === "ATIVA");
  const activeExperiments = knowledge.experiments.filter(
    (e) => e.status === "RUNNING" || e.status === "ENOUGH_DATA"
  );

  const contextAvailable = {
    profile: userContext.hasProfile && Boolean(userContext.niche),
    aiProfile: Boolean(aiProfile),
    instagramConnected: userContext.instagramConnected,
    tiktokConnected: userContext.tiktokConnected,
    hasSnapshots:
      userContext.instagram.snapshotCount > 0 || userContext.tiktok.snapshotCount > 0,
    hasActiveGoals: activeGoals.length > 0,
    hasActiveExperiments: activeExperiments.length > 0,
    hasPlannedContent: planned.length > 0,
  };

  // DADO INSUFICIENTE: sem perfil/nicho OU sem conexão, não há como personalizar.
  const hasMinimalContext = contextAvailable.profile || contextAvailable.hasSnapshots;
  const suggestions: WeeklyPlanSuggestion["suggestions"] = [];

  if (hasMinimalContext) {
    // Monta sugestões baseadas APENAS no que existe (nicho, objetivo, metas, experimentos).
    const baseObjective =
      userContext.objective && userContext.objective.trim().length > 0
        ? userContext.objective.trim()
        : "crescimento consistente";

    // 1. Preenche lacunas: dias da semana sem conteúdo planejado (semana atual).
    const now = new Date();
    const dow = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
    const plannedThisWeek = planned.filter((c) => {
      if (!c.scheduledAt) return false;
      const d = new Date(c.scheduledAt);
      return d >= weekStart && d <= new Date(weekDays[6]);
    });

    const daysWithContent = new Set(
      plannedThisWeek.map((c) => new Date(c.scheduledAt!).getDay())
    );
    const missingDays = weekDays.filter((d) => !daysWithContent.has(d.getDay()));

    // NUNCA inventa horário — apenas sugere o dia como lacuna a preencher.
    if (missingDays.length > 0) {
      const daysLabel = missingDays
        .map((d) => d.toLocaleDateString("pt-BR", { weekday: "long" }))
        .join(", ");
      suggestions.push({
        title: "Preencher lacunas da semana",
        platform: userContext.instagramConnected ? "instagram" : "tiktok",
        format: "reel",
        objective: baseObjective,
        basedOn: `A semana atual tem ${plannedThisWeek.length} conteúdo(s) planejado(s); há lacunas em: ${daysLabel}. Nenhum horário foi sugerido — defina você mesmo com base no seu público.`,
      });
    }

    // 2. Metas ativas viram direção de conteúdo (sem inventar valor).
    if (activeGoals.length > 0) {
      for (const goal of activeGoals.slice(0, 2)) {
        suggestions.push({
          title: `Conteúdo para a meta “${goal.title}”`,
          platform: userContext.instagramConnected ? "instagram" : "tiktok",
          format: goal.category === "engajamento" ? "carrossel" : "reel",
          objective: goal.category,
          basedOn: `Meta ativa (${goal.category}). O conteúdo deve servir a essa meta — o valor da meta não é inventado aqui.`,
        });
      }
    }

    // 3. Experimentos ativos viram conteúdo a produzir (preparação, sem resultados).
    if (activeExperiments.length > 0) {
      for (const exp of activeExperiments.slice(0, 2)) {
        suggestions.push({
          title: `Conteúdo para o experimento: ${exp.hypothesis}`,
          platform: userContext.instagramConnected ? "instagram" : "tiktok",
          format: "reel",
          objective: "experimento",
          basedOn: `Experimento ativo [${exp.status}]: ${exp.hypothesis}. Este conteúdo serve de preparação para medir o experimento — resultados não são inventados.`,
        });
      }
    }

    // 4. Perfil de inteligência (padrões observados) informa formatos preferidos.
    if (aiProfile?.preferredFormats) {
      const formats = aiProfile.preferredFormats
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      if (formats.length > 0) {
        suggestions.push({
          title: "Manter os formatos que já funcionam",
          platform: userContext.instagramConnected ? "instagram" : "tiktok",
          format: formats[0]?.toLowerCase().startsWith("car")
            ? "carrossel"
            : formats[0]?.toLowerCase().startsWith("sto")
              ? "story"
              : "reel",
          objective: baseObjective,
          basedOn: `Perfil de inteligência indica preferência por: ${formats.join(", ")}.`,
        });
      }
    }
  }

  const rationaleLines: string[] = [];

  rationaleLines.push("--- CONTEXTO REAL DISPONÍVEL ---");
  rationaleLines.push(contextToPrompt(userContext));

  if (aiProfile?.summary || aiProfile?.observedPatterns) {
    rationaleLines.push("");
    rationaleLines.push("--- APRENDIZADO DO PERFIL (AIProfile) ---");
    if (aiProfile.summary) rationaleLines.push(`Resumo: ${aiProfile.summary}`);
    if (aiProfile.observedPatterns)
      rationaleLines.push(`Padrões observados: ${aiProfile.observedPatterns}`);
  }

  rationaleLines.push("");
  rationaleLines.push("--- CONHECIMENTO OFICIAL APLICÁVEL ---");
  rationaleLines.push(knowledgeContextToPrompt({ ...knowledge, relevantRules: knowledge.relevantRules }));

  if (activeGoals.length > 0) {
    rationaleLines.push("");
    rationaleLines.push("--- METAS ATIVAS ---");
    for (const g of activeGoals) rationaleLines.push(`• [${g.category}] ${g.title}`);
  } else {
    rationaleLines.push("");
    rationaleLines.push("--- METAS ATIVAS ---");
    rationaleLines.push("Nenhuma meta ativa (crie metas na página Rank para direcionar o plano).");
  }

  if (activeExperiments.length > 0) {
    rationaleLines.push("");
    rationaleLines.push("--- EXPERIMENTOS ATIVOS ---");
    for (const e of activeExperiments) rationaleLines.push(`• [${e.status}] ${e.hypothesis}`);
  }

  if (!hasMinimalContext) {
    rationaleLines.push("");
    rationaleLines.push("DADO INSUFICIENTE: não há nicho/perfil preenchido nem snapshots sincronizados. Preencha o perfil no onboarding e/ou conecte uma conta para receber um plano personalizado.");
  }

  return {
    rationale: rationaleLines.join("\n"),
    suggestions,
    goals: activeGoals.map((g) => ({ id: g.id, title: g.title, category: g.category })),
    experiments: activeExperiments.map((e) => ({ id: e.id, hypothesis: e.hypothesis, status: e.status })),
    contextAvailable,
  };
}

/**
 * Plano semanal via IA (se configurada). Reusa o contexto real montado acima
 * e NUNCA publica nada. Se a IA não estiver configurada, retorna o plano
 * determinístico com indicação de que a IA está indisponível.
 */
export async function generateWeeklyPlanWithAI(
  userId: string
): Promise<{ plan: WeeklyPlanSuggestion; aiUsed: boolean }> {
  const plan = await buildWeeklyPlan(userId);
  const provider = getAIProvider();

  if (!provider) {
    return { plan, aiUsed: false };
  }

  const system = `Você é o planejador de conteúdo do Inst Acessor. Use APENAS o contexto real abaixo.
NUNCA invente: frequência, horários, melhores momentos, métricas ou resultados.
Se um dado não existir, diga que está indisponível (DADO INSUFICIENTE).
Responda em português, formato de sugestão de plano semanal (títulos + porquê), sem listas genéricas.`;

  try {
    const aiText = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: plan.rationale },
      ],
      system,
      temperature: 0.4,
      maxTokens: 900,
    });
    return {
      plan: {
        ...plan,
        rationale: `Plano gerado por IA:\n\n${aiText}\n\n---\n\nContexto considerado:\n\n${plan.rationale}`,
      },
      aiUsed: true,
    };
  } catch (err) {
    console.error("[weekly-plan] erro na IA", err);
    return {
      plan: {
        ...plan,
        rationale: `${plan.rationale}\n\n(IA indisponível no momento — plano determinístico exibido.)`,
      },
      aiUsed: false,
    };
  }
}
