import { getAIProvider } from "@/lib/ai";
import { buildKnowledgeContext, knowledgeContextToPrompt } from "@/lib/knowledge/context-builder";
import { buildUserContext, contextToPrompt } from "@/lib/ai/context";
import { listGoals } from "@/lib/gamification";
import { listPlannedContent } from "@/lib/planning/content";
import { getAIProfile } from "@/lib/ai/services/profile";
import { withUsage } from "@/lib/billing/usage/meter";
import { loadPlanningMedia } from "@/lib/planning/smart-calendar-db";
import {
  aggregateWeekdays,
  aggregateDayPeriods,
  type MediaInput,
  type WeekdayPattern,
  type DayPeriodAggregate,
} from "@/lib/planning/smart-calendar";

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

/** Uma sugestão de conteúdo do plano (a DONA decide; nada é criado sozinho). */
export interface WeeklyPlanSuggestionItem {
  title: string;
  platform: string;
  format: string;
  objective: string;
  /** Por que esta sugestão (baseada em dado real/conhecimento). */
  basedOn: string;
}

/**
 * Um dia do plano semanal. SEMPRE os sete dias aparecem (Domingo…Sábado).
 * `recommended` só é `true` quando há AMOSTRA real suficiente para afirmar que
 * aquele dia performa melhor — nunca um "melhor dia" de mercado.
 */
export interface WeeklyPlanDay {
  /** 0 = Domingo … 6 = Sábado (getDay()). */
  weekday: number;
  label: string;
  /** Data ISO do dia desta semana (domingo de referência + weekday). */
  dateIso: string;
  /** Tipo de conteúdo sugerido (formato oficial do enum). */
  suggestedFormat: string;
  /** `true` só quando há dado real de desempenho para afirmar o dia. */
  recommended: boolean;
  /** Explicação do "recomendado" (com o número real) ou da ausência de dado. */
  recommendedReason: string;
  /** Frequência medida do histórico (texto honesto; "sem dados" quando não há). */
  frequency: string;
  /** Estado real na semana atual: já tem conteúdo agendado ou está vago. */
  status: "VAGO" | "OCUPADO";
  /** Títulos já agendados neste dia (semana atual). */
  plannedTitles: string[];
  /** Sugestão pronta para virar conteúdo — só quando o dia está vago. */
  suggestion: WeeklyPlanSuggestionItem | null;
  /** De onde a sugestão do dia veio (nunca vazio quando há sugestão). */
  basedOn: string;
}

export interface WeeklyPlanSuggestion {
  /** Racional completo em texto (para a IA/painel). */
  rationale: string;
  /** Sugestões de conteúdo (a DONA decide; nada é criado automaticamente). */
  suggestions: WeeklyPlanSuggestionItem[];
  /** Os sete dias da semana com estado real + recomendação honesta. */
  days: WeeklyPlanDay[];
  /**
   * Dia com melhor desempenho observado (0–6) ou `null` quando não há amostra
   * suficiente para afirmar. NUNCA preenchido por palpite.
   */
  recommendedDay: number | null;
  /** Período do dia recomendado (rótulo) ou `null`. Vem só de dado real. */
  recommendedPeriod: string | null;
  /** Frequência medida do histórico em publicações/semana, ou `null`. */
  measuredFrequencyPerWeek: number | null;
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

/** Os sete dias, indexados por `getDay()` (0 = Domingo). */
const WEEKDAY_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/**
 * Normaliza um formato livre (ex.: vindo do AIProfile) para o enum oficial de
 * `PlannedContent`. Espelha a normalização usada no client do calendário.
 */
function normalizeSuggestedFormat(format: string | undefined): string {
  const f = (format ?? "").toLowerCase().trim();
  if (f.startsWith("car")) return "carrossel";
  if (f.startsWith("sto") || f.startsWith("stor")) return "story";
  if (f.startsWith("post") || f.startsWith("imag")) return "post";
  return "reel";
}

/**
 * Frequência MEDIDA do histórico: publicações coletadas divididas pelas
 * semanas efetivamente cobertas (do primeiro ao último timestamp). Sem nenhuma
 * publicação com data, devolve `null` — nunca zero como se fosse medido.
 */
function measuredFrequency(media: MediaInput[]): number | null {
  const stamps = media
    .map((m) => m.timestamp)
    .filter((t): t is string => Boolean(t))
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (stamps.length === 0) return null;

  const times = stamps.map((d) => d.getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const spanDays = Math.max(1, Math.round((max - min) / 86_400_000));
  const weeks = Math.max(1, spanDays / 7);
  return Math.round((stamps.length / weeks) * 10) / 10;
}

export async function buildWeeklyPlan(userId: string): Promise<WeeklyPlanSuggestion> {
  const [userContext, aiProfile, knowledge, goals, planned, media] = await Promise.all([
    buildUserContext(userId),
    getAIProfile(userId),
    buildKnowledgeContext(userId, {
      query: "plano semanal calendário frequência consistência conteúdo formato estratégia",
      platform: "instagram",
    }),
    listGoals(userId),
    listPlannedContent(userId),
    loadPlanningMedia(userId),
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

  // ---- Contexto temporal da semana atual (real, vale para os 7 cards) ----
  const now = new Date();
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Conteúdo REAL já agendado nesta semana (por dia da semana).
  const titlesByDow = new Map<number, string[]>();
  for (const c of planned) {
    if (!c.scheduledAt) continue;
    const d = new Date(c.scheduledAt);
    if (d < weekStart || d > new Date(weekDays[6].getTime() + 86_400_000 - 1)) continue;
    const arr = titlesByDow.get(d.getDay()) ?? [];
    arr.push(c.title);
    titlesByDow.set(d.getDay(), arr);
  }

  // ---- Padrões OBSERVADOS na mídia coletada (mesma fonte de "melhores dias") ----
  const weekdayPatterns: WeekdayPattern[] = aggregateWeekdays(media);
  const periodAggregates: DayPeriodAggregate[] = aggregateDayPeriods(media);

  // Dia recomendado: só com amostra suficiente E desempenho medido acima de zero
  // em pelo menos um dia. Sem isso → `null` (a UI diz "sem dados suficientes").
  const measuredDays = weekdayPatterns.filter((d) => d.hasEnoughData);
  const recommendedDay =
    measuredDays.length > 0
      ? [...measuredDays].sort(
          (a, b) => (b.avgInteractions ?? 0) - (a.avgInteractions ?? 0)
        )[0].weekday
      : null;
  const recommendedPattern =
    recommendedDay != null ? weekdayPatterns[recommendedDay] : null;

  // Período recomendado: só com pelo menos dois períodos com amostra suficiente.
  const measuredPeriods = periodAggregates.filter((p) => p.hasEnoughData);
  const recommendedPeriod =
    measuredPeriods.length >= 2
      ? [...measuredPeriods].sort(
          (a, b) => (b.avgInteractions ?? 0) - (a.avgInteractions ?? 0)
        )[0].label
      : null;

  // Frequência MEDIDA do histórico: publicações coletadas / semanas cobertas.
  const measuredFrequencyPerWeek = measuredFrequency(media);

  const baseObjective =
    userContext.objective && userContext.objective.trim().length > 0
      ? userContext.objective.trim()
      : "crescimento consistente";
  const planPlatform = userContext.instagramConnected ? "instagram" : "tiktok";

  // Formato-base sugerido (do perfil de inteligência, quando existe).
  const aiPreferredFormats = (aiProfile?.preferredFormats ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const baseFormat = normalizeSuggestedFormat(aiPreferredFormats[0]);

  // ---- OS SETE DIAS (sempre presentes; cada um com estado real) ----
  const days: WeeklyPlanDay[] = weekDays.map((d) => {
    const weekday = d.getDay();
    const label = WEEKDAY_FULL[weekday];
    const plannedTitles = titlesByDow.get(weekday) ?? [];
    const occupied = plannedTitles.length > 0;
    const pattern = weekdayPatterns[weekday];
    const isRecommended = recommendedDay === weekday && !occupied;

    // Por que (ou por que não) este dia é o recomendado — sempre com o número real.
    let recommendedReason: string;
    if (occupied) {
      recommendedReason = `Já existe conteúdo planejado para ${label} nesta semana.`;
    } else if (recommendedDay === weekday && pattern) {
      recommendedReason = `Melhor desempenho observado: média de ${pattern.avgInteractions} interações em ${pattern.count} publicação(ões) neste dia da semana.`;
    } else if (!pattern.hasEnoughData) {
      recommendedReason = `Dados insuficientes: apenas ${pattern.count} publicação(ões) neste dia. Ignorar um padrão aqui seria um palpite.`;
    } else {
      recommendedReason = `Desempenho observado médio de ${pattern.avgInteractions} interações em ${pattern.count} publicação(ões) — abaixo do melhor dia.`;
    }

    // Frequência do dia, honesta: nenhum número inventado.
    const frequency =
      pattern.count > 0
        ? `${pattern.count} publicação(ões) coletadas neste dia da semana no histórico.`
        : "Sem publicações coletadas neste dia da semana — frequência não estimada.";

    // Sugestão só para os dias VAGOS (preenche lacuna sem duplicar o planejado).
    const suggestion: WeeklyPlanSuggestionItem | null = occupied
      ? null
      : {
          title: isRecommended
            ? `Conteúdo para ${label} (melhor desempenho observado)`
            : `Preencher ${label}`,
          platform: planPlatform,
          format: baseFormat,
          objective: baseObjective,
          basedOn: isRecommended
            ? recommendedReason
            : pattern.count > 0
              ? `Lacuna na semana atual do plano. Desempenho histórico deste dia: ${frequency}`
              : `Lacuna na semana atual do plano. ${frequency}`,
        };

    return {
      weekday,
      label,
      dateIso: d.toISOString(),
      suggestedFormat: baseFormat,
      recommended: isRecommended,
      recommendedReason,
      frequency,
      status: occupied ? ("OCUPADO" as const) : ("VAGO" as const),
      plannedTitles,
      suggestion,
      basedOn: suggestion ? suggestion.basedOn : recommendedReason,
    };
  });

  if (hasMinimalContext) {
    // Monta sugestões baseadas APENAS no que existe (nicho, objetivo, metas, experimentos).

    // 1. Preenche lacunas: dias da semana sem conteúdo planejado (semana atual).
    const missingDays = weekDays.filter((d) => !titlesByDow.has(d.getDay()));
    const plannedThisWeekCount = [...titlesByDow.values()].reduce(
      (acc, arr) => acc + arr.length,
      0
    );

    // NUNCA inventa horário — apenas sugere o dia como lacuna a preencher.
    if (missingDays.length > 0) {
      const daysLabel = missingDays
        .map((d) => d.toLocaleDateString("pt-BR", { weekday: "long" }))
        .join(", ");
      suggestions.push({
        title: "Preencher lacunas da semana",
        platform: planPlatform,
        format: baseFormat,
        objective: baseObjective,
        basedOn: `A semana atual tem ${plannedThisWeekCount} conteúdo(s) planejado(s); há lacunas em: ${daysLabel}. Nenhum horário foi sugerido — defina você mesmo com base no seu público.`,
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
    if (aiProfile?.preferredFormats && aiPreferredFormats.length > 0) {
      suggestions.push({
        title: "Manter os formatos que já funcionam",
        platform: planPlatform,
        format: baseFormat,
        objective: baseObjective,
        basedOn: `Perfil de inteligência indica preferência por: ${aiPreferredFormats.join(", ")}.`,
      });
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

  // Padrões medidos — transparência do plano. Sem dado, é dito explicitamente.
  rationaleLines.push("");
  rationaleLines.push("--- PADRÕES MEDIDOS NO HISTÓRICO REAL ---");
  if (recommendedDay != null && recommendedPattern) {
    rationaleLines.push(
      `Melhor dia observado: ${WEEKDAY_FULL[recommendedDay]} (média de ${recommendedPattern.avgInteractions} interações em ${recommendedPattern.count} publicação(ões)).`
    );
  } else {
    rationaleLines.push(
      "Melhor dia: DADO INSUFICIENTE — não há publicações coletadas com interação medida em quantidade suficiente para afirmar um dia."
    );
  }
  if (recommendedPeriod) {
    rationaleLines.push(`Melhor período do dia observado: ${recommendedPeriod}.`);
  } else {
    rationaleLines.push(
      "Melhor horário: DADO INSUFICIENTE — menos de dois períodos do dia têm amostra suficiente."
    );
  }
  if (measuredFrequencyPerWeek != null) {
    rationaleLines.push(`Frequência medida: ${measuredFrequencyPerWeek} publicação(ões) por semana.`);
  } else {
    rationaleLines.push("Frequência: DADO INSUFICIENTE — nenhuma publicação coletada.");
  }

  if (!hasMinimalContext) {
    rationaleLines.push("");
    rationaleLines.push("DADO INSUFICIENTE: não há nicho/perfil preenchido nem snapshots sincronizados. Preencha o perfil no onboarding e/ou conecte uma conta para receber um plano personalizado.");
  }

  return {
    rationale: rationaleLines.join("\n"),
    suggestions,
    days,
    recommendedDay,
    recommendedPeriod,
    measuredFrequencyPerWeek,
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
  const provider = await getAIProvider();

  if (!provider) {
    return { plan, aiUsed: false };
  }

  const system = `Você é o planejador de conteúdo do Inst Acessor. Use APENAS o contexto real abaixo.
NUNCA invente: frequência, horários, melhores momentos, métricas ou resultados.
Se um dado não existir, diga que está indisponível (DADO INSUFICIENTE).
Responda em português, formato de sugestão de plano semanal (títulos + porquê), sem listas genéricas.`;

  try {
    // MEDIÇÃO: envolvemos a MESMA chamada `provider.complete` (nenhuma chamada
    // nova). Deixamos o `cause` original propagar para o catch abaixo, que já
    // devolve o plano determinístico quando a IA falha.
    const metered = await withUsage(
      { userId, feature: "ai_generation", origin: "plano-semanal" },
      () =>
        provider.complete({
          messages: [
            { role: "system", content: system },
            { role: "user", content: plan.rationale },
          ],
          system,
          temperature: 0.4,
          maxTokens: 900,
        })
    );
    if (!metered.ok) throw new Error("QUOTA_EXCEDIDA");
    const aiText = metered.value;
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
