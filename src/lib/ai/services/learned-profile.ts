import { ai } from "@/lib/ai/db";
import { prisma } from "@/lib/db";
import { settings } from "@/lib/admin/settings-db";
import { getAIProvider, isAIConfigured } from "@/lib/ai";
import {
  buildKnowledgeContext,
  knowledgeContextToPrompt,
} from "@/lib/knowledge/context-builder";
import {
  listInsights,
  discoverObservedPatterns,
  createInsight,
} from "@/lib/knowledge/patterns";
import { getAIProfile, type AIProfileData } from "./profile";
import { withUsage } from "@/lib/billing/usage/meter";

/**
 * "A IA APRENDEU SOBRE VOCÊ" — LEITURA E APRENDIZADO
 * ===================================================
 * Vive DENTRO do Perfil de Inteligência (nenhuma aba nova no menu).
 *
 * Regra de ouro desta camada: só mostramos o que os DADOS REAIS sustentam.
 * Nada de métrica ou análise inventada. Quando não existe fonte para um card
 * (ex.: público-alvo, estilo visual), o card apresenta um estado explícito de
 * "ainda não temos dados" — nunca um valor de encomenda.
 *
 * Fontes reais usadas:
 *  - `AIProfile`          → o que a IA/usuário já registrou (por usuário).
 *  - `UserProfile`        → nicho/objetivo DECLARADOS no onboarding.
 *  - `ProfileInsight`     → padrões observados persistidos (por usuário).
 *  - `InstagramMedia`     → legendas e datas reais coletadas da integração.
 *  - IA (provider ativo)  → reescreve o que os dados acima já mostram.
 *
 * Tudo é PRIVADO por `userId`. Nunca se lê nem grava de outro usuário.
 */

/** Campos editáveis/corrigíveis de `AIProfile`. */
export type AIProfileField =
  | "summary"
  | "niche"
  | "subNiche"
  | "objectives"
  | "communicationStyle"
  | "observedPatterns"
  | "preferredFormats"
  | "ctaPatterns"
  | "hookPatterns"
  | "postingFrequency"
  | "voiceTone"
  | "writingStyle"
  | "notes";

/** De onde veio o valor exibido em um card (honestidade da origem). */
export type LearnedSource = "ai" | "declared" | "observed" | "user";

export interface LearnedCard {
  /** Identificador estável (usado como key de render). */
  key: string;
  label: string;
  /** Campo de `AIProfile` que este card edita — ausente quando não editável. */
  field?: AIProfileField;
  /** Valor real. `null` = não temos dado suficiente (estado honesto). */
  value: string | null;
  source: LearnedSource;
  /** Explicação do estado vazio, quando `value` é `null`. */
  emptyReason?: string;
  editable: boolean;
}

export interface LearnedProfileData {
  cards: LearnedCard[];
  /** Todos os campos de `AIProfile` (para a seção de campos adicionais). */
  profileFields: Record<AIProfileField, string>;
  /** ISO da última execução do aprendizado (ou `null`). */
  learnedAt: string | null;
  /** Próximo instante permitido para novo aprendizado (ou `null`). */
  nextAllowedAt: string | null;
  /** A IA está configurada? (banco do Admin ou env). */
  aiConfigured: boolean;
  /** Intervalo mínimo entre aprendizados, em ms (para o cliente calcular). */
  minIntervalMs: number;
  /** Existe algum dado real que a IA possa aprender? */
  hasAnyData: boolean;
}

/** Intervalo mínimo entre aprendizados: 6 horas. */
export const LEARN_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Tetos de tamanho por campo (mesmos da validação de correção). */
const MAXLEN: Record<AIProfileField, number> = {
  summary: 2000,
  niche: 200,
  subNiche: 200,
  objectives: 300,
  communicationStyle: 300,
  observedPatterns: 1200,
  preferredFormats: 300,
  ctaPatterns: 300,
  hookPatterns: 300,
  postingFrequency: 200,
  voiceTone: 200,
  writingStyle: 300,
  notes: 1000,
};

/** Campos que o aprendizado SEMPRE reescreve (são o relato da própria IA). */
const AI_OVERWRITE_FIELDS: AIProfileField[] = ["summary", "observedPatterns"];

/** Campos que o aprendizado só preenche quando estão VAZIOS (não sobrescreve
 *  uma correção manual do usuário). */
const AI_FILL_IF_EMPTY_FIELDS: AIProfileField[] = [
  "niche",
  "subNiche",
  "objectives",
  "communicationStyle",
  "preferredFormats",
  "ctaPatterns",
  "hookPatterns",
  "postingFrequency",
  "voiceTone",
  "writingStyle",
  "notes",
];

/** Campos "extras" exibidos fora dos cards principais. */
export const EXTRA_FIELDS: { field: AIProfileField; label: string }[] = [
  { field: "subNiche", label: "Subnicho" },
  { field: "objectives", label: "Objetivos" },
  { field: "communicationStyle", label: "Estilo de comunicação" },
  { field: "notes", label: "Anotações" },
];

const ALL_PROFILE_FIELDS: AIProfileField[] = [
  "summary",
  "niche",
  "subNiche",
  "objectives",
  "communicationStyle",
  "observedPatterns",
  "preferredFormats",
  "ctaPatterns",
  "hookPatterns",
  "postingFrequency",
  "voiceTone",
  "writingStyle",
  "notes",
];

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

// ------------------------------------------------------------
// learnedAt — persistido em SystemSetting (SEM migration)
// ------------------------------------------------------------

/** Chave POR USUÁRIO. O prefixo garante que ninguém lê o timestamp de outro. */
function learnedAtKey(userId: string): string {
  return `ai.profile.learnedAt:${userId}`;
}

/** Lê o instante do último aprendizado. Nunca lança. */
export async function getLearnedAt(userId: string): Promise<Date | null> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: learnedAtKey(userId) },
    })) as unknown as { value: string | null } | null;
    if (!row?.value) return null;
    const d = new Date(row.value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Grava o instante do último aprendizado. */
async function setLearnedAt(userId: string, at: Date): Promise<void> {
  const key = learnedAtKey(userId);
  const value = at.toISOString();
  await settings.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

// ------------------------------------------------------------
// Dados reais auxiliares
// ------------------------------------------------------------

/**
 * Frequência REAL observada a partir das publicações individuais coletadas da
 * integração (`InstagramMedia.timestamp`). Devolve `null` quando NÃO há
 * publicações coletadas — ausência de dado nunca vira "0 publicações".
 */
async function collectMediaFrequency(
  userId: string
): Promise<{ total: number; last30: number; last90: number } | null> {
  try {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since90 = new Date(Date.now() - 90 * 86_400_000);
    const [total, last30, last90] = await Promise.all([
      prisma.instagramMedia.count({ where: { userId } }),
      prisma.instagramMedia.count({
        where: { userId, timestamp: { gte: since30 } },
      }),
      prisma.instagramMedia.count({
        where: { userId, timestamp: { gte: since90 } },
      }),
    ]);
    if (total === 0) return null;
    return { total, last30, last90 };
  } catch {
    return null;
  }
}

async function collectMediaSample(userId: string): Promise<
  { caption: string; productType: string | null; mediaType: string | null }[]
> {
  try {
    const rows = await prisma.instagramMedia.findMany({
      where: { userId, caption: { not: null } },
      orderBy: { timestamp: "desc" },
      take: 12,
      select: { caption: true, mediaProductType: true, mediaType: true },
    });
    return rows
      .filter((r) => clean(r.caption))
      .map((r) => ({
        caption: (r.caption ?? "").trim(),
        productType: r.mediaProductType ?? null,
        mediaType: r.mediaType ?? null,
      }));
  } catch {
    return [];
  }
}

// ------------------------------------------------------------
// Montagem dos cards (somente dados reais)
// ------------------------------------------------------------

function reactionValue(insights: { platform: string; summary: string; confidence?: string | null }[]): string | null {
  if (insights.length === 0) return null;
  const PLATFORM_LABEL: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
  };
  return insights
    .slice(0, 8)
    .map((i) => {
      const p = PLATFORM_LABEL[i.platform] ?? i.platform;
      const c = i.confidence ? ` (confiança: ${i.confidence})` : "";
      return `• [${p}] ${i.summary}${c}`;
    })
    .join("\n");
}

export async function getLearnedProfile(userId: string): Promise<LearnedProfileData> {
  const [profile, userProfile, igInsights, ttInsights, learnedAt, aiConfigured, freq] =
    await Promise.all([
      getAIProfile(userId),
      prisma.userProfile.findUnique({ where: { userId } }).catch(() => null),
      listInsights(userId, "instagram").catch(() => []),
      listInsights(userId, "tiktok").catch(() => []),
      getLearnedAt(userId),
      isAIConfigured(),
      collectMediaFrequency(userId),
    ]);

  const p = (profile ?? null) as AIProfileData | null;

  const profileFields = ALL_PROFILE_FIELDS.reduce(
    (acc, f) => {
      acc[f] = (p?.[f] ?? "") as string;
      return acc;
    },
    {} as Record<AIProfileField, string>
  );

  const insights = [...igInsights, ...ttInsights];

  const declaredNiche = clean(userProfile?.niche);
  const aiNiche = clean(p?.niche);

  const frequencyObserved = freq
    ? `${freq.last30} publicação(ões) coletada(s) nos últimos 30 dias · ${freq.last90} nos últimos 90 dias · ${freq.total} no total (observado a partir das publicações sincronizadas).`
    : null;

  const cards: LearnedCard[] = [
    {
      key: "summary",
      label: "Resumo do perfil",
      field: "summary",
      value: clean(p?.summary),
      source: "ai",
      editable: true,
      emptyReason:
        "A IA ainda não gerou um resumo. Use o botão “Atualizar aprendizado” para que ela escreva um resumo a partir dos seus dados reais.",
    },
    {
      key: "audience",
      label: "Público-alvo",
      value: null,
      source: "observed",
      editable: false,
      emptyReason:
        "Ainda não temos dados suficientes. A API do Instagram não fornece demografia dos seguidores e nenhuma fonte de público é coletada hoje — não há como inferir isso sem inventar.",
    },
    {
      key: "niche",
      label: "Nicho",
      field: "niche",
      value: aiNiche ?? declaredNiche,
      source: aiNiche ? "ai" : "declared",
      editable: true,
      emptyReason:
        "Nenhum nicho foi informado no seu perfil nem aprendido ainda. Você pode definir o seu nicho aqui.",
    },
    {
      key: "voiceTone",
      label: "Tom de voz",
      field: "voiceTone",
      value: clean(p?.voiceTone),
      source: "ai",
      editable: true,
      emptyReason:
        "Ainda não temos dados suficientes. Atualize o aprendizado após a IA analisar suas legendas e padrões reais.",
    },
    {
      key: "writingStyle",
      label: "Estilo de escrita",
      field: "writingStyle",
      value: clean(p?.writingStyle),
      source: "ai",
      editable: true,
      emptyReason:
        "Ainda não temos dados suficientes. O estilo é aprendido a partir das suas legendas coletadas.",
    },
    {
      key: "ctaPatterns",
      label: "CTAs",
      field: "ctaPatterns",
      value: clean(p?.ctaPatterns),
      source: "ai",
      editable: true,
      emptyReason:
        "Ainda não temos dados suficientes sobre chamadas para ação nos seus conteúdos.",
    },
    {
      key: "preferredFormats",
      label: "Melhores formatos",
      field: "preferredFormats",
      value: clean(p?.preferredFormats),
      source: "ai",
      editable: true,
      emptyReason:
        "Ainda não temos dados suficientes. Os formatos são inferidos dos formatos reais já coletados.",
    },
    {
      key: "postingFrequency",
      label: "Frequência",
      field: "postingFrequency",
      value: frequencyObserved ?? clean(p?.postingFrequency),
      source: frequencyObserved ? "observed" : "ai",
      editable: true,
      emptyReason:
        "Nenhuma publicação individual foi coletada da integração ainda. Ausência de dado não significa que você não publica.",
    },
    {
      key: "hookPatterns",
      label: "Hooks",
      field: "hookPatterns",
      value: clean(p?.hookPatterns),
      source: "ai",
      editable: true,
      emptyReason:
        "Ainda não temos dados suficientes sobre os ganchos de abertura dos seus conteúdos.",
    },
    {
      key: "audienceReaction",
      label: "Reação do público",
      value: reactionValue(insights),
      source: "observed",
      editable: false,
      emptyReason:
        "Ainda não há padrões observados salvos. Eles vêm apenas de dados reais de desempenho e aparecem após sincronizações suficientes e uma atualização de aprendizado.",
    },
    {
      key: "visualStyle",
      label: "Estilo visual",
      value: null,
      source: "observed",
      editable: false,
      emptyReason:
        "Ainda não temos dados suficientes. Nenhuma análise de cor, composição ou identidade visual é feita sobre as suas mídias hoje.",
    },
    {
      key: "performancePatterns",
      label: "Padrões de desempenho",
      field: "observedPatterns",
      value: clean(p?.observedPatterns),
      source: "ai",
      editable: true,
      emptyReason:
        "Ainda não temos dados suficientes. Os padrões de desempenho são escritos pela IA a partir de métricas e insights reais — nunca estimados.",
    },
  ];

  const nextAllowedAt = learnedAt
    ? new Date(learnedAt.getTime() + LEARN_MIN_INTERVAL_MS).toISOString()
    : null;

  const hasAnyData = Boolean(
    clean(p?.summary) ||
      clean(p?.niche) ||
      declaredNiche ||
      clean(p?.voiceTone) ||
      clean(p?.writingStyle) ||
      insights.length > 0 ||
      freq != null
  );

  return {
    cards,
    profileFields,
    learnedAt: learnedAt ? learnedAt.toISOString() : null,
    nextAllowedAt,
    aiConfigured,
    minIntervalMs: LEARN_MIN_INTERVAL_MS,
    hasAnyData,
  };
}

// ------------------------------------------------------------
// Aprendizado (execução manual pelo usuário)
// ------------------------------------------------------------

export interface LearnSuccess {
  ok: true;
  learnedAt: string;
  /** Campos efetivamente gravados em `AIProfile`. */
  fieldsFilled: AIProfileField[];
  /** Quantos padrões observados reais foram persistidos nesta execução. */
  patternsAdded: number;
  summary: string | null;
}

export interface LearnFailure {
  ok: false;
  reason: "not_configured" | "too_soon" | "error";
  message: string;
  nextAllowedAt?: string;
}

export type LearnResult = LearnSuccess | LearnFailure;

/** Extrai um objeto JSON de uma resposta do modelo, com tolerância. */
function parseAIJson(text: string): Record<string, string> {
  if (!text) return {};
  let s = text.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    const obj = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") out[k] = v;
      else if (v != null && typeof v !== "object") out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Executa o aprendizado do perfil:
 *  1. exige a IA configurada (senão devolve `not_configured`);
 *  2. respeita o intervalo mínimo (senão devolve `too_soon` + próximo instante);
 *  3. persiste os padrões OBSERVED determinísticos derivados de dados reais;
 *  4. pede à IA um resumo conciso APENAS a partir dos dados reais e grava em
 *     `AIProfile` (reescreve summary/observedPatterns; preenche os demais só
 *     quando vazios, para não apagar correções manuais);
 *  5. grava `learnedAt` (SystemSetting, por usuário).
 */
export async function runProfileLearning(userId: string): Promise<LearnResult> {
  if (!(await isAIConfigured())) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "A IA ainda não foi configurada. Peça ao administrador para ativar o provedor de IA para usar o aprendizado.",
    };
  }

  const last = await getLearnedAt(userId);
  if (last) {
    const next = new Date(last.getTime() + LEARN_MIN_INTERVAL_MS);
    if (Date.now() < next.getTime()) {
      return {
        ok: false,
        reason: "too_soon",
        nextAllowedAt: next.toISOString(),
        message: `Você já atualizou o aprendizado há pouco. Para controlar custo, aguarde até ${new Intl.DateTimeFormat(
          "pt-BR",
          { dateStyle: "short", timeStyle: "short" }
        ).format(next)}.`,
      };
    }
  }

  const provider = await getAIProvider();
  if (!provider) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "A IA ainda não foi configurada. Peça ao administrador para ativar o provedor de IA para usar o aprendizado.",
    };
  }

  const [ctx, igInsights, ttInsights, mediaSample, freq] = await Promise.all([
    buildKnowledgeContext(userId, {
      query:
        "perfil resumo nicho tom de voz estilo de escrita cta gancho hook formato frequencia padroes conteudo",
      platform: "instagram",
    }),
    listInsights(userId, "instagram").catch(() => []),
    listInsights(userId, "tiktok").catch(() => []),
    collectMediaSample(userId),
    collectMediaFrequency(userId),
  ]);

  // 1) Persistir padrões observados determinísticos (dados reais).
  let patternsAdded = 0;
  const knownSummaries = new Set([
    ...igInsights.map((i) => i.summary),
    ...ttInsights.map((i) => i.summary),
  ]);
  for (const platform of ["instagram", "tiktok"] as const) {
    try {
      const found = await discoverObservedPatterns(userId, platform);
      for (const pat of found) {
        if (knownSummaries.has(pat.summary)) continue;
        const created = await createInsight(userId, {
          platform,
          type: "OBSERVED",
          summary: pat.summary,
          detail: pat.detail,
          ruleSlug: pat.ruleSlug,
          confidence: pat.confidence,
        });
        if (created) {
          patternsAdded += 1;
          knownSummaries.add(pat.summary);
        }
      }
    } catch {
      // Sem dados/histórico suficiente para esta plataforma — segue em frente.
    }
  }

  // 2) Bloco de dados reais para o prompt.
  const mediaBlock =
    mediaSample.length > 0
      ? [
          "LEGENDAS REAIS COLETADAS DA INTEGRAÇÃO (amostra):",
          ...mediaSample.map((m, i) => {
            const type = m.productType ?? m.mediaType ?? "tipo não informado";
            const cap = m.caption.length > 240 ? `${m.caption.slice(0, 240)}…` : m.caption;
            return `${i + 1}. [${type}] ${cap}`;
          }),
        ].join("\n")
      : "LEGENDAS REAIS COLETADAS: NENHUMA — não sincronize publicações individuais ainda. Não é possível inferir tom/estilo a partir de legendas.";

  const freqBlock = freq
    ? `FREQUÊNCIA OBSERVADA (a partir de publicações sincronizadas): ${freq.last30} nos últimos 30 dias; ${freq.last90} nos últimos 90 dias; ${freq.total} no total.`
    : "FREQUÊNCIA OBSERVADA: NÃO TEMOS — nenhuma publicação individual foi coletada. NÃO escreva que o usuário publica X vezes: não sabemos.";

  const system = [
    "Você é a IA Acessor. Sua tarefa é RESUmir, de forma concisa, o que os DADOS REAIS do usuário já mostram sobre o perfil dele.",
    "REGRA ABSOLUTA: use SOMENTE os dados reais fornecidos abaixo. NUNCA invente números, tendências, demografia, cores, estilos ou causalidade.",
    "Se um campo NÃO tiver base nos dados reais, devolva string vazia para ele. Admitir ausência é obrigatório — nunca preencha por suposição.",
    "Observação não é certeza: trate padrões observados como associação, não como causa.",
    "Responda SOMENTE com um objeto JSON válido, sem qualquer texto fora do JSON, com exatamente estas chaves:",
    'summary, niche, subNiche, objectives, communicationStyle, preferredFormats, ctaPatterns, hookPatterns, postingFrequency, voiceTone, writingStyle, notes, observedPatterns.',
    "Cada valor é uma frase curta em português (ou string vazia). 'summary' é um parágrafo de 2 a 4 frases sobre o que foi aprendido; 'observedPatterns' lista em texto os padrões observados nos dados.",
    "",
    "--- DADOS REAIS DO USUÁRIO ---",
    knowledgeContextToPrompt(ctx),
    "",
    mediaBlock,
    "",
    freqBlock,
    "--- FIM DOS DADOS REAIS ---",
  ].join("\n");

  const userPrompt =
    "Gere o JSON do perfil aprendido usando APENAS os dados reais acima. Deixe vazio todo campo sem base real.";

  let completion = "";
  try {
    // MEDIÇÃO: envolvemos a MESMA chamada `provider.complete` (nenhuma chamada
    // nova). `withUsage` reserva a unidade e só grava o log após o sucesso.
    const metered = await withUsage(
      { userId, feature: "ai_generation", origin: "perfil-aprendido" },
      () =>
        provider.complete({
          system,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.2,
          maxTokens: 900,
        })
    );
    if (!metered.ok) throw new Error("QUOTA_EXCEDIDA");
    completion = metered.value;
  } catch (err) {
    console.error("[learned-profile] falha na IA", err);
    return {
      ok: false,
      reason: "error",
      message: "Não foi possível falar com a IA agora. Tente novamente em instantes.",
    };
  }

  const parsed = parseAIJson(completion);

  // 3) Persistir em AIProfile.
  const existing = (await ai.profile.findUnique({
    where: { userId },
  })) as unknown as AIProfileData | null;

  const data: Record<string, string> = {};
  const fieldsFilled: AIProfileField[] = [];

  for (const field of [...AI_OVERWRITE_FIELDS, ...AI_FILL_IF_EMPTY_FIELDS]) {
    const raw = (parsed[field] ?? "").trim();
    if (!raw) continue;
    const value = raw.slice(0, MAXLEN[field]);
    if (AI_OVERWRITE_FIELDS.includes(field)) {
      data[field] = value;
      fieldsFilled.push(field);
    } else {
      const current = clean((existing?.[field] as string | null) ?? null);
      if (!current) {
        data[field] = value;
        fieldsFilled.push(field);
      }
    }
  }

  if (Object.keys(data).length > 0) {
    if (existing) {
      await ai.profile.update({ where: { userId }, data });
    } else {
      await ai.profile.create({ data: { userId, ...data } });
    }
  }

  const learnedAt = new Date();
  await setLearnedAt(userId, learnedAt);

  return {
    ok: true,
    learnedAt: learnedAt.toISOString(),
    fieldsFilled,
    patternsAdded,
    summary: data.summary ?? null,
  };
}
