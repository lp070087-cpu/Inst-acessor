import { ai } from "@/lib/ai/db";
import { getAIProvider } from "@/lib/ai";
import { buildUserContext, contextToPrompt } from "@/lib/ai/context";
import { getRulesByCategory, getRuleBySlug } from "@/lib/knowledge/rules/registry";

/**
 * Serviço de geração de copy (IA).
 * Usa o provider ativo; sem provider → lança erro controlado.
 */

export class AIConfiguredError extends Error {
  constructor() {
    super("IA_NAO_CONFIGURADA");
  }
}

export interface GenerateCopyParams {
  platform: string;
  format: string;
  objective?: string;
  tone?: string;
  audience?: string;
  context?: string;
  size?: string;
}

const FORMAT_LABEL: Record<string, string> = {
  legenda: "legenda de post",
  reel: "legenda de Reel",
  story: "texto para Story",
  carrossel: "legenda de carrossel",
  tiktok: "roteiro/texto para TikTok",
  cta: "chamada para ação (CTA)",
  headline: "headline / manchete",
  bio: "biografia de perfil",
  anuncio: "anúncio",
};

const SIZE_GUIDE: Record<string, string> = {
  curto: "máximo 1-2 frases (se aplicável)",
  medio: "texto equilibrado, ~3-5 frases",
  longo: "texto completo e detalhado",
};

export async function generateCopy(
  userId: string,
  params: GenerateCopyParams
): Promise<string> {
  const provider = getAIProvider();
  if (!provider) throw new AIConfiguredError();

  const ctx = await buildUserContext(userId);
  const formatLabel = FORMAT_LABEL[params.format] ?? params.format;

  // Conhecimento oficial aplicável: regras de gancho, retenção e copy.
  const hookRules = getRulesByCategory("conteudo").filter(
    (r) => r.tags.includes("gancho") || r.tags.includes("copy") || r.tags.includes("retencao")
  );
  const copyRule = getRuleBySlug("copy-usa-estrategia");
  const knowledgeLines = [copyRule ? `• ${copyRule.title}: ${copyRule.content}` : ""]
    .concat(hookRules.map((r) => `• ${r.title}: ${r.content}`))
    .filter(Boolean);

  const system = [
    "Você é a IA Acessor do Inst Acessor, especialista em criação de conteúdo para redes sociais.",
    "Use apenas o contexto real fornecido. Não invente métricas nem conhecimento proprietário.",
    "Aplique apenas as REGRAS OFICIAIS de copy abaixo — não adicione metodologia externa.",
    "Responda APENAS com o texto gerado (sem comentários, sem aspas, sem marcações de markdown).",
    "Linguagem natural em português, adequada ao tom solicitado.",
    "--- CONTEXTO REAL DO USUÁRIO ---",
    contextToPrompt(ctx),
    "",
    "--- REGRAS OFICIAIS DE COPY (não substituir por dicas genéricas) ---",
    ...knowledgeLines,
    "Importante: o gancho deve combinar com a entrega. Não transforme todo texto em clickbait.",
  ].join("\n");

  const userPrompt = [
    `Gere um(a) ${formatLabel} para ${params.platform}.`,
    params.objective ? `Objetivo: ${params.objective}.` : "",
    params.audience ? `Público-alvo: ${params.audience}.` : "",
    params.tone ? `Tom: ${params.tone}.` : "",
    params.context ? `Contexto adicional: ${params.context}.` : "",
    SIZE_GUIDE[params.size ?? "medio"] ?? "",
    "Se aplicável, inclua sugestão de hashtags relevantes ao final.",
  ]
    .filter(Boolean)
    .join("\n");

  return provider.complete({ system, messages: [{ role: "user", content: userPrompt }] });
}

/** Lista copies salvos do usuário. */
export async function listCopies(userId: string) {
  const rows = await ai.copy.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows as { id: string; platform: string; format: string; content: string; isFavorite: boolean; createdAt: Date }[];
}

/** Salva um copy gerado. */
export async function saveCopy(
  userId: string,
  data: {
    platform: string;
    format: string;
    objective?: string;
    tone?: string;
    audience?: string;
    context?: string;
    content: string;
  }
) {
  const created = await ai.copy.create({
    data: { userId, ...data },
  });
  return created;
}

/** Alterna favorito. */
export async function toggleCopyFavorite(userId: string, id: string) {
  const existing = await ai.copy.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return null;
  return ai.copy.update({
    where: { id },
    data: { isFavorite: !(existing as { isFavorite: boolean }).isFavorite },
  });
}

export async function deleteCopy(userId: string, id: string) {
  const existing = await ai.copy.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return false;
  await ai.copy.delete({ where: { id } });
  return true;
}
