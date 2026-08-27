import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { kb } from "./repository";
import { computeIndividualBaseline } from "./baseline";
import { getRuleBySlug } from "./rules/registry";
import type { InsightType } from "./types";
import { INSIGHT_TYPES } from "./types";

/**
 * MOTOR DE PADRÕES (Fase 4.5)
 * ============================
 * Descobre padrões por perfil a partir do histórico real:
 * temas/formatos/ganchos/duração/estrutura/frequência/CTA/horários.
 *
 * Regras:
 *  - NUNCA declarar causalidade sem experimento → usar "associação observada".
 *  - NUNCA promover inferência para confirmado automaticamente.
 *  - Tipos: OBSERVED | INFERRED | CONFIRMED_BY_EXPERIMENT.
 *  - Aprendizado é PRIVADO por userId.
 */

export interface ProfileInsightDto {
  id: string;
  platform: string;
  type: InsightType;
  summary: string;
  detail?: string | null;
  ruleSlug?: string | null;
  experimentId?: string | null;
  confidence?: "BAIXA" | "MEDIA" | "ALTA" | null;
  createdAt: string;
}

const VALID_INSIGHT: InsightType[] = INSIGHT_TYPES;

function isInsightType(v: string): v is InsightType {
  return (VALID_INSIGHT as string[]).includes(v);
}

export async function listInsights(userId: string, platform: string): Promise<ProfileInsightDto[]> {
  const rows = await kb.insight.findMany({
    where: { userId, platform },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (rows as unknown as ProfileInsightDto[]).map((r) => ({
    id: r.id,
    platform: r.platform,
    type: isInsightType(r.type) ? r.type : "OBSERVED",
    summary: r.summary,
    detail: r.detail ?? null,
    ruleSlug: r.ruleSlug ?? null,
    experimentId: r.experimentId ?? null,
    confidence: r.confidence ?? null,
    createdAt: r.createdAt,
  }));
}

export async function createInsight(
  userId: string,
  data: {
    platform: string;
    type: InsightType;
    summary: string;
    detail?: string;
    ruleSlug?: string;
    experimentId?: string;
    confidence?: "BAIXA" | "MEDIA" | "ALTA";
  }
): Promise<ProfileInsightDto | null> {
  if (!isInsightType(data.type)) return null;
  const created = await kb.insight.create({
    data: {
      userId,
      platform: data.platform,
      type: data.type,
      summary: data.summary,
      detail: data.detail ?? null,
      ruleSlug: data.ruleSlug ?? null,
      experimentId: data.experimentId ?? null,
      confidence: data.confidence ?? null,
    },
  });
  const row = created as unknown as ProfileInsightDto;
  return {
    id: row.id,
    platform: row.platform,
    type: row.type,
    summary: row.summary,
    detail: row.detail ?? null,
    ruleSlug: row.ruleSlug ?? null,
    experimentId: row.experimentId ?? null,
    confidence: row.confidence ?? null,
    createdAt: row.createdAt,
  };
}

export async function deleteInsight(userId: string, id: string): Promise<boolean> {
  const existing = await kb.insight.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return false;
  await kb.insight.delete({ where: { id } });
  return true;
}

// ------------------------------------------------------------
// Geração de padrões OBSERVED a partir dos dados reais
// ------------------------------------------------------------

export interface ObservedPattern {
  summary: string;
  detail: string;
  ruleSlug: string;
  confidence: "BAIXA" | "MEDIA";
}

/**
 * Gera padrões OBSERVED determinísticos por plataforma (associação observada,
 * nunca causalidade). Não persiste automaticamente — retorna para a camada
 * superior decidir.
 */
export async function discoverObservedPatterns(
  userId: string,
  platform: "instagram" | "tiktok"
): Promise<ObservedPattern[]> {
  const [baseline] = await Promise.all([computeIndividualBaseline(userId, platform)]);

  const out: ObservedPattern[] = [];
  const rule = getRuleBySlug("unidade-conteudo");
  const ruleSlug = rule?.slug ?? "unidade-conteudo";

  if (baseline.snapshotCount < 2) {
    return out;
  }

  if (platform === "instagram") {
    const d = await getDashboardInstagramData(userId);

    // Alcance relativo ao baseline
    if (d.cards.reach.value != null && baseline.reach != null) {
      const ratio = d.cards.reach.value / baseline.reach;
      if (ratio >= 1.25) {
        out.push({
          summary: "Alcance atual acima da mediana do perfil",
          detail: `Alcance de ${d.cards.reach.value} vs. baseline de ${Math.round(baseline.reach)} (associação observada, não causal).`,
          ruleSlug,
          confidence: "MEDIA",
        });
      } else if (ratio <= 0.75) {
        out.push({
          summary: "Alcance atual abaixo da mediana do perfil",
          detail: `Alcance de ${d.cards.reach.value} vs. baseline de ${Math.round(baseline.reach)} (associação observada, não causal).`,
          ruleSlug,
          confidence: "MEDIA",
        });
      }
    }

    // Melhor dia de alcance → candidato a padrão
    if (d.timeline.bestReachDay) {
      out.push({
        summary: "Pico de alcance registrado",
        detail: `Melhor alcance em ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(d.timeline.bestReachDay.date))} (${d.timeline.bestReachDay.value}). Candidato a padrão a estudar.`,
        ruleSlug: "conteudo-excepcional-candidato-padrao",
        confidence: "BAIXA",
      });
    }
  } else {
    const d = await getTikTokDashboardData(userId);

    if (d.cards.likes.value != null && baseline.engagement != null) {
      const ratio = d.cards.likes.value / baseline.engagement;
      if (ratio >= 1.25) {
        out.push({
          summary: "Curtidas atuais acima da mediana do perfil",
          detail: `Curtidas de ${d.cards.likes.value} vs. baseline de ${Math.round(baseline.engagement)} (associação observada, não causal).`,
          ruleSlug,
          confidence: "MEDIA",
        });
      } else if (ratio <= 0.75) {
        out.push({
          summary: "Curtidas atuais abaixo da mediana do perfil",
          detail: `Curtidas de ${d.cards.likes.value} vs. baseline de ${Math.round(baseline.engagement)} (associação observada, não causal).`,
          ruleSlug,
          confidence: "MEDIA",
        });
      }
    }

    if (d.timeline.biggestFollowerPeak) {
      out.push({
        summary: "Pico de seguidores registrado",
        detail: `Maior número de seguidores registrado: ${d.timeline.biggestFollowerPeak.value}.`,
        ruleSlug: "conteudo-excepcional-candidato-padrao",
        confidence: "BAIXA",
      });
    }
  }

  return out;
}
