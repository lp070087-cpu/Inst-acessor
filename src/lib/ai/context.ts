import { prisma } from "@/lib/db";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { ai } from "@/lib/ai/db";
import { describeSync } from "@/lib/dashboard/freshness";

/**
 * CONTEXTO DO USUÁRIO PARA A IA
 * =============================
 * Construído apenas com dados REAIS. Nada é inventado e — o ponto central —
 * NADA É CONVERTIDO EM ZERO POR AUSÊNCIA.
 *
 * Por que este arquivo foi reescrito
 * ----------------------------------
 * A versão anterior listava só os dados que existiam:
 *
 *   "Instagram: conectado, 813 seguidores (1 sincronizações)."
 *
 * Quando `mediaCount` era `null`, a linha simplesmente NÃO mencionava
 * publicações. O prompt, por sua vez, mandava o modelo separar "DADO REAL" e
 * dizia "se um dado não estiver listado, ele está indisponível" — mas o modelo
 * lia a ausência do campo como um fato medido, e respondia coisas como
 * "DADO REAL: o usuário tem 0 publicações no Instagram".
 *
 * Ausência de linha não é informação. Agora cada métrica é declarada
 * EXPLICITAMENTE com o seu estado, para que não haja inferência possível.
 *
 * Os quatro estados (mesma regra dos Blocos 1 e 2):
 *   ZERO        → a fonte confirmou zero. É um fato.
 *   NULL        → não temos o dado (nunca sincronizou / sem histórico).
 *   UNAVAILABLE → a API não disponibiliza esse dado.
 *   STALE       → temos dado real, mas está desatualizado.
 *
 * A IA NUNCA transforma os três últimos em "0".
 */

/** Como cada métrica se apresenta ao modelo. */
type MetricState = "zero" | "dado" | "ausente" | "indisponivel" | "desatualizado";

export interface MetricLine {
  label: string;
  /** Valor real confirmado. `null` quando não há número. */
  value: number | null;
  state: MetricState;
}

export interface UserContext {
  hasProfile: boolean;
  objective?: string | null;
  niche?: string | null;
  subNiche?: string | null;
  displayName?: string | null;
  instagramConnected: boolean;
  tiktokConnected: boolean;
  instagram: {
    followers?: number | null;
    media?: number | null;
    lastSync?: string | null;
    snapshotCount: number;
    /** Há pelo menos uma métrica real de mídia coletada (curtidas/comentários). */
    hasCollectedMedia: boolean;
    profileVisits?: number | null;
    reach7d?: number | null;
    impressions?: number | null;
    /** true = pelo menos 2 sincronizações (existe dimensão temporal). */
    hasHistory: boolean;
    /** Dado real porém antigo — sinaliza sem apagar. */
    stale: boolean;
  };
  tiktok: {
    followers?: number | null;
    videos?: number | null;
    lastSync?: string | null;
    snapshotCount: number;
    hasCollectedMedia: boolean;
    hasHistory: boolean;
    stale: boolean;
  };
  /** Score Inteligente — só entra quando é VÁLIDO (Bloco 2). */
  score: {
    available: boolean;
    overall: number | null;
    coverage: number | null;
    reason: string | null;
    pillars: { label: string; value: number | null }[];
  } | null;
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  const [ig, tt, mediaCount, scoreRow] = await Promise.all([
    getDashboardInstagramData(userId),
    getTikTokDashboardData(userId),
    // Quantas publicações a integração REALMENTE coletou (não quantas existem
    // no perfil). Serve para distinguir "não coletado" de "coletado e vazio".
    countInstagramMedia(userId),
    readLatestScore(userId),
  ]);

  const igSync = describeSync(ig.lastSyncAt ?? null);
  const ttSync = describeSync(tt.lastSyncAt ?? null);

  return {
    hasProfile: Boolean(profile),
    objective: profile?.objective ?? null,
    niche: profile?.niche ?? null,
    subNiche: profile?.subNiche ?? null,
    displayName: profile?.displayName ?? null,
    instagramConnected: ig.connected,
    tiktokConnected: tt.connected,
    instagram: {
      followers: ig.followersCount,
      media: ig.mediaCount,
      lastSync: ig.lastSyncAt?.toISOString() ?? null,
      snapshotCount: ig.snapshotCount,
      hasCollectedMedia: mediaCount != null && mediaCount > 0,
      profileVisits: ig.cards.profileViews.value,
      reach7d: ig.cards.reach7d.value,
      impressions: ig.cards.impressions.value,
      hasHistory: ig.snapshotCount >= 2,
      stale: igSync.stale,
    },
    tiktok: {
      followers: tt.followersCount,
      videos: tt.videoCount,
      lastSync: tt.lastSyncAt?.toISOString() ?? null,
      snapshotCount: tt.snapshotCount,
      hasCollectedMedia: tt.videoCount != null && tt.videoCount > 0,
      hasHistory: tt.snapshotCount >= 2,
      stale: ttSync.stale,
    },
    score: scoreRow,
  };
}

/**
 * Conta publicações REALMENTE coletadas da integração (linhas em
 * `InstagramMedia`), não a contagem que o perfil informa.
 *
 * Esta distinção é o coração da correção: o perfil pode dizer "412" e a
 * integração ter lido 0 publicações individuais — são informações diferentes.
 * Se a consulta falhar, devolve `null` (não sabemos), NUNCA 0.
 */
async function countInstagramMedia(userId: string): Promise<number | null> {
  try {
    return await prisma.instagramMedia.count({ where: { userId } });
  } catch {
    return null;
  }
}

/**
 * Último Score Inteligente SALVO, respeitando o Bloco 2.
 *
 * Só entra no contexto se tiver `overall` real e cobertura confirmada. Um Score
 * indisponível continua indisponível — nunca vira "Score 0".
 */
async function readLatestScore(userId: string): Promise<UserContext["score"]> {
  try {
    const row = await ai.score.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;

    const r = row as unknown as {
      overall: number | null;
      coverage?: number | null;
      factors?: { positive?: string[]; attention?: string[]; unavailable?: string[] } | null;
      growth?: number | null;
      engagement?: number | null;
      reach?: number | null;
      consistency?: number | null;
    };

    // Sem overall não existe Score publicado — não entra no contexto.
    if (r.overall == null) return null;

    const pillars = [
      { label: "Engajamento", value: r.engagement ?? null },
      { label: "Crescimento", value: r.growth ?? null },
      { label: "Alcance", value: r.reach ?? null },
      { label: "Consistência", value: r.consistency ?? null },
    ];

    const unavailable = r.factors?.unavailable ?? [];

    return {
      available: true,
      overall: r.overall,
      coverage: r.coverage ?? null,
      reason: unavailable.length > 0 ? unavailable.join("; ") : null,
      pillars,
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Texto para o prompt
// ------------------------------------------------------------

function stateLabel(m: MetricLine): string {
  switch (m.state) {
    case "zero":
      return `${m.label}: 0 (zero confirmado pela fonte)`;
    case "dado":
      return `${m.label}: ${m.value}`;
    case "desatualizado":
      return `${m.label}: ${m.value} — dado real, porém DESATUALIZADO (última sincronização antiga)`;
    case "indisponivel":
      return `${m.label}: NÃO DISPONÍVEL — a API da plataforma não fornece este dado`;
    default:
      return `${m.label}: NÃO TEMOS — ainda não foi coletado/sincronizado`;
  }
}

/**
 * Classifica uma métrica nos quatro estados.
 * `zero` só é afirmado quando o número real É zero.
 */
function classify(value: number | null | undefined, stale: boolean, available = true): MetricState {
  if (!available) return "indisponivel";
  if (value == null) return "ausente";
  if (value === 0) return "zero";
  return stale ? "desatualizado" : "dado";
}

/** Converte o contexto em texto legível para o prompt de sistema da IA. */
export function contextToPrompt(ctx: UserContext): string {
  const lines: string[] = [];

  // ---- Identidade / posicionamento (dados que o PRÓPRIO usuário informou) ----
  const who: string[] = [];
  if (ctx.displayName) who.push(`Nome: ${ctx.displayName}`);
  if (ctx.niche) who.push(`Nicho: ${ctx.niche}`);
  if (ctx.subNiche) who.push(`Subnicho: ${ctx.subNiche}`);
  if (ctx.objective) who.push(`Objetivo declarado: ${ctx.objective}`);
  if (who.length > 0) {
    lines.push("PERFIL DECLARADO PELO USUÁRIO:");
    lines.push(...who.map((w) => `• ${w}`));
  }

  // ---- Instagram ----
  lines.push("");
  if (!ctx.instagramConnected) {
    lines.push("INSTAGRAM: não conectado. Nenhuma métrica do Instagram existe.");
  } else {
    const stale = ctx.instagram.stale;
    lines.push("INSTAGRAM (métricas do perfil):");
    lines.push(
      "• " +
        stateLabel({
          label: "Seguidores",
          value: ctx.instagram.followers ?? null,
          state: classify(ctx.instagram.followers, stale),
        })
    );
    lines.push(
      "• " +
        stateLabel({
          label: "Publicações no perfil",
          value: ctx.instagram.media ?? null,
          state: classify(ctx.instagram.media, stale),
        })
    );
    lines.push(
      "• " +
        stateLabel({
          label: "Visitas ao perfil",
          value: ctx.instagram.profileVisits ?? null,
          state: classify(ctx.instagram.profileVisits, stale),
        })
    );
    lines.push(
      "• " +
        stateLabel({
          label: "Visualizações",
          value: ctx.instagram.impressions ?? null,
          state: classify(ctx.instagram.impressions, stale),
        })
    );
    lines.push(
      "• " +
        stateLabel({
          label: "Alcance somado dos últimos 7 dias",
          value: ctx.instagram.reach7d ?? null,
          state: classify(ctx.instagram.reach7d, stale),
        })
    );

    lines.push("");
    if (ctx.instagram.snapshotCount === 0) {
      lines.push(
        "• Histórico: NÃO TEMOS — nenhuma sincronização de dados aconteceu ainda."
      );
    } else if (!ctx.instagram.hasHistory) {
      lines.push(
        `• Histórico: apenas ${ctx.instagram.snapshotCount} sincronização — NÃO TEMOS dois pontos no tempo, portanto crescimento e tendência NÃO PODEM SER CALCULADOS.`
      );
    } else {
      lines.push(
        `• Histórico: ${ctx.instagram.snapshotCount} sincronizações — há dois ou mais pontos no tempo.`
      );
    }

    if (!ctx.instagram.hasCollectedMedia) {
      lines.push(
        "• Publicações individuais coletadas: NÃO TEMOS — nenhuma publicação foi lida da integração ainda. Isto NÃO significa que a conta não publica: significa que não sincronizamos. Nunca diga que o usuário tem 0 publicações por causa disto."
      );
    } else {
      lines.push(
        "• Publicações individuais coletadas: DISPONÍVEIS na integração (curtidas, comentários e views por publicação)."
      );
    }
  }

  // ---- TikTok ----
  lines.push("");
  if (!ctx.tiktokConnected) {
    lines.push("TIKTOK: não conectado. Nenhuma métrica do TikTok existe.");
  } else {
    const stale = ctx.tiktok.stale;
    lines.push("TIKTOK (métricas do perfil):");
    lines.push(
      "• " +
        stateLabel({
          label: "Seguidores",
          value: ctx.tiktok.followers ?? null,
          state: classify(ctx.tiktok.followers, stale),
        })
    );
    lines.push(
      "• " +
        stateLabel({
          label: "Vídeos",
          value: ctx.tiktok.videos ?? null,
          state: classify(ctx.tiktok.videos, stale),
        })
    );
    lines.push("");
    lines.push(
      ctx.tiktok.hasHistory
        ? `• Histórico: ${ctx.tiktok.snapshotCount} sincronizações.`
        : "• Histórico: insuficiente para calcular crescimento."
    );
  }

  // ---- Score Inteligente (só quando válido) ----
  lines.push("");
  if (!ctx.score || !ctx.score.available) {
    lines.push(
      "SCORE INTELIGENTE: NÃO DISPONÍVEL — ainda não há evidência suficiente para uma avaliação confiável. Não existe nota. NUNCA diga nem insinue que o Score é 0, nem que o desempenho é ruim, por causa disto."
    );
  } else {
    lines.push("SCORE INTELIGENTE (avaliação válida):");
    lines.push(
      `• Score Geral: ${ctx.score.overall}/100${ctx.score.coverage != null ? ` · cobertura dos dados: ${ctx.score.coverage}%` : ""}`
    );
    for (const p of ctx.score.pillars) {
      lines.push(`• ${p.label}: ${p.value == null ? "NÃO AVALIADO" : p.value}`);
    }
    if (ctx.score.coverage != null && ctx.score.coverage < 100) {
      lines.push(
        "• Atenção: a cobertura é parcial. Não apresente o Score como uma avaliação completa do desempenho."
      );
    }
  }

  return lines.join("\n");
}

/**
 * Bloco de regras que acompanha o contexto — a parte que impede a IA de
 * transformar ausência em zero e de expor a linguagem interna do prompt.
 */
export function absenceRules(): string {
  return [
    "COMO LER OS DADOS ACIMA (regra obrigatória):",
    "- \"NÃO TEMOS\" e \"NÃO DISPONÍVEL\" significam que o dado AUSENTE. Ausência NÃO é zero e NÃO é desempenho ruim.",
    "- Só existe \"0\" quando o texto disser explicitamente \"zero confirmado pela fonte\". Fora disso, NUNCA escreva que uma métrica é 0.",
    "- Nunca diga que o usuário tem 0 publicações, 0 seguidores, 0 alcance ou 0 engajamento porque um dado não aparece.",
    "- Quando faltar dado e isso importar para a resposta, diga em linguagem natural algo como \"ainda não tenho dados sincronizados suficientes para avaliar isso\" — no máximo uma vez, sem transformar a resposta em aviso.",
    "- Quando faltar dado e NÃO for importante para a pergunta, simplesmente não mencione. Não faça inventário do que falta.",
    "- Ausência de dado NÃO impede uma resposta útil: para perguntas de execução (como fazer, o que postar, como começar), responda com o conhecimento oficial normalmente.",
    "- NUNCA invente tendências: nada de \"esse áudio está viral\", \"essa hashtag está em alta\", \"esse formato está bombando\". O sistema não mede tendências externas.",
    "- Nunca calcule nem estime métricas novas a partir das existentes (ex.: não estime alcance a partir dos seguidores).",
  ].join("\n");
}
