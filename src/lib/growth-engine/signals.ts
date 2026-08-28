import type { GrowthContext, GrowthSignal, SignalEvidence } from "./types";

/**
 * SINAIS DETERMINÍSTICOS — Fase 8 (Parte 4)
 * ===========================================
 * Detecta situações a partir dos dados REAIS do contexto. Cada sinal tem:
 *   type, severity (INFO..CRITICAL), confidence (0..1), evidence, platform,
 *   detectedAt.
 *
 * REGRA: sinais derivados de dados reais. Se o dado não existe ou é insuficiente,
 * o sinal NÃO é emitido (ou é emitido com confiança baixa e evidência clara de
 * DADO INSUFICIENTE). Nunca inventar métrica.
 */

const DAY_MS = 86400000;

function iso(d: Date): string {
  return d.toISOString();
}

function platformLabel(p: string | null): string {
  return p === "tiktok" ? "TikTok" : "Instagram";
}

function pctChange(current: number | null, reference: number | null): number | null {
  if (current == null || reference == null || reference === 0) return null;
  return ((current - reference) / reference) * 100;
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

// ------------------------------------------------------------
// Sinais por plataforma
// ------------------------------------------------------------

/** Sinais de ausência de dados/conexão. */
function accountSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  for (const platform of ["instagram", "tiktok"] as const) {
    const p = ctx[platform];
    if (!p.connected) {
      out.push({
        type: "NO_CONNECTED_ACCOUNT",
        severity: "MEDIUM",
        confidence: 1,
        evidence: [
          {
            detail: `Nenhuma conta ${platform === "instagram" ? "do Instagram" : "do TikTok"} conectada.`,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    } else if (p.snapshotCount === 0) {
      out.push({
        type: "NO_RECENT_DATA",
        severity: "INFO",
        confidence: 0.9,
        evidence: [
          {
            detail: `${platform === "instagram" ? "Instagram" : "TikTok"} conectado, mas sem sincronização ainda.`,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    }
  }
  return out;
}

/** Sinais de queda de métricas (engajamento, alcance, crescimento). */
function metricDropSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  for (const platform of ["instagram", "tiktok"] as const) {
    const p = ctx[platform];
    if (p.status !== "DADOS_SUFICIENTES") continue;

    // Engajamento (Instagram tem valor; TikTok não — nunca inventar)
    if (p.engagement != null && p.cardsEngagementChange != null) {
      const ch = p.cardsEngagementChange;
      if (ch <= -10) {
        out.push({
          type: "ENGAGEMENT_DROP",
          severity: ch <= -25 ? "HIGH" : "MEDIUM",
          confidence: Math.min(1, Math.abs(ch) / 50),
          evidence: [
            {
              detail: `Engajamento caiu ${Math.abs(ch).toFixed(1)}% em relação ao período anterior (Instagram).`,
              value: p.engagement,
              platform,
            },
          ],
          platform,
          detectedAt: iso(new Date()),
        });
      }
    }

    // Alcance (Instagram apenas)
    if (p.reach != null && p.cardsReachChange != null) {
      const ch = p.cardsReachChange;
      if (ch <= -10) {
        out.push({
          type: "REACH_DROP",
          severity: ch <= -25 ? "HIGH" : "MEDIUM",
          confidence: Math.min(1, Math.abs(ch) / 50),
          evidence: [
            {
              detail: `Alcance caiu ${Math.abs(ch).toFixed(1)}% em relação ao período anterior (Instagram).`,
              value: p.reach,
              platform,
            },
          ],
          platform,
          detectedAt: iso(new Date()),
        });
      }
    }

    // Crescimento de seguidores
    if (p.growth != null && p.growth < 0) {
      out.push({
        type: "FOLLOWER_GROWTH_DROP",
        severity: p.growth <= -10 ? "HIGH" : "MEDIUM",
        confidence: Math.min(1, Math.abs(p.growth) / 25),
        evidence: [
          {
            detail: `Crescimento mensal negativo (${p.growth.toFixed(1)}%) em ${platform === "instagram" ? "Instagram" : "TikTok"}.`,
            value: p.growth,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    }
  }
  return out;
}

/** Sinais de frequência/consistência de postagem. */
function postingSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  for (const platform of ["instagram", "tiktok"] as const) {
    const p = ctx[platform];
    if (p.status === "SEM_REDE" || p.status === "SEM_SYNC") continue;

    // Frequência baixa (posts/semana)
    if (p.frequency != null && p.frequency < 3) {
      out.push({
        type: "LOW_POSTING_FREQUENCY",
        severity: p.frequency < 1 ? "HIGH" : "MEDIUM",
        confidence: 0.9,
        evidence: [
          {
            detail: `Frequência de postagem estimada em ${p.frequency} por semana (${platform === "instagram" ? "Instagram" : "TikTok"}).`,
            value: p.frequency,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    }

    // Inconsistência: dias desde último post (via conteúdo planejado publicado)
    const published = p.plannedContent.filter((c) => c.status === "PUBLICADO");
    const lastPublished = published[published.length - 1];
    if (lastPublished?.scheduledAt) {
      const days = daysSince(lastPublished.scheduledAt);
      if (days != null && days > 7) {
        out.push({
          type: "INCONSISTENT_POSTING",
          severity: days > 14 ? "HIGH" : "MEDIUM",
          confidence: 0.85,
          evidence: [
            {
              detail: `Última publicação há ${days} dias (${platform === "instagram" ? "Instagram" : "TikTok"}).`,
              value: days,
              platform,
            },
          ],
          platform,
          detectedAt: iso(new Date()),
        });
      }
    }

    // Dias sem sincronização (status aqui é SEM_SYNC ou DADOS_SUFICIENTES)
    const since = daysSince(p.lastSyncAt);
    if (since != null && since > 7) {
      out.push({
        type: "NO_RECENT_DATA",
        severity: "LOW",
        confidence: 0.7,
        evidence: [
          {
            detail: `Última sincronização há ${since} dias (${platform === "instagram" ? "Instagram" : "TikTok"}).`,
            value: since,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    }
  }
  return out;
}

/** Sinais de metas (Parte 18). */
function goalSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  const allGoals = [...ctx.instagram.goals, ...ctx.tiktok.goals].filter(
    (g, i, arr) => arr.findIndex((x) => x.id === g.id) === i
  );

  for (const g of allGoals) {
    if (g.status !== "ATIVA") continue;

    // GOAL_ON_TRACK: meta ativa, com prazo > 7 dias e progresso saudável (>= 50%)
    if (g.deadline && g.progressPercent >= 50) {
      const deadline = new Date(g.deadline).getTime();
      const daysLeft = Math.floor((deadline - Date.now()) / DAY_MS);
      if (daysLeft > 7) {
        out.push({
          type: "GOAL_ON_TRACK",
          severity: "INFO",
          confidence: 0.8,
          evidence: [
            {
              detail: `Meta "${g.title}" no caminho certo (${g.progressPercent}% com ${daysLeft} dias restantes).`,
              value: g.progressPercent,
              reference: 50,
              platform: g.platform as "instagram" | "tiktok" | null,
            },
          ],
          platform: g.platform as "instagram" | "tiktok" | null,
          detectedAt: iso(new Date()),
        });
        continue;
      }
    }

    if (g.progressPercent >= 100 && g.targetValue != null && g.currentValue != null) {
      out.push({
        type: "GOAL_ACHIEVED",
        severity: "INFO",
        confidence: 1,
        evidence: [
          {
            detail: `Meta "${g.title}" atingida (${g.currentValue} de ${g.targetValue}).`,
            value: g.currentValue,
            reference: g.targetValue,
            platform: g.platform as "instagram" | "tiktok" | null,
          },
        ],
        platform: g.platform as "instagram" | "tiktok" | null,
        detectedAt: iso(new Date()),
      });
      continue;
    }

    // Meta em risco: deadline próxima e progresso baixo
    if (g.deadline) {
      const deadline = new Date(g.deadline).getTime();
      const daysLeft = Math.floor((deadline - Date.now()) / DAY_MS);
      if (daysLeft <= 7 && daysLeft >= 0 && g.progressPercent < 50) {
        out.push({
          type: "GOAL_AT_RISK",
          severity: daysLeft <= 3 ? "HIGH" : "MEDIUM",
          confidence: 0.85,
          evidence: [
            {
              detail: `Meta "${g.title}" a ${daysLeft} dias do prazo com ${g.progressPercent}% de progresso.`,
              value: g.progressPercent,
              reference: 50,
              platform: g.platform as "instagram" | "tiktok" | null,
            },
          ],
          platform: g.platform as "instagram" | "tiktok" | null,
          detectedAt: iso(new Date()),
        });
      }
    }
  }
  return out;
}

/** Sinais de experimentos (Parte 19). */
function experimentSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  const experiments = [
    ...ctx.instagram.experiments,
    ...ctx.tiktok.experiments,
  ].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);

  for (const e of experiments) {
    if (e.status === "RUNNING") {
      out.push({
        type: "EXPERIMENT_RUNNING",
        severity: "INFO",
        confidence: 0.7,
        evidence: [
          {
            detail: `Experimento "${e.hypothesis}" em andamento (${platformLabel(e.platform)}).`,
            platform: e.platform as "instagram" | "tiktok" | null,
          },
        ],
        platform: e.platform as "instagram" | "tiktok" | null,
        detectedAt: iso(new Date()),
      });
    } else if (e.status === "CONFIRMED") {
      out.push({
        type: "EXPERIMENT_WINNER",
        severity: "INFO",
        confidence: 0.8,
        evidence: [
          {
            detail: `Experimento "${e.hypothesis}" confirmado (vencedor).`,
            platform: e.platform as "instagram" | "tiktok" | null,
          },
        ],
        platform: e.platform as "instagram" | "tiktok" | null,
        detectedAt: iso(new Date()),
      });
    } else if (e.status === "LOSER") {
      out.push({
        type: "EXPERIMENT_LOSER",
        severity: "LOW",
        confidence: 0.8,
        evidence: [
          {
            detail: `Experimento "${e.hypothesis}" não confirmou ganho (perdedor).`,
            platform: e.platform as "instagram" | "tiktok" | null,
          },
        ],
        platform: e.platform as "instagram" | "tiktok" | null,
        detectedAt: iso(new Date()),
      });
    } else if (e.status === "INCONCLUSIVE") {
      out.push({
        type: "EXPERIMENT_INCONCLUSIVE",
        severity: "LOW",
        confidence: 0.7,
        evidence: [
          {
            detail: `Experimento "${e.hypothesis}" inconclusivo — dados insuficientes.`,
            platform: e.platform as "instagram" | "tiktok" | null,
          },
        ],
        platform: e.platform as "instagram" | "tiktok" | null,
        detectedAt: iso(new Date()),
      });
    }
  }
  return out;
}

/** Sinais de conteúdo (gap / alto desempenho). */
function contentSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  for (const platform of ["instagram", "tiktok"] as const) {
    const p = ctx[platform];
    const planned = p.plannedContent;

    // CONTENT_GAP: sem conteúdo planejado para os próximos 7 dias
    if (p.connected && p.status !== "SEM_SYNC") {
      const upcoming = planned.filter((c) => {
        if (!c.scheduledAt) return false;
        const t = new Date(c.scheduledAt).getTime();
        return t >= Date.now() && t <= Date.now() + 7 * DAY_MS;
      });
      if (upcoming.length === 0 && p.frequency != null && p.frequency >= 3) {
        out.push({
          type: "CONTENT_GAP",
          severity: "MEDIUM",
          confidence: 0.75,
          evidence: [
            {
              detail: `Nenhum conteúdo planejado para os próximos 7 dias (${platform === "instagram" ? "Instagram" : "TikTok"}).`,
              platform,
            },
          ],
          platform,
          detectedAt: iso(new Date()),
        });
      }
    }
  }
  return out;
}

/** Sinais de perfil (otimização necessária). */
function profileSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  const p = ctx.intelligenceProfile;
  // Sem perfil de inteligência consolidado → otimização do perfil é recomendável
  if (!p.summary && (ctx.instagram.connected || ctx.tiktok.connected)) {
    out.push({
      type: "PROFILE_OPTIMIZATION_NEEDED",
      severity: "LOW",
      confidence: 0.6,
      evidence: [
        {
          detail: "Perfil de inteligência ainda sem dados consolidados.",
          platform: null,
        },
      ],
      platform: null,
      detectedAt: iso(new Date()),
    });
  }
  return out;
}

/** Sinal LOW_RETENTION — inferido de engajamento baixo persistente (sem inventar). */
function retentionSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  for (const platform of ["instagram", "tiktok"] as const) {
    const p = ctx[platform];
    if (p.engagement == null || p.mediaCount == null || p.mediaCount === 0) continue;
    // Retenção aproximada = engajamento / publicações — INFERÊNCIA rotulada, não dado real
    const approx = p.engagement / p.mediaCount;
    if (approx < 5) {
      out.push({
        type: "LOW_RETENTION",
        severity: approx < 2 ? "HIGH" : "MEDIUM",
        confidence: 0.5, // inferência, confiança menor
        evidence: [
          {
            detail: `Retenção aproximada (engajamento/publicações) baixa: ${approx.toFixed(1)} (${platform}).`,
            value: approx,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    }
  }
  return out;
}

/** Sinal HIGH_PERFORMING_CONTENT — do timeline real (best items). */
function highPerformingSignals(ctx: GrowthContext): GrowthSignal[] {
  const out: GrowthSignal[] = [];
  for (const platform of ["instagram", "tiktok"] as const) {
    const p = ctx[platform];
    if (p.status !== "DADOS_SUFICIENTES") continue;
    const best = p.bestContent;
    if (best.length > 0) {
      const top = best[0];
      out.push({
        type: "HIGH_PERFORMING_CONTENT",
        severity: "INFO",
        confidence: 0.8,
        evidence: [
          {
            detail: `Conteúdo de alto desempenho detectado: ${top.label} (${top.value}).`,
            value: top.value,
            platform,
          },
        ],
        platform,
        detectedAt: iso(new Date()),
      });
    }
  }
  return out;
}

/**
 * Detector principal de sinais. Ordena por severidade (CRITICAL primeiro).
 */
export async function detectSignals(ctx: GrowthContext): Promise<GrowthSignal[]> {
  const all = [
    ...accountSignals(ctx),
    ...metricDropSignals(ctx),
    ...postingSignals(ctx),
    ...goalSignals(ctx),
    ...experimentSignals(ctx),
    ...contentSignals(ctx),
    ...profileSignals(ctx),
    ...retentionSignals(ctx),
    ...highPerformingSignals(ctx),
  ];

  const order: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}
