import { bll } from "@/lib/billing/db";
import { getPlanBySlug } from "@/lib/billing/plans";
import {
  MANUAL_PROVIDER,
  MANUAL_SOURCE,
  MANUAL_MIN_DAYS,
  MANUAL_MAX_DAYS,
  computeExtendedExpiry,
  computeGrantDates,
  normalizeEmail,
  resolveAnchorPlanSlug,
  validateGrantDays,
} from "./manual-access-core";

/**
 * CENÁRIO D — e-mail SEM conta: cria um `AccessGrant` (origem ADMIN_MANUAL)
 * para que o e-mail possa concluir o primeiro acesso depois. NENHUMA senha é
 * criada aqui (regra: nunca gerar senha automática).
 */
async function grantManualAccessToEmailOnly(input: {
  email: string;
  days: number;
  adminId: string;
  planName: string | null;
}): Promise<GrantManualAccessResult> {
  const now = new Date();
  const { startAt, expiresAt } = computeGrantDates(now, input.days);
  const plan = await getPlanBySlug(resolveAnchorPlanSlug(input.days));

  const accessGrant = (bll as unknown as { accessGrant?: unknown }).accessGrant as
    | {
        create(args: unknown): Promise<{ id: string; email: string }>;
      }
    | undefined;

  if (!accessGrant) {
    return {
      ok: false,
      code: "ERROR",
      message: "Infraestrutura de acesso não disponível.",
    };
  }

  try {
    await accessGrant.create({
      data: {
        email: input.email,
        userId: null,
        planId: plan?.id ?? null,
        planName: input.planName,
        origin: "ADMIN_MANUAL",
        status: "PENDING_FIRST_ACCESS",
        startAt,
        expiresAt,
        grantedByAdminId: input.adminId,
        firstAccessCompleted: false,
        firstAccessCompletedAt: null,
      },
    });
  } catch {
    return {
      ok: false,
      code: "ERROR",
      message: "Não foi possível registrar a liberação de acesso.",
    };
  }

  return {
    ok: true,
    code: "OK",
    message:
      "Acesso registrado para este e-mail. O cliente deverá concluir o primeiro acesso (prova de posse do e-mail).",
    extended: false,
    email: input.email,
    startAt: startAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    planName: plan?.name ?? null,
    accessSource: MANUAL_SOURCE,
  };
}

/**
 * LIBERAÇÃO MANUAL DE ACESSO — SERVIÇO (somente ADMIN)
 * ======================================================
 * O ADMIN concede/estende acesso a um e-mail SEM cobrança e SEM chamar o
 * Asaas. Regras:
 *   - Autorização é feita ANTES, no servidor (`requireAdminSession`).
 *   - Se o e-mail ainda não tem conta → NÃO cria usuário com senha falsa;
 *     retorna `USER_NOT_FOUND` (criação fica para a fase "primeiro acesso").
 *   - Não toca em dados de pagamento Asaas (não finge compra).
 *   - Registra origem `ADMIN_MANUAL`, quem executou e início/expiração.
 *   - Extensão previsível: novo vencimento = max(atual, agora) + dias.
 *   - Não apaga histórico de pagamentos.
 */

export interface GrantManualAccessResult {
  ok: boolean;
  code: "OK" | "USER_NOT_FOUND" | "INVALID_DAYS" | "ERROR";
  message: string;
  extended?: boolean;
  email?: string;
  startAt?: string | null;
  expiresAt?: string | null;
  planName?: string | null;
  accessSource?: string | null;
}

export async function grantManualAccess(input: {
  email: string;
  days: number;
  adminId: string;
}): Promise<GrantManualAccessResult> {
  const email = normalizeEmail(input.email);
  if (!email) {
    return { ok: false, code: "INVALID_DAYS", message: "E-mail inválido." };
  }
  if (!validateGrantDays(input.days)) {
    return {
      ok: false,
      code: "INVALID_DAYS",
      message: `Duração inválida (use ${MANUAL_MIN_DAYS} a ${MANUAL_MAX_DAYS} dias inteiros).`,
    };
  }

  const user = (await bll.user.findUnique({
    where: { email },
    select: { id: true },
  })) as unknown as { id: string } | null;

  // CENÁRIO D — e-mail SEM conta: o ADMIN libera o acesso ANTES do cadastro.
  // Criamos um `AccessGrant` (origem ADMIN_MANUAL) para que o e-mail possa
  // concluir o primeiro acesso depois. NENHUMA senha é criada aqui.
  if (!user) {
    return await grantManualAccessToEmailOnly({
      email,
      days: input.days,
      adminId: input.adminId,
      planName: (await getPlanBySlug(resolveAnchorPlanSlug(input.days)))?.name ?? null,
    });
  }

  const slug = resolveAnchorPlanSlug(input.days);
  const plan = await getPlanBySlug(slug);
  if (!plan) {
    return { ok: false, code: "ERROR", message: "Plano de referência não encontrado." };
  }

  const now = new Date();
  const { startAt, expiresAt } = computeGrantDates(now, input.days);

  // Extensão: se já existe acesso manual ativo, estende a partir de max(expira, agora).
  const existing = (await bll.subscription.findFirst({
    where: {
      userId: user.id,
      provider: MANUAL_PROVIDER,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "desc" },
  })) as unknown as { id: string; expiresAt: Date | null } | null;

  if (existing) {
    const newExpiresAt = computeExtendedExpiry(existing.expiresAt, now, input.days);
    await bll.subscription.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        expiresAt: newExpiresAt,
        provider: MANUAL_PROVIDER,
        accessSource: MANUAL_SOURCE,
        grantedByAdminId: input.adminId,
      },
    });
    return {
      ok: true,
      code: "OK",
      message: "Acesso estendido.",
      extended: true,
      email,
      startAt: null,
      expiresAt: newExpiresAt.toISOString(),
      planName: plan.name,
      accessSource: MANUAL_SOURCE,
    };
  }

  await bll.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: "ACTIVE",
      billingType: "MANUAL",
      billingInterval: null,
      startAt,
      expiresAt,
      autoRenew: false,
      nextBillingAt: null,
      canceledAt: null,
      provider: MANUAL_PROVIDER,
      externalCustomerId: null,
      externalSubscriptionId: null,
      accessSource: MANUAL_SOURCE,
      grantedByAdminId: input.adminId,
    },
  });

  return {
    ok: true,
    code: "OK",
    message: "Acesso liberado.",
    extended: false,
    email,
    startAt: startAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    planName: plan.name,
    accessSource: MANUAL_SOURCE,
  };
}
