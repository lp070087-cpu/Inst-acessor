import { prisma } from "@/lib/db";

import { quotaForPlan, evaluateQuota, type QuotaFeature, type QuotaDecision } from "@/lib/billing/plans/limits";
import { loadQuotaOverrides } from "@/lib/billing/plans/limits-db";
import { cycleKey, saoPauloDayKey, nextDailyReset } from "./periods";

/**
 * MEDIDOR DE CONSUMO (server-side)
 * ================================
 * REGRA CENTRAL: a contabilização acontece SEMPRE no servidor. O navegador pode
 * exibir o saldo, mas nunca é a autoridade — um cliente adulterado não consome
 * crédito nem escapa do limite.
 *
 * Todo acesso ao banco aqui é por `prisma` tipado com cast (padrão do projeto
 * para models novos, antes do `prisma generate`).
 */

interface UsageCounterRow {
  id: string;
  feature: string;
  window: string;
  key: string;
  used: number;
}

const counters = (prisma as unknown as {
  usageCounter: {
    findUnique(args: unknown): Promise<UsageCounterRow | null>;
    findMany(args: unknown): Promise<UsageCounterRow[]>;
    upsert(args: unknown): Promise<UsageCounterRow>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
});

const events = (prisma as unknown as {
  usageEvent: {
    create(args: unknown): Promise<{ id: string }>;
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<UsageEventRow[]>;
  };
});

interface UsageEventRow {
  id: string;
  feature: string;
  amount: number;
  origin: string | null;
  createdAt: Date;
}

/**
 * SERIALIZAÇÃO POR USUÁRIO
 * ========================
 * O gate é "ler limite → escrever consumo". Duas requisições SIMULTÂNEAS do
 * mesmo usuário podiam ler o mesmo saldo (ambas vendo "1 restante") e as duas
 * passarem — estourando a franquia. É o mesmo problema que a reserva da última
 * vaga resolve no checkout.
 *
 * Aqui usamos um lock consultivo do Postgres (`pg_advisory_xact_lock`) por
 * usuário. O lock é liberado automaticamente no fim da transação, e o fallback
 * de sub-transação deixa o contador funcionar fora dos bancos que não o
 * suportam. Diferente do outro, este lock serializa TAMBÉM o caminho de leitura
 * do gate — que é onde o excesso realmente se decide.
 */
function userLockKey(userId: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return [0x7573, h | 0];
}

/** Contexto do ciclo contratado do usuário (o que define a janela "cycle"). */
export interface CycleContext {
  /** Slug do plano vigente, ou `null` se não houver assinatura ativa. */
  planSlug: string | null;
  startAt: Date;
  expiresAt: Date | null;
  /** `true` quando há acesso pago vigente. */
  active: boolean;
}

/** Lê o ciclo do usuário a partir da assinatura/grant vigente. */
export async function getCycleContext(userId: string, now = new Date()): Promise<CycleContext> {
  try {
    const subs = (await prisma.subscription.findMany({
      where: { userId },
      orderBy: { startAt: "desc" },
      include: { plan: { select: { slug: true } } },
    })) as unknown as {
      status: string;
      startAt: Date | null;
      expiresAt: Date | null;
      autoRenew: boolean;
      plan?: { slug: string } | null;
    }[];

    const live = subs.find((s) => {
      if (s.status !== "ACTIVE" && s.status !== "PAST_DUE") return false;
      if (s.expiresAt && s.expiresAt.getTime() <= now.getTime()) return false;
      return true;
    });

    if (!live) {
      return { planSlug: null, startAt: now, expiresAt: null, active: false };
    }
    return {
      planSlug: live.plan?.slug ?? null,
      startAt: live.startAt ?? now,
      expiresAt: live.expiresAt,
      active: true,
    };
  } catch {
    // Falha de banco NÃO pode virar bloqueio: devolvemos "sem acesso" e o gate
    // (que hoje está em modo medição) não barra. Nunca liberamos por engano.
    return { planSlug: null, startAt: now, expiresAt: null, active: false };
  }
}

/** Chaves das duas janelas no instante dado. */
function windowKeys(cycle: CycleContext, now: Date) {
  return {
    day: saoPauloDayKey(now),
    cycle: cycleKey({ startAt: cycle.startAt, expiresAt: cycle.expiresAt, now }),
  };
}

/** Lê o `used` de um contador (0 quando não existe). */
async function readCounter(
  userId: string,
  feature: QuotaFeature,
  window: "DAY" | "CYCLE",
  key: string
): Promise<number> {
  try {
    const row = await counters.usageCounter.findUnique({
      where: { userId_feature_window_key: { userId, feature, window, key } },
    });
    return row?.used ?? 0;
  } catch {
    return 0;
  }
}

/** Consumo atual do usuário nas duas janelas, para uma capacidade. */
export async function getUsage(
  userId: string,
  feature: QuotaFeature,
  cycle: CycleContext,
  now = new Date()
): Promise<{ usedToday: number; usedThisCycle: number }> {
  const keys = windowKeys(cycle, now);
  const [usedToday, usedThisCycle] = await Promise.all([
    readCounter(userId, feature, "DAY", keys.day),
    readCounter(userId, feature, "CYCLE", keys.cycle),
  ]);
  return { usedToday, usedThisCycle };
}

/**
 * Versão SERIALIZADA do `getUsage`: executa dentro de uma transação holding o
 * lock por usuário, de modo que nenhuma outra escrita de consumo do mesmo
 * usuário acontece no meio. Se o banco não suportar a transação interativa, cai
 * para a leitura simples — o medidor continua funcionando, só sem a serialização.
 */
async function getUsageLocked(
  userId: string,
  feature: QuotaFeature,
  cycle: CycleContext,
  now: Date
): Promise<{ usedToday: number; usedThisCycle: number }> {
  const keys = windowKeys(cycle, now);
  try {
    return await prisma.$transaction(async (tx) => {
      const txc = tx as unknown as {
        $executeRawUnsafe(sql: string, ...args: unknown[]): Promise<number>;
        usageCounter: {
          findUnique(args: unknown): Promise<UsageCounterRow | null>;
        };
      };
      const [ns, key] = userLockKey(userId);
      // Lock só desta transação: some no commit/rollback, sem cleanup.
      await txc.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", ns, key);

      const readOne = async (window: "DAY" | "CYCLE", k: string) => {
        const row = await txc.usageCounter.findUnique({
          where: { userId_feature_window_key: { userId, feature, window, key: k } },
        });
        return row?.used ?? 0;
      };

      return {
        usedToday: await readOne("DAY", keys.day),
        usedThisCycle: await readOne("CYCLE", keys.cycle),
      };
    });
  } catch {
    // Banco sem transação interativa / advisory lock: leitura normal.
    return getUsage(userId, feature, cycle, now);
  }
}

/**
 * Decide se o usuário pode consumir UMA unidade AGORA.
 *
 * Não grava nada — apenas lê e calcula. A gravação é `recordUsage`, chamada
 * DEPOIS que a operação de fato aconteceu (sucesso), para que uma falha técnica
 * não consuma franquia.
 */
export async function checkQuota(
  userId: string,
  feature: QuotaFeature,
  opts: { cycle?: CycleContext; now?: Date } = {}
): Promise<QuotaDecision & { cycle: CycleContext }> {
  const now = opts.now ?? new Date();
  const cycle = opts.cycle ?? (await getCycleContext(userId, now));
  // Carrega o override de franquia do admin ANTES de resolver a quota: sem isso
  // `quotaForPlan` usaria só o padrão em código. Se nada estiver gravado (ou o
  // banco falhar), os overrides ficam vazios e vale o padrão — fail-open.
  await loadQuotaOverrides();
  const quota = quotaForPlan(cycle.planSlug);
  // Leitura SERIALIZADA: impede que duas requisições simultâneas do mesmo
  // usuário leiam o mesmo saldo e ambas passem (consumo acima da franquia).
  const usage = await getUsageLocked(userId, feature, cycle, now);
  return { ...evaluateQuota({ quota, feature, ...usage }), cycle };
}

export interface RecordUsageInput {
  userId: string;
  feature: QuotaFeature;
  /** Quantidade (normalmente 1). */
  amount?: number;
  /** Contexto curto ("copy", "ideias", "diagnostico"). Nunca dado sensível. */
  origin?: string;
  /**
   * Chave de IDEMPOTÊNCIA do evento externo (ex.: id do pagamento/publicação).
   * Quando presente, um retry do MESMO evento não conta duas vezes.
   */
  idempotencyKey?: string;
  cycle?: CycleContext;
  now?: Date;
}

/**
 * Registra consumo APÓS o sucesso da operação.
 *
 * Escreve o LOG (`UsageEvent`) e incrementa os DOIS contadores (`DAY` e
 * `CYCLE`) numa transação — o log é a auditoria, o contador é a leitura rápida.
 * Se `idempotencyKey` já existir, nada é gravado (retry não conta duas vezes).
 *
 * NUNCA lança: falha de medição não pode derrubar a operação do usuário que já
 * teve sucesso. Devolve `{ recorded: false }` e o motivo.
 */
export async function recordUsage(
  input: RecordUsageInput
): Promise<{ recorded: boolean; reason?: "duplicate" | "error" }> {
  const { userId, feature } = input;
  const amount = Math.max(1, input.amount ?? 1);
  const now = input.now ?? new Date();

  try {
    const cycle = input.cycle ?? (await getCycleContext(userId, now));
    const keys = windowKeys(cycle, now);

    await prisma.$transaction(async (tx) => {
      const txc = tx as unknown as {
        usageEvent: { create(args: unknown): Promise<unknown> };
        usageCounter: { upsert(args: unknown): Promise<unknown> };
      };

      // 1) LOG + idempotência. A unique constraint em `idempotencyKey` é a trava.
      await txc.usageEvent.create({
        data: {
          userId,
          feature,
          amount,
          origin: input.origin ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdAt: now,
        },
      });

      // 2) CONTADORES (diário + ciclo) — incremento atômico via upsert.
      for (const [window, key] of [
        ["DAY", keys.day],
        ["CYCLE", keys.cycle],
      ] as const) {
        await txc.usageCounter.upsert({
          where: { userId_feature_window_key: { userId, feature, window, key } },
          create: { userId, feature, window, key, used: amount },
          update: { used: { increment: amount } },
        });
      }
    });

    return { recorded: true };
  } catch (err) {
    // P2002 = idempotencyKey duplicada → o evento já contou. Não é erro.
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return { recorded: false, reason: "duplicate" };
    console.error("[usage] falha ao registrar consumo", err);
    return { recorded: false, reason: "error" };
  }
}

/**
 * RESERVA ATÔMICA do consumo — `check` + `incremento` numa única transação.
 *
 * Sem isto, duas requisições simultâneas do mesmo usuário podiam AMBAS ler o
 * mesmo saldo (as duas vendo "1 restante") e as duas passarem, estourando a
 * franquia. Aqui a decisão e a reserva acontecem sob o mesmo lock por usuário,
 * então a segunda vê o valor que a primeira gravou.
 *
 * Retorna a decisão. Quando o enforcement está DESLIGADO (hoje), sempre libera —
 * mas ainda grava a reserva, para o consumo aparecer no painel.
 */
export async function reserveUsage(input: {
  userId: string;
  feature: QuotaFeature;
  amount?: number;
  cycle?: CycleContext;
  now?: Date;
}): Promise<QuotaDecision & { cycle: CycleContext }> {
  const { userId, feature } = input;
  const amount = Math.max(1, input.amount ?? 1);
  const now = input.now ?? new Date();
  const cycle = input.cycle ?? (await getCycleContext(userId, now));
  const quota = quotaForPlan(cycle.planSlug);
  const keys = windowKeys(cycle, now);

  try {
    return await prisma.$transaction(async (tx) => {
      const txc = tx as unknown as {
        $executeRawUnsafe(sql: string, ...args: unknown[]): Promise<number>;
        usageCounter: {
          findUnique(args: unknown): Promise<UsageCounterRow | null>;
          upsert(args: unknown): Promise<unknown>;
        };
      };
      const [ns, lk] = userLockKey(userId);
      await txc.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", ns, lk);

      const readOne = async (window: "DAY" | "CYCLE", k: string) => {
        const row = await txc.usageCounter.findUnique({
          where: { userId_feature_window_key: { userId, feature, window, key: k } },
        });
        return row?.used ?? 0;
      };

      const usedToday = await readOne("DAY", keys.day);
      const usedThisCycle = await readOne("CYCLE", keys.cycle);
      const decision = evaluateQuota({ quota, feature, usedToday, usedThisCycle });

      if (decision.allowed) {
        // Reserva em AMBAS as janelas, dentro do mesmo lock da leitura.
        for (const [window, key] of [
          ["DAY", keys.day],
          ["CYCLE", keys.cycle],
        ] as const) {
          await txc.usageCounter.upsert({
            where: { userId_feature_window_key: { userId, feature, window, key } },
            create: { userId, feature, window, key, used: amount },
            update: { used: { increment: amount } },
          });
        }
      }

      return { ...decision, cycle };
    });
  } catch (err) {
    // Banco sem transação interativa → cai no caminho simples (sem serialização).
    console.error("[usage] reserva serializada indisponível, usando caminho simples", err);
    return checkQuota(userId, feature, { cycle, now });
  }
}

/**
 * DEVOLVE uma reserva que não chegou a virar consumo (operação falhou depois de
 * reservada). Evita que uma falha técnica queime franquia.
 */
export async function releaseUsage(input: {
  userId: string;
  feature: QuotaFeature;
  amount?: number;
  cycle: CycleContext;
  now?: Date;
}): Promise<void> {
  const amount = Math.max(1, input.amount ?? 1);
  const now = input.now ?? new Date();
  const keys = windowKeys(input.cycle, now);
  try {
    for (const [window, key] of [
      ["DAY", keys.day],
      ["CYCLE", keys.cycle],
    ] as const) {
      // `decrement` pode deixar negativo se a reserva já tiver sido liberada;
      // `updateMany` com `used >= amount` garante que nunca fica abaixo de zero.
      await counters.usageCounter.updateMany({
        where: { userId: input.userId, feature: input.feature, window, key, used: { gte: amount } },
        data: { used: { decrement: amount } },
      });
    }
  } catch (err) {
    console.error("[usage] falha ao devolver reserva", err);
  }
}

/**
 * Executa uma operação com consumo medido, de forma segura:
 *   1. RESERVA a vaga de forma atômica (bloqueia só se o enforcement estiver ligado);
 *   2. roda a operação;
 *   3. se a operação FALHAR, DEVOLVE a reserva (falha técnica não consome franquia);
 *      se der certo, grava o log de auditoria do consumo.
 *
 * Assim uma falha técnica (IA fora do ar, publicação recusada pela Meta) não
 * queima crédito — o registro vem depois do `await` bem-sucedido.
 */
export async function withUsage<T>(
  input: {
    userId: string;
    feature: QuotaFeature;
    origin?: string;
    idempotencyKey?: string;
  },
  run: () => Promise<T>
): Promise<
  | { ok: true; value: T; quota: QuotaDecision }
  | { ok: false; reason: "quota"; quota: QuotaDecision }
> {
  // 1) RESERVA atômica (decisão + incremento sob o mesmo lock). Duas
  //    requisições simultâneas não conseguem mais ler o mesmo saldo e passar.
  const reserved = await reserveUsage({ userId: input.userId, feature: input.feature });
  if (!reserved.allowed) {
    return { ok: false, reason: "quota", quota: reserved };
  }

  let value: T;
  try {
    value = await run();
  } catch (err) {
    // 2) A operação FALHOU: devolve a reserva — falha técnica não consome
    //    franquia. Depois propaga o erro original.
    await releaseUsage({
      userId: input.userId,
      feature: input.feature,
      cycle: reserved.cycle,
    });
    throw err;
  }

  // 3) Sucesso: grava o LOG de auditoria. O contador já foi incrementado na
  //    reserva — por isso aqui NÃO usamos `recordUsage` (que incrementaria de
  //    novo). O log é só registro.
  await logUsageEvent({
    userId: input.userId,
    feature: input.feature,
    origin: input.origin,
    idempotencyKey: input.idempotencyKey,
  });

  return { ok: true, value, quota: reserved };
}

/**
 * Grava APENAS o log de auditoria do consumo (sem tocar nos contadores).
 * Usado por `withUsage`, onde o contador já foi incrementado na reserva.
 * Nunca lança: uma falha de log não pode derrubar uma operação que deu certo.
 */
async function logUsageEvent(input: {
  userId: string;
  feature: QuotaFeature;
  amount?: number;
  origin?: string;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    await events.usageEvent.create({
      data: {
        userId: input.userId,
        feature: input.feature,
        amount: Math.max(1, input.amount ?? 1),
        origin: input.origin ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  } catch {
    // P2002 (idempotency duplicada) ou qualquer outra falha: o consumo já está
    // contado no contador; perder a linha de log não afeta o limite.
  }
}

/** Resumo de consumo do usuário — alimenta o painel e o histórico. */
export async function getUsageSummary(
  userId: string,
  now = new Date()
): Promise<{
  planSlug: string | null;
  cycleActive: boolean;
  cycleStart: string;
  cycleEndsAt: string | null;
  dailyResetsAt: string;
  features: {
    feature: QuotaFeature;
    usedToday: number;
    usedThisCycle: number;
    dailyLimit: number | null;
    cycleLimit: number | null;
    remainingToday: number | null;
    remainingThisCycle: number | null;
  }[];
}> {
  const cycle = await getCycleContext(userId, now);
  await loadQuotaOverrides();
  const quota = quotaForPlan(cycle.planSlug);

  const all: QuotaFeature[] = [
    "ai_generation",
    "auto_reply",
    "profile_analysis",
    "publication",
  ];

  const features = await Promise.all(
    all.map(async (feature) => {
      const usage = await getUsage(userId, feature, cycle, now);
      const d = evaluateQuota({
        quota,
        feature,
        usedToday: usage.usedToday,
        usedThisCycle: usage.usedThisCycle,
        enforcementEnabled: true, // o painel mostra o limite REAL, não o modo medição
      });
      return {
        feature,
        usedToday: usage.usedToday,
        usedThisCycle: usage.usedThisCycle,
        dailyLimit: d.window === "day" ? d.limit : null,
        cycleLimit: d.window === "cycle" ? d.limit : null,
        remainingToday: null,
        remainingThisCycle: null,
      };
    })
  );

  // Reconstrói os limites das DUAS janelas (o `evaluateQuota` devolve só a mais
  // restritiva). Feito aqui para o painel poder mostrar "X/dia" e "Y/ciclo".
  const withLimits = features.map((f) => {
    const dayEval = evaluateQuota({
      quota, feature: f.feature, usedToday: f.usedToday, usedThisCycle: 0, enforcementEnabled: true,
    });
    const cycleEval = evaluateQuota({
      quota, feature: f.feature, usedToday: 0, usedThisCycle: f.usedThisCycle, enforcementEnabled: true,
    });
    const dailyLimit = dayEval.window === "day" ? dayEval.limit : null;
    const cycleLimit = cycleEval.window === "cycle" ? cycleEval.limit : null;
    return {
      ...f,
      dailyLimit,
      cycleLimit,
      remainingToday: dailyLimit == null ? null : Math.max(0, dailyLimit - f.usedToday),
      remainingThisCycle: cycleLimit == null ? null : Math.max(0, cycleLimit - f.usedThisCycle),
    };
  });

  return {
    planSlug: cycle.planSlug,
    cycleActive: cycle.active,
    cycleStart: cycle.startAt.toISOString(),
    cycleEndsAt: cycle.expiresAt?.toISOString() ?? null,
    dailyResetsAt: nextDailyReset(now).toISOString(),
    features: withLimits,
  };
}

/** Uma linha do HISTÓRICO de consumo (o log de auditoria, não o agregado). */
export interface UsageHistoryItem {
  id: string;
  feature: QuotaFeature;
  amount: number;
  origin: string | null;
  createdAt: string;
}

/**
 * HISTÓRICO DE CONSUMO do usuário — lê o LOG (`UsageEvent`), mais recente
 * primeiro. É a auditoria do que foi consumido: o painel mostra os eventos
 * individuais (quando, qual capacidade, quanto), não só os totais.
 *
 * Sempre escopado por `userId` (jamais devolve evento de outro usuário).
 * `limit` tem padrão 50 e é CAPADO em 200 para não varrer a tabela inteira.
 * `feature` opcional filtra por capacidade.
 *
 * NUNCA lança: uma falha de leitura devolve lista vazia — o painel mostra o
 * estado honesto "sem registros" em vez de quebrar a tela de assinatura.
 */
export async function listUsageHistory(
  userId: string,
  opts: { feature?: QuotaFeature; limit?: number } = {}
): Promise<UsageHistoryItem[]> {
  const take = Math.min(200, Math.max(1, opts.limit ?? 50));
  try {
    const rows = await events.usageEvent.findMany({
      where: {
        userId,
        ...(opts.feature ? { feature: opts.feature } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, feature: true, amount: true, origin: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      feature: r.feature as QuotaFeature,
      amount: r.amount,
      origin: r.origin,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  } catch {
    return [];
  }
}
