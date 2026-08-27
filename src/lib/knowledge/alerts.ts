import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { getRuleBySlug } from "@/lib/knowledge/rules/registry";
import type { AlertCode, AlertSeverity, GrowthAlert } from "@/lib/knowledge/types";

/**
 * MOTOR DE ALERTAS DETERMINÍSTICO (Fase 4.5)
 * ============================================
 * Regras oficiais (Módulo 17 — conteúdo da DONA):
 *   queda de alcance · aumento de alcance · queda de engajamento ·
 *   aumento de engajamento · crescimento desacelerando · excesso de dias sem
 *   postagem · Reel fraco · conteúdo acima da média.
 *
 * Thresholds como 0,5% ou 1% são REFERÊNCIAS CONTEXTUAIS (Módulo 13/16),
 * NÃO constantes universais. Nenhum dado inventado: métrica indisponível
 * não gera alerta.
 */

export interface AlertInput {
  /** Delta % entre período anterior e atual (ex.: -18 para -18%). */
  changePct: number | null;
  /** Valor absoluto atual da métrica. */
  value: number | null;
}

function severity(changePct: number): AlertSeverity {
  const abs = Math.abs(changePct);
  if (abs >= 25) return "ALTA";
  if (abs >= 10) return "MEDIA";
  return "BAIXA";
}

/**
 * Gera alertas para uma plataforma, a partir dos dados reais do dashboard.
 * Retorna um array ordenado por severidade (ALTA > MÉDIA > BAIXA).
 */
export async function generateAlerts(
  userId: string,
  platform: "instagram" | "tiktok"
): Promise<GrowthAlert[]> {
  if (platform === "instagram") {
    const d = await getDashboardInstagramData(userId);
    const alerts: GrowthAlert[] = [];

    // Alcance
    const reachChange = d.cards.reach.changePercent;
    if (reachChange != null) {
      if (reachChange <= -10) {
        alerts.push(makeAlert("ALCANCE_CAIU", platform, severity(reachChange), d.cards.reach.value, `${Math.round(reachChange)}%`));
      } else if (reachChange >= 10) {
        alerts.push(makeAlert("ALCANCE_AUMENTOU", platform, severity(reachChange), d.cards.reach.value, `${Math.round(reachChange)}%`));
      }
    }

    // Engajamento
    const engChange = d.cards.engagement.changePercent;
    if (engChange != null) {
      if (engChange <= -10) {
        alerts.push(makeAlert("ENGAJAMENTO_CAIU", platform, severity(engChange), d.cards.engagement.value, `${Math.round(engChange)}%`));
      } else if (engChange >= 10) {
        alerts.push(makeAlert("ENGAJAMENTO_AUMENTOU", platform, severity(engChange), d.cards.engagement.value, `${Math.round(engChange)}%`));
      }
    }

    // Crescimento desacelerando: crescimento presente no mês, mas menor que o período anterior
    const growth = d.comparison.monthlyGrowth;
    const prevGrowth = d.comparison.weeklyGrowth;
    if (growth != null && growth >= 0 && prevGrowth != null && prevGrowth > growth) {
      alerts.push({
        code: "CRESCIMENTO_DESACELERANDO",
        platform,
        severity: "MEDIA",
        title: "Crescimento desacelerando",
        detail: "O crescimento mensal está abaixo do crescimento semanal recente.",
        metric: "crescimento",
        value: growth,
        reference: "comparação semana × mês",
        ruleSlug: "monitorar-crescimento",
      });
    }

    // Dias sem postar — derivado dos snapshots (mediaCount estável + última sincronização)
    const lastSync = d.lastSyncAt;
    if (lastSync) {
      const days = Math.round((Date.now() - lastSync.getTime()) / 864e5);
      if (days >= 7) {
        alerts.push({
          code: "DIAS_SEM_POSTAR",
          platform,
          severity: days >= 14 ? "ALTA" : "MEDIA",
          title: "Dias sem postar",
          detail: `Aproximadamente ${days} dias desde a última sincronização de dados.`,
          metric: "frequencia",
          value: days,
          reference: "≥ 7 dias sem atividade",
          ruleSlug: "monitorar-frequencia",
        });
      }
    }

    // Reel fraco / conteúdo acima da média (via timeline de melhores dias)
    if (d.timeline.bestReachDay && d.snapshotCount >= 2) {
      const best = d.timeline.bestReachDay;
      // Não temos retenção por Reel; usamos o pico de alcance como sinal.
      // Sem dado confiável para "Reel fraco", apenas informamos o melhor dia.
      alerts.push({
        code: "CONTEUDO_ACIMA_DA_MEDIA",
        platform,
        severity: "BAIXA",
        title: "Conteúdo acima da média",
        detail: `Melhor alcance registrado em ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(best.date))} (${best.value}).`,
        metric: "alcance",
        value: best.value,
        reference: "maior alcance do histórico",
        ruleSlug: "conteudo-excepcional-candidato-padrao",
      });
    }

    return sortBySeverity(alerts);
  }

  // TikTok
  const d = await getTikTokDashboardData(userId);
  const alerts: GrowthAlert[] = [];

  const likesChange = d.cards.likes.changePercent;
  if (likesChange != null) {
    if (likesChange <= -10) {
      alerts.push(makeAlert("ENGAJAMENTO_CAIU", platform, severity(likesChange), d.cards.likes.value, `${Math.round(likesChange)}%`));
    } else if (likesChange >= 10) {
      alerts.push(makeAlert("ENGAJAMENTO_AUMENTOU", platform, severity(likesChange), d.cards.likes.value, `${Math.round(likesChange)}%`));
    }
  }

  const growth = d.comparison.monthlyGrowth;
  const prevGrowth = d.comparison.weeklyGrowth;
  if (growth != null && growth >= 0 && prevGrowth != null && prevGrowth > growth) {
    alerts.push({
      code: "CRESCIMENTO_DESACELERANDO",
      platform,
      severity: "MEDIA",
      title: "Crescimento desacelerando",
      detail: "O crescimento mensal está abaixo do crescimento semanal recente.",
      metric: "crescimento",
      value: growth,
      reference: "comparação semana × mês",
      ruleSlug: "monitorar-crescimento",
    });
  }

  const lastSync = d.lastSyncAt;
  if (lastSync) {
    const days = Math.round((Date.now() - lastSync.getTime()) / 864e5);
    if (days >= 7) {
      alerts.push({
        code: "DIAS_SEM_POSTAR",
        platform,
        severity: days >= 14 ? "ALTA" : "MEDIA",
        title: "Dias sem postar",
        detail: `Aproximadamente ${days} dias desde a última sincronização de dados.`,
        metric: "frequencia",
        value: days,
        reference: "≥ 7 dias sem atividade",
        ruleSlug: "monitorar-frequencia",
      });
    }
  }

  return sortBySeverity(alerts);
}

function makeAlert(
  code: AlertCode,
  platform: "instagram" | "tiktok",
  severity: AlertSeverity,
  value: number | null,
  reference: string
): GrowthAlert {
  const rule = getRuleBySlug(code === "ALCANCE_CAIU" || code === "ALCANCE_AUMENTOU" ? "alertas-oficiais" : "alertas-oficiais");
  const label =
    code === "ALCANCE_CAIU"
      ? "Alcance caiu"
      : code === "ALCANCE_AUMENTOU"
        ? "Alcance aumentou"
        : code === "ENGAJAMENTO_CAIU"
          ? "Engajamento caiu"
          : "Engajamento aumentou";
  return {
    code,
    platform,
    severity,
    title: label,
    detail: `${label} em relação ao período anterior.`,
    metric: code.startsWith("ALCANCE") ? "alcance" : "engajamento",
    value,
    reference,
    ruleSlug: rule?.slug ?? "alertas-oficiais",
  };
}

function sortBySeverity(alerts: GrowthAlert[]): GrowthAlert[] {
  const rank = { ALTA: 0, MEDIA: 1, BAIXA: 2 } as const;
  return [...alerts].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
