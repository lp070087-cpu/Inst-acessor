import { ai } from "@/lib/ai/db";
import { runDiagnosis, type DiagnosticItem, type Platform } from "./diagnosis";
import { getRuleBySlug } from "@/lib/knowledge/rules/registry";
import type { KnowledgeRule } from "@/lib/knowledge";

/**
 * Mentoria Inteligente — cards derivados de métricas reais + regras oficiais
 * da base de conhecimento (Fase 4.5).
 * Cada recomendação aponta: categoria, evidência, regra aplicada, prioridade,
 * ação e teste. Evita recomendações duplicadas.
 */

export interface MentorshipCard {
  id: string;
  category: string;
  label: string;
  priority: "ALTA" | "MEDIA" | "BAIXA";
  problem: string;
  explanation: string;
  action: string;
  /** Dado real que sustenta a recomendação. */
  evidence: string;
  /** Regra oficial aplicada (slug). */
  ruleSlug: string;
  /** Como validar a recomendação. */
  test: string;
  /** Resultado posterior observado. */
  result?: string;
  status: string;
  createdAt: Date;
}

const PRIORITY_MAP: Record<string, "ALTA" | "MEDIA" | "BAIXA"> = {
  "ponto-fraco": "ALTA",
  atencao: "MEDIA",
  oportunidade: "BAIXA",
};

// Regras oficiais por categoria (Fase 4.5 — conhecimento da DONA)
const RULE_BY_CATEGORY: Record<string, string> = {
  crescimento: "monitorar-crescimento",
  engajamento: "monitorar-engajamento",
  frequencia: "monitorar-frequencia",
  consistencia: "regra-consistencia-sustentavel",
  conteudo: "unidade-conteudo",
  alcance: "monitorar-alcance",
  perfil: "diagnostico-bio",
};

const ACTION_BY_CATEGORY: Record<string, string> = {
  crescimento: "Revise a estratégia de crescimento com base no histórico do perfil.",
  engajamento: "Incentive mais interações (perguntas, enquetes, CTAs).",
  frequencia: "Crie um calendário regular de publicações (frequência sustentável).",
  consistencia: "Mantenha uma frequência de sincronização para acompanhar a evolução.",
  conteudo: "Identifique os formatos com melhor desempenho e repita-os.",
  alcance: "Teste horários e formatos para ampliar o alcance.",
  perfil: "Revise bio e posicionamento para clareza da proposta.",
};

const TEST_BY_CATEGORY: Record<string, string> = {
  crescimento: "Compare o crescimento dos próximos 7/30 dias com o baseline individual.",
  engajamento: "Meça curtidas/comentários após aplicar o ajuste e compare com a mediana do perfil.",
  frequencia: "Acompanhe a evolução do alcance/engajamento após regularizar a frequência.",
  consistencia: "Observe se a regularidade melhora o desempenho ao longo de 2-4 semanas.",
  conteudo: "Publique variações e compare o resultado com a mediana por formato.",
  alcance: "Teste variações controladas e compare alcance/engajamento com o baseline.",
  perfil: "Avalie se visitas ao perfil convertem melhor após o ajuste de bio.",
};

export async function generateRecommendations(
  userId: string,
  platform: Platform
): Promise<MentorshipCard[]> {
  const diagnosis = await runDiagnosis(userId, platform);

  // Filtra apenas estados acionáveis
  const actionable = diagnosis.filter(
    (d) => d.state !== "dados-insuficientes" && d.state !== "ponto-forte"
  );

  const created: MentorshipCard[] = [];

  for (const item of actionable) {
    const duplicate = await findDuplicate(userId, item.category);
    if (duplicate) continue; // evita duplicidade

    const priority = PRIORITY_MAP[item.state] ?? "MEDIA";
    const ruleSlug = RULE_BY_CATEGORY[item.category] ?? "ciclo-principal";
    const rule: KnowledgeRule | undefined = getRuleBySlug(ruleSlug);

    const row = await ai.recommendation.create({
      data: {
        userId,
        category: item.category,
        priority,
        problem: item.label,
        explanation: item.detail,
        action: ACTION_BY_CATEGORY[item.category] ?? "Acompanhe este indicador.",
        evidence: item.detail, // o dado real que gerou o diagnóstico
        ruleSlug,
        test: TEST_BY_CATEGORY[item.category] ?? "Monitore o indicador ao longo do tempo.",
        status: "NOVA",
        source: `${platform}-diagnostico`,
      },
    });

    created.push({
      id: (row as { id: string }).id,
      category: item.category,
      label: item.label,
      priority,
      problem: item.label,
      explanation: item.detail,
      action: ACTION_BY_CATEGORY[item.category] ?? "Acompanhe este indicador.",
      evidence: item.detail,
      ruleSlug,
      test: TEST_BY_CATEGORY[item.category] ?? "Monitore o indicador ao longo do tempo.",
      status: "NOVA",
      createdAt: (row as { createdAt: Date }).createdAt,
    });
  }

  return created;
}

async function findDuplicate(userId: string, category: string) {
  const existing = await ai.recommendation.findFirst({
    where: { userId, category, status: { in: ["NOVA", "APLICADA", "CONCLUIDA"] } },
  });
  return existing ?? null;
}

/** Lista recomendações do usuário. */
export async function listRecommendations(userId: string): Promise<MentorshipCard[]> {
  const rows = await ai.recommendation.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 60,
  });

  // Ordenação manual por prioridade (ALTA > MEDIA > BAIXA)
  const rank = { ALTA: 0, MEDIA: 1, BAIXA: 2 } as const;
  return (rows as unknown as MentorshipCard[]).sort(
    (a, b) => rank[a.priority] - rank[b.priority]
  );
}

/** Atualiza status de uma recomendação (NOVA/APLICADA/IGNORADA/CONCLUIDA). */
export async function updateRecommendationStatus(
  userId: string,
  id: string,
  status: string
) {
  const existing = await ai.recommendation.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return null;
  return ai.recommendation.update({ where: { id }, data: { status } });
}
