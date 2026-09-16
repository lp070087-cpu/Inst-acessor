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

/**
 * DIRETRIZES POR FORMATO
 * ----------------------
 * O formato muda o que é uma boa copy. Sem esta separação, o motor devolvia
 * uma legenda longa de feed para um Story — formatos diferentes têm extensão,
 * tom e função diferentes.
 *
 * Estas diretrizes são de ESTRUTURA (o que cabe no formato), não de tendência:
 * nada aqui afirma o que está "em alta", porque o sistema não mede isso.
 */
const FORMAT_GUIDE: Record<string, string> = {
  legenda:
    "Formato POST de feed: legenda que sustenta a imagem. Gancho na primeira linha (o feed corta depois de ~2 linhas), desenvolvimento curto e um fechamento com convite à interação. Não escreva roteiro.",
  reel:
    "Formato REEL: legenda curta de apoio ao vídeo + uma ideia de gancho falado nos primeiros 2 segundos. A legenda NÃO deve descrever o vídeo inteiro — o vídeo faz isso. Sugira também o texto de abertura na tela.",
  story:
    "Formato STORY: texto CURTO para aparecer sobre a tela, lido em 3–5 segundos. Uma ideia por Story, frases curtas, no máximo 2–3 linhas. NÃO é legenda de feed: nada de parágrafo longo. Termine com uma pergunta ou enquete quando fizer sentido.",
  carrossel:
    "Formato CARROSSEL: legenda de apoio + sugestão de divisão dos slides (uma ideia por slide, na ordem, incluindo a capa). A primeira linha da legenda precisa funcionar como gancho.",
  tiktok:
    "Formato TIKTOK: roteiro curto com gancho nos primeiros segundos, desenvolvimento e fechamento. Linguagem falada, natural, sem formalidade de legenda de feed.",
  cta: "Formato CTA: uma chamada direta e específica, sem rodeio. Diga exatamente o que a pessoa deve fazer.",
  headline: "Formato HEADLINE: uma manchete curta e específica. Deve prender em uma leitura.",
  bio: "Formato BIO: texto de apresentação do perfil, curto, com o que a conta faz e para quem.",
  anuncio: "Formato ANÚNCIO: texto persuasivo com dor/desejo, benefício e chamada para ação.",
};

/**
 * Normaliza o vocabulário de formato do Preview Social para o do motor.
 *
 * O Preview usa `post | reel | story | carrossel` (formatos de plataforma); o
 * motor usa `legenda | reel | story | carrossel | tiktok | ...` (formatos de
 * texto). A tradução acontece AQUI, para que o Preview reutilize a MESMA rota
 * e o mesmo serviço, sem duplicar implementação.
 */
export function normalizeFormat(platform: string, format: string): string {
  const f = (format ?? "").toLowerCase();
  if (f === "post" || f === "feed") return platform === "tiktok" ? "tiktok" : "legenda";
  return f;
}

const SIZE_GUIDE: Record<string, string> = {
  curto: "máximo 1-2 frases (se aplicável)",
  medio: "texto equilibrado, ~3-5 frases",
  longo: "texto completo e detalhado",
};

export async function generateCopy(
  userId: string,
  params: GenerateCopyParams
): Promise<string> {
  const provider = await getAIProvider();
  if (!provider) throw new AIConfiguredError();

  const ctx = await buildUserContext(userId);
  // Aceita tanto o vocabulário do motor quanto o do Preview Social.
  const format = normalizeFormat(params.platform, params.format);
  const formatLabel = FORMAT_LABEL[format] ?? format;
  const formatGuide = FORMAT_GUIDE[format] ?? "";

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
    formatGuide,
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
