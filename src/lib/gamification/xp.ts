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
