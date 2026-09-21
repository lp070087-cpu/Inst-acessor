import { gp } from "@/lib/gamification/db";

/**
 * MOTOR DE XP — Fase 5
 * =====================
 * Concede XP por AÇÕES REAIS, de forma IDEMPOTENTE (nunca duas vezes pela
 * mesma ação), recalcula nível e mantém auditoria completa em XpLog.
 *
 * Regras (Knowledge Engine — Módulo 28):
 * - XP ~5–100 conforme dificuldade (valores versionáveis por fonte).
 * - Mesmo `source + refId` só concede XP UMA vez (anti-duplicidade real).
 * - Toda concessão fica registrada em XpLog (histórico/auditoria).
 */

export const XP_VALUES: Record<string, number> = {
  "salvar-copy": 10,
  "gerar-copy": 5,
  "salvar-ideia": 10,
  "gerar-ideia": 5,
  "criar-rascunho": 10,
  "analisar-desempenho": 10,
  "calcular-score": 15,
  "executar-recomendacao": 40,
  "completar-experimento": 50,
  "concluir-meta": 35,
  "sincronizar-instagram": 15,
  "sincronizar-tiktok": 15,
  "concluir-onboarding": 20,
  "melhorar-perfil": 15,
  "planejar-conteudo": 10, // Fase 6: criar/duplicar conteúdo no calendário
  "conquista-desbloqueada": 0, // XP real vem do xpReward da conquista (5–100)
  "concluir-acao-crescimento": 15, // Fase 8: concluir GrowthAction real
  // Rodada #274 — Impulso/Ritmo: XP por metas prontas batidas (por período).
  // Valores "exibição/validação" — a concessão real usa o xp por faixa/bando
  // (RITMO_BANDS), sempre com grantXpAmount e amount explícito.
  "ritmo-seguidores": 10,
  "ritmo-ideias": 8,
  "ritmo-copy": 8,
  "ritmo-ia": 10,
  "ritmo-publicar": 12,
  "ritmo-alcance": 30,
  "ritmo-engajamento": 30,
  "ritmo-crescimento": 100,
  "streak-bonus": 0, // XP real varia por marco (3/7/15/30 dias → 20/50/120/300)
};

/** Fontes válidas para validação em APIs. */
export const XP_SOURCES = Object.keys(XP_VALUES);

/**
 * RefId estável a partir de um conteúdo (para ações sem id persistido,
 * ex.: "gerar copy/ideia"). Determinístico: o MESMO conteúdo gera o MESMO
 * refId — a mesma ação nunca concede XP duas vezes.
 */
export function stableRefId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36) + "-" + input.length.toString(36);
}

/** Retorna o XP configurado para uma fonte (fallback seguro). */
export function xpForSource(source: string): number {
  return XP_VALUES[source] ?? 5;
}

// ------------------------------------------------------------
// Curva de nível — progressão
// ------------------------------------------------------------

/** XP necessário para ir do nível `level` ao `level + 1`. */
export function xpToNextLevel(level: number): number {
  // Base 100; cresce 25 por nível. Nível 1→2 = 100, 2→3 = 125, ...
  return 100 + (level - 1) * 25;
}

/** XP necessário para chegar ao nível dado (soma da curva). */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNextLevel(l);
  return total;
}

// ------------------------------------------------------------
// NÍVEIS GERAIS (faixas) — progressão por XP acumulado
// ------------------------------------------------------------

/**
 * FAIXAS GERAIS DE RANK.
 *
 * Regra de produto: o rank GERAL tem EXATAMENTE 5 faixas — Bronze, Prata,
 * Ouro, Diamante e Lendário. São faixas de XP ACUMULADO (`totalXpEarned`), não
 * níveis numéricos: o mesmo XP que antes só virava "Nível N" agora também
 * posiciona o usuário numa faixa nomeada.
 *
 * Os limiares são EXATAMENTE os já anunciados na landing
 * (`src/components/landing/sections-c.tsx`, seção "Badges e troféus"):
 * 1.000 / 2.500 / 5.000 / 10.000 / 20.000 XP. Antes desta rodada eram promessa
 * de marketing sem lastro em nenhum cálculo do app; agora são reais.
 *
 * Abaixo de 1.000 XP o usuário está ANTES do Bronze — não existe uma 6ª faixa
 * inventada para preencher ("Iniciante" etc.). O Rank mostra a distância real
 * até o Bronze. NUNCA inflar o nível do usuário para ele "ter" uma faixa.
 *
 * Estas faixas NÃO substituem os tiers das conquistas individuais
 * (`Achievement.tier`), que continuam sendo um sistema separado.
 *
 * Módulo PURO (sem banco): pode ser espelhado no Client Component do Rank.
 */
export const RANK_TIERS = [
  { key: "BRONZE", label: "Bronze", minXp: 1000 },
  { key: "PRATA", label: "Prata", minXp: 2500 },
  { key: "OURO", label: "Ouro", minXp: 5000 },
  { key: "DIAMANTE", label: "Diamante", minXp: 10000 },
  { key: "LENDARIO", label: "Lendário", minXp: 20000 },
] as const;

export type RankTierKey = (typeof RANK_TIERS)[number]["key"];

export interface RankTierInfo {
  /**
   * `null` quando o XP ainda não alcançou o Bronze. Nunca uma faixa inventada.
   */
  key: RankTierKey | null;
  /** Rótulo exibido. `null` antes do Bronze. */
  label: string | null;
  /** Índice 0–4 (Bronze→Lendário). `-1` antes do Bronze. */
  index: number;
  /** Faixa mínima de XP da faixa alcançada. `null` antes do Bronze. */
  minXp: number | null;
  /** Faixa seguinte (`null` no topo ou antes do Bronze... ver `nextMinXp`). */
  nextMinXp: number | null;
  /** Rótulo da faixa seguinte. `null` no topo (Lendário). */
  nextLabel: string | null;
  /** XP que falta para a PRÓXIMA faixa. `null` no topo (Lendário). */
  xpToNextTier: number | null;
  /** Progresso 0–100 rumo à próxima faixa. `null` no topo (Lendário). */
  progressToNextTier: number | null;
  /** XP total acumulado (entrada). */
  xp: number;
}

/**
 * Resolve a faixa geral a partir do XP acumulado.
 *
 * Semântica dos limites (importante, é o que aparece na tela):
 * - 0..999          → nenhuma faixa; falta `1000 - xp` para o Bronze.
 * - 1.000..2.499    → Bronze; progresso é quanto falta para o Prata.
 * - 20.000+         → Lendário; topo, sem próxima faixa (progresso `null`).
 *
 * No topo NÃO sintetizamos 100% nem 0%: as duas coisas afirmariam algo falso
 * (que ainda há o que subir, ou que nada foi conquistado).
 */
export function rankTierFromXp(totalXp: number): RankTierInfo {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;

  let index = -1;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (xp >= RANK_TIERS[i].minXp) index = i;
  }

  const base: Omit<RankTierInfo, "key" | "label" | "index" | "minXp"> = {
    nextMinXp: null,
    nextLabel: null,
    xpToNextTier: null,
    progressToNextTier: null,
    xp,
  };

  // Ainda não alcançou o Bronze.
  if (index < 0) {
    const first = RANK_TIERS[0];
    return {
      ...base,
      key: null,
      label: null,
      index: -1,
      minXp: null,
      nextMinXp: first.minXp,
      nextLabel: first.label,
      xpToNextTier: first.minXp - xp,
    };
  }

  const tier = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1] ?? null;

  if (!next) {
    return {
      ...base,
      key: tier.key,
      label: tier.label,
      index,
      minXp: tier.minXp,
    };
  }

  const span = next.minXp - tier.minXp;
  const inTier = Math.max(0, xp - tier.minXp);

  return {
    ...base,
    key: tier.key,
    label: tier.label,
    index,
    minXp: tier.minXp,
    nextMinXp: next.minXp,
    nextLabel: next.label,
    xpToNextTier: Math.max(0, next.minXp - xp),
    progressToNextTier:
      span > 0 ? Math.min(100, Math.round((inTier / span) * 10000) / 100) : null,
  };
}

export interface LevelInfo {
  level: number;
  xp: number;
  totalXpEarned: number;
  /** XP dentro do nível atual (0..xpNeededForNext). */
  xpInLevel: number;
  /** XP necessário para subir do nível atual. */
  xpNeededForNext: number;
  /** Progresso 0–100 em direção ao próximo nível. */
  progressToNext: number;
  /** Fracassou? Não. */
  xpTotal: number;
}

/** Calcula nível e progresso a partir do XP total. */
export function levelInfoFromXp(totalXp: number): {
  level: number;
  xpInLevel: number;
  xpNeededForNext: number;
} {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return {
    level,
    xpInLevel: remaining,
    xpNeededForNext: xpToNextLevel(level),
  };
}

// ------------------------------------------------------------
// Garantir linha UserLevel
// ------------------------------------------------------------

async function ensureLevel(userId: string) {
  const existing = await gp.level.findUnique({ where: { userId } });
  if (existing) return existing as { xp: number; level: number; totalXpEarned: number };
  const created = await gp.level.create({
    data: { userId, xp: 0, level: 1, totalXpEarned: 0 },
  });
  return created as { xp: number; level: number; totalXpEarned: number };
}

// ------------------------------------------------------------
// Concessão idempotente de XP
// ------------------------------------------------------------

export interface GrantResult {
  granted: boolean;
  amount: number;
  level: number;
  levelUp: boolean;
  totalXp: number;
  alreadyGranted: boolean;
}

/**
 * Concede XP por uma ação real, com valor explícito. Idempotente:
 * se `userId + source + refId` já existir em XpLog, NÃO concede de novo.
 */
export async function grantXpAmount(
  userId: string,
  source: string,
  refId: string,
  amount: number
): Promise<GrantResult> {

  // Idempotência: procura antes de criar (evita corrida de duplicidade).
  const existing = await gp.xpLog.findUnique({
    where: { userId_source_refId: { userId, source, refId } },
  });
  if (existing) {
    const lvl = await ensureLevel(userId);
    return {
      granted: false,
      amount,
      level: lvl.level,
      levelUp: false,
      totalXp: lvl.xp,
      alreadyGranted: true,
    };
  }

  // Auditoria da concessão (antes de atualizar o nível — atomicidade lógica).
  await gp.xpLog.create({
    data: { userId, source, refId, amount },
  });

  // Atualiza XP total e recalcula nível.
  const current = await ensureLevel(userId);
  const newTotal = current.xp + amount;
  const { level: newLevel } = levelInfoFromXp(newTotal);
  const leveledUp = newLevel > current.level;

  await gp.level.update({
    where: { userId },
    data: {
      xp: newTotal,
      level: newLevel,
      totalXpEarned: current.totalXpEarned + amount,
      ...(leveledUp ? { lastLevelUpAt: new Date() } : {}),
    },
  });

  return {
    granted: true,
    amount,
    level: newLevel,
    levelUp: leveledUp,
    totalXp: newTotal,
    alreadyGranted: false,
  };
}

/**
 * Concede XP por uma ação real usando o valor padrão da tabela XP_VALUES.
 * Idempotente: se `userId + source + refId` já existir, NÃO concede de novo.
 */
export async function grantXp(
  userId: string,
  source: string,
  refId: string
): Promise<GrantResult> {
  return grantXpAmount(userId, source, refId, xpForSource(source));
}

// ------------------------------------------------------------
// Leitura do estado do usuário
// ------------------------------------------------------------

export interface UserProgress {
  levelInfo: LevelInfo;
  /**
   * Faixa geral (Bronze→Lendário) derivada do XP acumulado.
   * Aditivo: `levelInfo` continua exatamente como era.
   */
  rankTier: RankTierInfo;
  xpLogs: {
    source: string;
    refId: string;
    amount: number;
    createdAt: Date;
  }[];
}

/** Lê o estado completo de XP do usuário (nível + auditoria recente). */
export async function getUserProgress(userId: string): Promise<UserProgress> {
  const lvl = await ensureLevel(userId);
  const { level, xpInLevel, xpNeededForNext } = levelInfoFromXp(lvl.xp);
  const logs = await gp.xpLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const progress = (xpInLevel / xpNeededForNext) * 100;
  return {
    levelInfo: {
      level,
      xp: lvl.xp,
      totalXpEarned: lvl.totalXpEarned,
      xpInLevel,
      xpNeededForNext,
      progressToNext: Math.min(100, Math.round(progress * 100) / 100),
      xpTotal: lvl.xp,
    },
    // Faixa geral calculada sobre o XP ACUMULADO (`totalXpEarned`), que é a
    // mesma base dos limiares da landing — não sobre `lvl.xp` (XP do nível).
    rankTier: rankTierFromXp(lvl.totalXpEarned),
    xpLogs: (logs as { source: string; refId: string; amount: number; createdAt: Date }[]).map(
      (l) => ({
        source: l.source,
        refId: l.refId,
        amount: l.amount,
        createdAt: l.createdAt,
      })
    ),
  };
}
