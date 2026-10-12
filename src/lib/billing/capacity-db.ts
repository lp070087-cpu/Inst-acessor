import { prisma } from "@/lib/db";
import { bll } from "@/lib/billing/db";
import { settings } from "@/lib/admin/settings-db";
import { normalizeEmail } from "@/lib/first-access/core";
import {
  CAPACITY_SETTING_KEY,
  DEFAULT_CAPACITY,
  INVITE_TTL_DAYS,
  RESERVATION_TTL_MINUTES,
  decideCapacity,
  parseCapacityConfig,
  type CapacityConfig,
  type CapacityDecision,
  type CapacityUsage,
} from "@/lib/billing/capacity";

/**
 * CAPACIDADE DE VENDAS — LEITURA/GRAVAÇÃO + RESERVA ATÔMICA
 * ==========================================================
 * A configuração vive no model `SystemSetting` (JÁ EXISTE, chave `@unique`):
 * gravar uma key nova NÃO exige migration. O uso real (pagantes + reservas +
 * convites) é MEDIDO do banco — nunca informado pelo navegador.
 *
 * Degradação honesta: se o banco não responder, devolvemos o PADRÃO — que é
 * SEM limite e com vendas ABERTAS. Isso é deliberado: o padrão do produto não
 * bloqueia vendas. Um erro de leitura nunca deve fechar a loja por acidente.
 */

const CONFIRMED_ACTIVE_STATUSES = ["ACTIVE"] as const;
const MS_PER_DAY = 86_400_000;

/** Chave de lock consultivo (dois int4) usada para serializar reservas. */
const ADVISORY_LOCK_KEY_1 = 727_001;
const ADVISORY_LOCK_KEY_2 = 120_001;

// ---------------------------------------------------------------------------
// Configuração (SystemSetting)
// ---------------------------------------------------------------------------

/** Lê a configuração de capacidade. Nunca lança. */
export async function getCapacityConfig(): Promise<CapacityConfig> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: CAPACITY_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (!row || row.value == null) return DEFAULT_CAPACITY;
    return parseCapacityConfig(row.value);
  } catch {
    return DEFAULT_CAPACITY;
  }
}

/** Grava a configuração (admin). Devolve a config normalizada que ficou salva. */
export async function saveCapacityConfig(raw: unknown): Promise<CapacityConfig> {
  const normalized = parseCapacityConfig(raw);
  const value = JSON.stringify(normalized);
  await settings.systemSetting.upsert({
    where: { key: CAPACITY_SETTING_KEY },
    create: { key: CAPACITY_SETTING_KEY, value },
    update: { value },
  });
  return normalized;
}

// ---------------------------------------------------------------------------
// Medição do uso real
// ---------------------------------------------------------------------------

/** CheckoutOrder PENDING é uma RESERVA de vaga enquanto não expira. */
export function reservationWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RESERVATION_TTL_MINUTES * 60_000);
}

interface EmailRow {
  email: string;
}

/** Normaliza e junta e-mails numa lista de distintos (ignora inválidos). */
function distinctEmails(rows: EmailRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    const e = normalizeEmail(r.email);
    if (e) out.add(e);
  }
  return out;
}

/**
 * E-mails DISTINTOS com acesso Asaas vigente (pagantes reais).
 *
 * Contar por e-mail (e não por linha de `AccessGrant`) é essencial: o mesmo
 * cliente gera uma linha por ciclo de cobrança. Contar linhas fecharia a venda
 * cedo, punindo justamente quem renova.
 */
async function activePayerEmails(now: Date): Promise<Set<string>> {
  const grants = (await bll.accessGrant.findMany({
    where: {
      origin: "ASAAS",
      status: { in: [...CONFIRMED_ACTIVE_STATUSES] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { email: true },
  })) as unknown as EmailRow[];
  return distinctEmails(grants);
}

/**
 * E-mails DISTINTOS com reserva PENDING não expirada. Contar por e-mail impede
 * que um comprador que recarrega o checkout várias vezes ocupe mais de uma
 * vaga com o mesmo endereço.
 */
async function pendingReservationEmails(now: Date): Promise<Set<string>> {
  const rows = (await bll.checkoutOrder.findMany({
    where: { status: "PENDING", createdAt: { gt: reservationWindowStart(now) } },
    select: { email: true },
  })) as unknown as EmailRow[];
  return distinctEmails(rows);
}

/** O e-mail informado já é um pagante ativo? */
async function isActivePayerEmail(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  try {
    const now = new Date();
    const found = (await bll.accessGrant.findFirst({
      where: {
        email: e,
        origin: "ASAAS",
        status: { in: [...CONFIRMED_ACTIVE_STATUSES] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    })) as unknown as { id: string } | null;
    return Boolean(found);
  } catch {
    return false;
  }
}

/** Delegates da lista de espera (model novo; cast até `prisma generate`). */
interface WaitlistDelegate {
  count(args?: unknown): Promise<number>;
  findFirst(args?: unknown): Promise<{ id: string; status: string; expiresAt: Date | null } | null>;
}

function waitlistDelegate(): WaitlistDelegate | null {
  const p = prisma as unknown as { waitlistEntry?: WaitlistDelegate };
  return p.waitlistEntry ?? null;
}

/** Convites vigentes (seguram vaga) e se ESTE e-mail tem um. Fail-safe honesto. */
async function readInviteUsage(email: string): Promise<{
  activeInvites: number;
  hasActiveInvite: boolean;
}> {
  const delegate = waitlistDelegate();
  if (!delegate) return { activeInvites: 0, hasActiveInvite: false };
  const now = new Date();
  try {
    const activeInvites = await delegate.count({
      where: { status: "INVITED", expiresAt: { gt: now } },
    });
    const e = normalizeEmail(email);
    let hasActiveInvite = false;
    if (e) {
      const mine = await delegate.findFirst({
        where: { email: e, status: "INVITED", expiresAt: { gt: now } },
        select: { id: true, status: true, expiresAt: true },
      });
      hasActiveInvite = Boolean(mine);
    }
    return { activeInvites, hasActiveInvite };
  } catch {
    return { activeInvites: 0, hasActiveInvite: false };
  }
}

/** Mede o uso REAL atual (fora de transação — para painel e pré-checagem). */
export async function getCapacityUsage(email?: string | null): Promise<CapacityUsage> {
  const now = new Date();
  const [payers, pending, inviteUsage, buyerIsActivePayer] = await Promise.all([
    activePayerEmails(now).catch(() => new Set<string>()),
    pendingReservationEmails(now).catch(() => new Set<string>()),
    email
      ? readInviteUsage(email)
      : Promise.resolve({ activeInvites: 0, hasActiveInvite: false }),
    email ? isActivePayerEmail(email) : Promise.resolve(false),
  ]);
  // União de e-mails (pagantes ∪ reservas): a MESMA pessoa contando nos dois não
  // consome duas vagas.
  const occupied = new Set<string>([...payers, ...pending]);
  return {
    activePayers: occupied.size,
    pendingReservations: 0,
    activeInvites: inviteUsage.activeInvites,
    hasActiveInvite: inviteUsage.hasActiveInvite,
    buyerIsActivePayer,
  };
}

/** Decisão de capacidade para um e-mail (leitura, sem reservar). */
export async function evaluateCapacity(
  email?: string | null
): Promise<{ decision: CapacityDecision; config: CapacityConfig }> {
  const [config, usage] = await Promise.all([
    getCapacityConfig(),
    getCapacityUsage(email ?? null),
  ]);
  return { decision: decideCapacity({ config, usage }), config };
}

/**
 * Avaliação DEFENSIVA no momento de CONCEDER acesso (webhook).
 *
 * REGRA DE OURO: um pagamento CONFIRMADO NUNCA é recusado por capacidade.
 * Recusar acesso a quem pagou é o pior desfecho possível — e por isso
 * `allow` é SEMPRE `true` aqui. O que esta função entrega é um SINAL de
 * auditoria (`overCapacity`) para operação enxergar o caso raro em que uma
 * vaga reservada expirou (TTL de 15 min) e o pagamento chegou depois.
 *
 * Renovações são naturalmente isentas: o comprador já é pagante ativo, então
 * `withinCapacity` é `true` e nenhum ruído é gerado. Só há alerta quando uma
 * compra NOVA é confirmada sem vaga — o que significa que a reserva expirou,
 * não que devemos negar o acesso.
 */
export async function assessGrantCapacity(input: {
  email: string;
}): Promise<{ allow: true; overCapacity: boolean; decision: CapacityDecision }> {
  const { decision } = await evaluateCapacity(input.email);
  // `allowed` cobre: vaga disponível, convite vigente ou já ser pagante ativo.
  const overCapacity = !decision.allowed;
  if (overCapacity) {
    // Sinal operacional (sem dado pessoal). Não bloqueia nada.
    console.warn(
      `[capacity] acesso concedido acima do teto (reserva expirada?) reason=${decision.reason} used=${decision.used} max=${decision.maxPayers ?? "ilimitado"}`
    );
  }
  return { allow: true, overCapacity, decision };
}

// ---------------------------------------------------------------------------
// Reserva ATÔMICA (o coração da concorrência)
// ---------------------------------------------------------------------------

export interface ReservationOrderInput {
  email: string;
  name: string | null;
  userId: string | null;
  planId: string | null;
  planSlug: string;
  planName: string | null;
  expectedAmountCents: number;
  currency: string;
  billingType: string;
  billingInterval: string | null;
  externalReference: string;
  audit: Record<string, unknown>;
}

export type ReservationResult =
  | { ok: true; order: Record<string, unknown> }
  | { ok: false; decision: CapacityDecision };

/**
 * Tenta reservar uma vaga E criar a `CheckoutOrder` PENDING numa única
 * transação. É AQUI que a invariante "duas pessoas nunca pegam a última vaga"
 * é garantida.
 *
 * Como funciona:
 *  - Transação INTERATIVA em isolamento SERIALIZABLE: ler o uso e inserir a
 *    reserva acontecem na mesma transação, então o Postgres detecta o conflito
 *    leitura→escrita (phantom) de dois checkouts simultâneos e aborta um.
 *  - Retry no conflito (P2034): a transação abortada é refeita, relê o uso e
 *    decide de novo. Na segunda passagem, ou ainda há vaga (reserva) ou não.
 *  - As contagens usam a MESMA janela de tempo das reservas (TTL de 15 min),
 *    então reservas velhas "soltam" a vaga sozinhas — sem job de limpeza.
 *
 * Renovações NÃO passam por aqui (webhook), então continuam funcionando com as
 * vendas fechadas. Este caminho é só de compra NOVA pelo checkout público.
 */
export async function attemptCheckoutReservation(
  input: ReservationOrderInput
): Promise<ReservationResult> {
  const MAX_ATTEMPTS = 4;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const t = tx as unknown as {
            $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
            systemSetting: { findUnique(args: unknown): Promise<{ value: string | null } | null> };
            accessGrant: { findMany(args: unknown): Promise<EmailRow[]>; findFirst(args: unknown): Promise<{ id: string } | null> };
            checkoutOrder: {
              count(args?: unknown): Promise<number>;
              findMany(args: unknown): Promise<EmailRow[]>;
              create(args: unknown): Promise<Record<string, unknown>>;
            };
            waitlistEntry?: WaitlistDelegate;
          };

          // Serializa reservas concorrentes com um lock TRANSACIONAL. O lock é
          // liberado automaticamente no commit/rollback — nenhum estado vaza.
          await t.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY_1}, ${ADVISORY_LOCK_KEY_2})`;

          // 1) Configuração (dentro da transação = snapshot consistente).
          const row = await t.systemSetting.findUnique({ where: { key: CAPACITY_SETTING_KEY } });
          const config = row?.value != null ? parseCapacityConfig(row.value) : DEFAULT_CAPACITY;

          // 2) Uso real.
          const now = new Date();
          const windowStart = reservationWindowStart(now);

          const grants = await t.accessGrant.findMany({
            where: {
              origin: "ASAAS",
              status: { in: [...CONFIRMED_ACTIVE_STATUSES] },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { email: true },
          });
          const payerEmails = distinctEmails(grants);

          const pendingRows = await t.checkoutOrder.findMany({
            where: { status: "PENDING", createdAt: { gt: windowStart } },
            select: { email: true },
          });
          const pendingEmails = distinctEmails(pendingRows);

          // União de e-mails (pagantes ∪ reservas) — a MESMA pessoa nos dois não
          // consome duas vagas.
          const occupied = new Set<string>([...payerEmails, ...pendingEmails]);
          const activePayers = occupied.size;

          const buyerEmail = normalizeEmail(input.email) ?? "";
          let activeInvites = 0;
          let hasActiveInvite = false;
          if (t.waitlistEntry) {
            activeInvites = await t.waitlistEntry.count({
              where: { status: "INVITED", expiresAt: { gt: now } },
            });
            if (buyerEmail) {
              const mine = await t.waitlistEntry.findFirst({
                where: { email: buyerEmail, status: "INVITED", expiresAt: { gt: now } },
                select: { id: true, status: true, expiresAt: true },
              });
              hasActiveInvite = Boolean(mine);
            }
          }

          const buyerIsActivePayer = buyerEmail ? payerEmails.has(buyerEmail) : false;

          const usage: CapacityUsage = {
            activePayers,
            pendingReservations: 0,
            activeInvites,
            hasActiveInvite,
            buyerIsActivePayer,
          };

          // 3) Decisão.
          const decision = decideCapacity({ config, usage });
          if (!decision.allowed) {
            return { ok: false, decision } satisfies ReservationResult;
          }

          // 4) Reserva = cria a ordem PENDING. Segura a vaga por TTL.
          const order = await t.checkoutOrder.create({
            data: {
              email: input.email,
              name: input.name,
              userId: input.userId,
              planId: input.planId,
              planSlug: input.planSlug,
              planName: input.planName,
              expectedAmountCents: input.expectedAmountCents,
              currency: input.currency,
              billingType: input.billingType,
              billingInterval: input.billingInterval,
              status: "PENDING",
              externalReference: input.externalReference,
              externalCheckoutId: null,
              externalPaymentId: null,
              externalSubscriptionId: null,
              paidAt: null,
              audit: input.audit,
            },
          });

          return { ok: true, order } satisfies ReservationResult;
        },
        { isolationLevel: "Serializable" }
      );
    } catch (err) {
      lastError = err;
      // P2034 = conflito de escrita / deadlock → reexecuta a transação inteira.
      const code = (err as { code?: string })?.code;
      if (code !== "P2034") throw err;
    }
  }

  throw lastError ?? new Error("Não foi possível reservar a vaga.");
}

// ---------------------------------------------------------------------------
// Cartão de status para o painel admin / checkout
// ---------------------------------------------------------------------------

export interface CapacityStatusCard {
  decision: CapacityDecision;
  config: CapacityConfig;
  updatedAt?: string | null;
}

/** Status completo para telas (admin/checkout), com a config vigente. */
export async function getCapacityStatus(
  email?: string | null
): Promise<CapacityStatusCard> {
  const { decision, config } = await evaluateCapacity(email ?? null);
  return { decision, config };
}

export const CAPACITY_INVITE_TTL_DAYS = INVITE_TTL_DAYS;
