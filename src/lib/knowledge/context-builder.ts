import { buildUserContext, contextToPrompt } from "@/lib/ai/context";
import type { UserContext } from "@/lib/ai/context";
import { kb } from "./repository";
import { getRulesByCategory, getRulesByTags, getRuleBySlug } from "./rules/registry";
import type { KnowledgeRule } from "./types";
import { KNOWLEDGE_MODULES } from "./rules/registry";

/**
 * CONTEXT BUILDER — recuperação contextual do conhecimento.
 *
 * A IA recebe APENAS o conhecimento RELEVANTE para a pergunta, junto com:
 *   A. CONHECIMENTO RELEVANTE (módulos/regras filtradas por categoria/tags)
 *   B. DADOS REAIS (perfil autorizado)
 *   C. HISTÓRICO (snapshots/conteúdo)
 *   D. APRENDIZADO DO PERFIL (padrões já observados — ProfileInsight)
 *   E. EXPERIMENTOS (hipóteses/resultados quando existirem)
 *
 * NUNCA envia os 30 módulos inteiros em toda requisição.
 * A recuperação é determinística por tags/categoria (preparada para futura
 * busca semântica/RAG).
 */

export interface RetrievedKnowledge {
  rules: KnowledgeRule[];
}

export interface KnowledgeContextParts {
  relevantRules: KnowledgeRule[];
  userContext: UserContext;
  insights: ProfileInsightDto[];
  experiments: ExperimentDto[];
  historyNote: string;
}

export interface ProfileInsightDto {
  type: string;
  summary: string;
  detail?: string | null;
  ruleSlug?: string | null;
  confidence?: string | null;
}

export interface ExperimentDto {
  id: string;
  hypothesis: string;
  variable: string;
  status: string;
  conclusion?: string | null;
}

// ------------------------------------------------------------
// Recuperação contextual determinística
// ------------------------------------------------------------

/** Palavras-chave → categorias/tags da base oficial. */
const QUERY_MAP: { keywords: string[]; tags: string[]; categories: string[] }[] = [
  {
    keywords: ["reel", "reels", "video", "reproducao", "play"],
    tags: ["reels"],
    categories: ["conteudo", "alcance"],
  },
  {
    keywords: ["story", "stories", "relacionamento"],
    tags: ["stories"],
    categories: ["conteudo"],
  },
  {
    keywords: ["gancho", "abertura", "hook", "primeiros segundos"],
    tags: ["gancho"],
    categories: ["retencao"],
  },
  {
    keywords: ["retencao", "consumo", "progressao"],
    tags: ["retencao"],
    categories: ["retencao"],
  },
  {
    keywords: ["engajamento", "curtida", "comentario", "interacao"],
    tags: ["engajamento"],
    categories: ["engajamento"],
  },
  {
    keywords: ["alcance", "distribuicao", "visualizacao", "views"],
    tags: ["alcance", "distribuicao"],
    categories: ["alcance"],
  },
  {
    keywords: ["crescimento", "seguidor", "ganho", "desacelera"],
    tags: ["crescimento"],
    categories: ["crescimento"],
  },
  {
    keywords: ["frequencia", "consistencia", "postar", "publicar", "regularidade"],
    tags: ["frequencia", "consistencia"],
    categories: ["consistencia"],
  },
  {
    keywords: ["bio", "posicionamento", "perfil", "nicho", "proposta"],
    tags: ["bio", "posicionamento"],
    categories: ["bio", "posicionamento", "conversao"],
  },
  {
    keywords: ["conteudo", "tema", "formato", "legenda", "carrossel", "post"],
    tags: ["conteudo"],
    categories: ["conteudo"],
  },
  {
    keywords: ["estrategia", "plano", "que fazer", "melhorar"],
    tags: ["estrategia"],
    categories: ["estrategia"],
  },
  {
    keywords: ["ideia", "ideias", "criar", "produzir"],
    tags: ["ideias"],
    categories: ["ideias"],
  },
  {
    keywords: ["copy", "legenda", "cta", "chamada"],
    tags: ["copy"],
    categories: ["copy"],
  },
  {
    keywords: ["metrica", "metricas", "indicador", "kpi", "numero"],
    tags: ["metricas"],
    categories: ["metricas"],
  },
  {
    keywords: ["score", "nota", "pontuacao", "saude"],
    tags: ["score"],
    categories: ["score"],
  },
  {
    keywords: ["experimento", "teste", "hipotese", "a/b"],
    tags: ["experimento"],
    categories: ["experimentacao"],
  },
  {
    keywords: ["alertas", "alerta", "queda", "caiu", "atencao"],
    tags: ["alertas"],
    categories: ["alertas"],
  },
  {
    keywords: ["comparar", "comparacao", "periodo", "evolucao", "historico", "7d", "30d", "90d"],
    tags: ["comparacao", "historico", "snapshots"],
    categories: ["historico"],
  },
  {
    keywords: ["publico", "audiencia", "seguidores", "quem"],
    tags: ["publico"],
    categories: ["publico"],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function retrieveRelevantRules(query: string): KnowledgeRule[] {
  const q = normalize(query);
  const matchedTags = new Set<string>();
  const matchedCategories = new Set<string>();

  for (const entry of QUERY_MAP) {
    if (entry.keywords.some((k) => q.includes(normalize(k)))) {
      entry.tags.forEach((t) => matchedTags.add(t));
      entry.categories.forEach((c) => matchedCategories.add(c));
    }
  }

  // Regras mais específicas primeiro, limite para não estourar o prompt.
  const byTags = getRulesByTags([...matchedTags]);
  const byCategory = matchedCategories.size > 0
    ? KNOWLEDGE_MODULES.flatMap((m) =>
        m.rules.filter((r) => matchedCategories.has(r.category))
      )
    : [];

  const seen = new Set<string>();
  const merged: KnowledgeRule[] = [];
  for (const rule of [...byTags, ...byCategory]) {
    if (seen.has(rule.slug)) continue;
    seen.add(rule.slug);
    merged.push(rule);
  }

  // Se nada específico casou, devolve um conjunto mínimo de princípios
  // (NUNCA os 30 módulos inteiros).
  if (merged.length === 0) {
    return ["ciclo-principal", "nunca-inventar-metricas", "toda-resposta-tem-base"]
      .map((slug) => getRuleBySlug(slug))
      .filter((r): r is KnowledgeRule => Boolean(r));
  }

  return merged.slice(0, 12);
}

// ------------------------------------------------------------
// Leitura de aprendizado individual e experimentos
// ------------------------------------------------------------

export async function listProfileInsights(userId: string, platform: string): Promise<ProfileInsightDto[]> {
  const rows = await kb.insight.findMany({
    where: { userId, platform },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return (rows as ProfileInsightDto[]).map((r) => ({
    type: r.type,
    summary: r.summary,
    detail: r.detail ?? null,
    ruleSlug: r.ruleSlug ?? null,
    confidence: r.confidence ?? null,
  }));
}

export async function listUserExperiments(userId: string): Promise<ExperimentDto[]> {
  const rows = await kb.experiment.findMany({
    where: { userId, status: { in: ["RUNNING", "ENOUGH_DATA", "CONFIRMED", "REJECTED", "INCONCLUSIVE"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  return (rows as ExperimentDto[]).map((r) => ({
    id: r.id,
    hypothesis: r.hypothesis,
    variable: r.variable,
    status: r.status,
    conclusion: r.conclusion ?? null,
  }));
}

// ------------------------------------------------------------
// Montagem final do contexto
// ------------------------------------------------------------

export async function buildKnowledgeContext(
  userId: string,
  opts: { query: string; platform?: string }
): Promise<KnowledgeContextParts> {
  const [userContext, insights, experiments] = await Promise.all([
    buildUserContext(userId),
    listProfileInsights(userId, opts.platform ?? "instagram"),
    listUserExperiments(userId),
  ]);

  const rules = retrieveRelevantRules(opts.query);

  const historyNote =
    userContext.instagram.snapshotCount > 0 || userContext.tiktok.snapshotCount > 0
      ? `Histórico disponível: ${userContext.instagram.snapshotCount} snapshots Instagram, ${userContext.tiktok.snapshotCount} snapshots TikTok.`
      : "Histórico indisponível (sem snapshots suficientes).";

  return {
    relevantRules: rules,
    userContext,
    insights,
    experiments,
    historyNote,
  };
}

/** Converte o contexto em texto para o prompt (categorias explicitas). */
export function knowledgeContextToPrompt(ctx: KnowledgeContextParts): string {
  const lines: string[] = [];

  lines.push("--- DADOS REAIS DO USUÁRIO (API/snapshot/banco) ---");
  lines.push(contextToPrompt(ctx.userContext));

  if (ctx.historyNote) {
    lines.push("");
    lines.push("--- HISTÓRICO ---");
    lines.push(ctx.historyNote);
  }

  if (ctx.relevantRules.length > 0) {
    lines.push("");
    lines.push("--- CONHECIMENTO OFICIAL APLICÁVEL (somente regras relevantes) ---");
    for (const rule of ctx.relevantRules) {
      lines.push(
        `• [Módulo ${String(rule.module).padStart(2, "0")}] ${rule.title} (${rule.type}): ${rule.content}`
      );
    }
    lines.push(
      "Regra: este conhecimento é oficial e NÃO deve ser complementado com dicas genéricas externas."
    );
  }

  if (ctx.insights.length > 0) {
    lines.push("");
    lines.push("--- APRENDIZADO DO PERFIL (padrões observados) ---");
    for (const ins of ctx.insights) {
      lines.push(
        `• [${ins.type}] ${ins.summary}${ins.confidence ? ` (confiança: ${ins.confidence})` : ""}`
      );
    }
    lines.push(
      "Regra: aprendizado OBSERVADO/INFERIDO não é fato comprovado. Apenas CONFIRMED_BY_EXPERIMENT pode ser tratado como validado."
    );
  }

  if (ctx.experiments.length > 0) {
    lines.push("");
    lines.push("--- EXPERIMENTOS DO PERFIL ---");
    for (const exp of ctx.experiments) {
      lines.push(
        `• [${exp.status}] ${exp.hypothesis} (variável: ${exp.variable})${exp.conclusion ? ` → ${exp.conclusion}` : ""}`
      );
    }
  }

  lines.push("");
  // As categorias abaixo são RACIOCÍNIO INTERNO. O prompt do chat já proíbe
  // expô-las como rótulos na conversa — aqui elas servem só para o modelo
  // saber de onde cada afirmação vem.
  lines.push(
    "Confiabilidade do que você sabe (para o SEU raciocínio, não para escrever na resposta): DADO REAL (API/snapshot/banco), CONHECIMENTO (regra oficial da DONA), INFERÊNCIA (interpretação), HIPÓTESE (a validar), RECOMENDAÇÃO (ação). Não misture as categorias e não invente o que não foi fornecido."
  );

  return lines.join("\n");
}
