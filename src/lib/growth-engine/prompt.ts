import type { GrowthContext } from "./types";
import type { DataStatus } from "./types";

/**
 * PROMPT DO CONTEXTO DE CRESCIMENTO — Fase 8 (Parte 14)
 * =====================================================
 * Serializa o GrowthContext para o prompt da IA Acessor de forma
 * determinística e SEM inventar dados:
 *
 * - Só imprime campos com valor real (`null` → omitido / "não informado").
 * - Marca explicitamente o estado de dados (SEM_REDE / SEM_SYNC /
 *   POUCOS_DADOS / DADOS_SUFICIENTES).
 * - Lista sinais, prioridades e recomendações com origem clara.
 * - A IA é orientada a distinguir DADO REAL / INFERÊNCIA / RECOMENDAÇÃO e
 *   responder "DADO INSUFICIENTE" quando não houver base.
 *
 * USO: `growthContextToPrompt(ctx)` — pronto para concatenar ao system prompt.
 */

function dataStatusLabel(status: DataStatus): string {
  switch (status) {
    case "SEM_REDE":
      return "sem rede conectada";
    case "SEM_SYNC":
      return "conectada, mas ainda sem sincronização";
    case "POUCOS_DADOS":
      return "poucos dados (menos de 2 snapshots)";
    case "DADOS_SUFICIENTES":
      return "dados suficientes";
  }
}

function fmtNumber(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "não informado";
  return `${v.toLocaleString("pt-BR")}${suffix}`;
}

function platformBlock(ctx: GrowthContext, p: GrowthContext["instagram"]): string[] {
  const lines: string[] = [];
  lines.push(
    `- ${p.platform === "instagram" ? "Instagram" : "TikTok"}: status = ${dataStatusLabel(p.status)}${p.connected ? "" : " (não conectada)"}`
  );
  if (p.followers != null) lines.push(`  - seguidores: ${fmtNumber(p.followers)}`);
  if (p.reach != null) lines.push(`  - alcance: ${fmtNumber(p.reach)}`);
  if (p.impressions != null) lines.push(`  - impressões: ${fmtNumber(p.impressions)}`);
  if (p.engagement != null) lines.push(`  - engajamento: ${fmtNumber(p.engagement)}`);
  if (p.growth != null) lines.push(`  - crescimento mensal: ${p.growth}%`);
  if (p.frequency != null) lines.push(`  - frequência estimada: ${p.frequency} posts/semana`);
  if (p.score != null) lines.push(`  - score: ${p.score} (cobertura ${fmtNumber(p.scoreCoverage)}%)`);
  if (p.goals.length > 0) {
    lines.push(`  - metas: ${p.goals.map((g) => `${g.title} (${g.progressPercent}%)`).join(", ")}`);
  }
  if (p.experiments.length > 0) {
    lines.push(
      `  - experimentos: ${p.experiments.map((e) => `${e.hypothesis} (${e.status})`).join("; ")}`
    );
  }
  if (p.alerts.length > 0) {
    lines.push(`  - alertas: ${p.alerts.map((a) => a.title).join("; ")}`);
  }
  if (p.plannedContent.length > 0) {
    lines.push(
      `  - conteúdos planejados: ${p.plannedContent.map((c) => c.title).join("; ")}`
    );
  }
  if (p.bestContent.length > 0) {
    lines.push(
      `  - melhor conteúdo: ${p.bestContent.map((c) => `${c.label} em ${c.date} (${c.value})`).join("; ")}`
    );
  }
  if (p.worstContent.length > 0) {
    lines.push(
      `  - pior conteúdo: ${p.worstContent.map((c) => `${c.label} em ${c.date} (${c.value})`).join("; ")}`
    );
  }
  return lines;
}

export function growthContextToPrompt(ctx: GrowthContext): string {
  const lines: string[] = [];

  lines.push("=== CONTEXTO OPERACIONAL DE CRESCIMENTO (Growth Context) ===");
  lines.push(`Confiança do contexto: ${Math.round(ctx.confidence * 100)}% (reduz quando faltam dados).`);
  lines.push(`Estágio estimado: ${ctx.stage} (inferido dos seguidores reais; pode ser 'sem-dados').`);

  if (ctx.userProfile.objective) {
    lines.push(`Objetivo declarado: ${ctx.userProfile.objective}`);
  }
  if (ctx.userProfile.niche) {
    lines.push(`Nicho: ${ctx.userProfile.niche}`);
  }

  lines.push("");
  lines.push("Plataformas:");
  lines.push(platformBlock(ctx, ctx.instagram).join("\n"));
  lines.push(platformBlock(ctx, ctx.tiktok).join("\n"));

  if (ctx.insights.length > 0) {
    lines.push("");
    lines.push("Padrões/insights detectados:");
    for (const i of ctx.insights.slice(0, 10)) {
      lines.push(`- [${i.platform ?? "perfil"}] ${i.summary}`);
    }
  }

  if (ctx.intelligenceProfile.summary) {
    lines.push("");
    lines.push(`Perfil de inteligência: ${ctx.intelligenceProfile.summary}`);
  }

  lines.push("");
  lines.push(
    "Regra: esses campos são DADOS REAIS quando presentes. Ausência significa DADO INSUFICIENTE — responda 'DADO INSUFICIENTE' e não invente métricas."
  );

  return lines.join("\n");
}
