import { ai } from "@/lib/ai/db";
import { getAIProvider } from "@/lib/ai";
import { buildUserContext, contextToPrompt } from "@/lib/ai/context";
import { getRuleBySlug } from "@/lib/knowledge/rules/registry";

/**
 * Serviço da Central de Ideias.
 * Gera ideias via IA (provider ativo) — sem inventar tendências externas.
 */

export class AIConfiguredError extends Error {
  constructor() {
    super("IA_NAO_CONFIGURADA");
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  reels: "Reels (Instagram)",
  stories: "Stories (Instagram)",
  carrossel: "Carrossel (Instagram)",
  tiktok: "TikTok",
  educativo: "conteúdo educativo",
  autoridade: "conteúdo de autoridade",
  venda: "conteúdo de venda",
  engajamento: "conteúdo de engajamento",
};

export interface GeneratedIdea {
  title: string;
  format?: string;
  objective?: string;
  context?: string;
  rationale?: string;
}

export async function generateIdeas(
  userId: string,
  params: { category: string; count: number }
): Promise<GeneratedIdea[]> {
  const provider = getAIProvider();
  if (!provider) throw new AIConfiguredError();

  const ctx = await buildUserContext(userId);
  const categoryLabel = CATEGORY_LABEL[params.category] ?? params.category;

  // Regra oficial: ideias precisam de contexto (nicho + público + conteúdo anterior + desempenho + objetivo)
  const ideaRule = getRuleBySlug("ideias-precisam-contexto");

  const system = [
    "Você é a IA Acessor do Inst Acessor, especialista em planejamento de conteúdo para redes sociais.",
    "Use apenas o contexto real fornecido. Não invente tendências externas, métricas ou conhecimento proprietário.",
    "Aplique a regra oficial: ideias devem considerar NICHO + PÚBLICO + CONTEÚDO ANTERIOR + DESEMPENHO + OBJETIVO.",
    "Responda SEMPRE em JSON, sem comentários, sem markdown, exatamente neste formato:",
    '[{"title":"...","format":"...","objective":"...","context":"...","rationale":"..."}]',
    "Cada ideia deve ter: title (curto e claro), format (ex.: Reel, Story, Carrossel), objective (qual objetivo serve), context (ideia de abordagem) e rationale (POR QUE esta ideia foi sugerida, com base no contexto).",
    ideaRule ? `Regra oficial aplicada: ${ideaRule.content}` : "",
    "--- CONTEXTO REAL DO USUÁRIO ---",
    contextToPrompt(ctx),
  ].join("\n");

  const userPrompt = `Gere ${params.count} ideias de conteúdo para a categoria "${categoryLabel}".`;

  const raw = await provider.complete({
    system,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.9,
    maxTokens: 1500,
  });

  const ideas = parseIdeaJson(raw);
  return ideas.slice(0, params.count);
}

function parseIdeaJson(raw: string): GeneratedIdea[] {
  try {
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const arr = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: GeneratedIdea[] = [];
    for (const item of arr) {
      if (typeof item !== "object" || item === null) continue;
      const o = item as Record<string, unknown>;
      const title = String(o.title ?? "").trim();
      if (!title) continue;
      out.push({
        title,
        format: o.format != null ? String(o.format).trim() : undefined,
        objective: o.objective != null ? String(o.objective).trim() : undefined,
        context: o.context != null ? String(o.context).trim() : undefined,
        rationale: o.rationale != null ? String(o.rationale).trim() : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Lista ideias do usuário. */
export async function listIdeas(userId: string) {
  const rows = await ai.idea.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows as {
    id: string;
    category: string;
    title: string;
    format?: string | null;
    objective?: string | null;
    context?: string | null;
    rationale?: string | null;
    status: string;
    platform?: string | null;
    createdAt: Date;
  }[];
}

export async function saveIdea(
  userId: string,
  data: {
    category: string;
    title: string;
    format?: string;
    objective?: string;
    context?: string;
    rationale?: string;
    platform?: string;
  }
) {
  return ai.idea.create({ data: { userId, ...data } });
}

/** Atualiza status (NOVA/FAVORITA/DESCARTADA/PRODUZIDA). */
export async function updateIdeaStatus(userId: string, id: string, status: string) {
  const existing = await ai.idea.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return null;
  return ai.idea.update({ where: { id }, data: { status } });
}

export async function deleteIdea(userId: string, id: string) {
  const existing = await ai.idea.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return false;
  await ai.idea.delete({ where: { id } });
  return true;
}
