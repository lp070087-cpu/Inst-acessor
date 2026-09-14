import { randomUUID } from "crypto";

import { bll, type CheckoutOrder } from "@/lib/billing/db";
import { getPlanById } from "@/lib/billing/plans";
import { normalizeEmail } from "@/lib/first-access/core";
import { asaasClient } from "./client";
import { getAsaasConfig } from "./config";
import { buildHostedCheckoutRequest, extractCheckoutUrl } from "./hosted-checkout";
import type { AsaasCheckoutResponse } from "./types";

/**
 * ASAAS — ORDEM DE COMPRA (CHECKOUT HOSPEDADO PÚBLICO)
 * ======================================================
 * Fluxo oficial: landing → escolha do plano → CHECKOUT PÚBLICO SEM LOGIN →
 * checkout hospedado do Asaas (POST /v3/checkouts) → webhook validado →
 * AccessGrant → primeiro acesso → criação/vínculo do User.
 *
 * O cliente NÃO precisa ter conta antes da compra. Por isso a ordem é criada
 * com o E-MAIL como identidade (userId opcional — preenchido apenas se o
 * comprador já for um User nosso).
 *
 * Regras (escopo oficial):
 *   - Preço/duração/ciclo SEMPRE resolvidos no servidor (`getPlanBySlug`).
 *   - `externalReference` ÚNICA por compra (âncora de reconciliação do webhook).
 *   - Criar checkout ≠ pagamento aprovado: status permanece PENDING; acesso só
 *     é liberado por evento VALIDADO no webhook (A6).
 *   - Sem `ASAAS_API_KEY` → fail-closed (`INTEGRATION_NOT_CONFIGURED`).
 */

/** Prefixo da referência externa para a ordem local (auditável). */
export const CHECKOUT_ORDER_REF_PREFIX = "instacessor:checkout:";

/** Resultado de iniciar um checkout hospedado público. */
export interface PublicCheckoutResult {
  ok: boolean;
  status: "CONFIGURED" | "INTEGRATION_NOT_CONFIGURED";
  message: string;
  /** Ordem local criada (estado PENDING). */
  order: CheckoutOrder | null;
  /** URL pública do checkout hospedado (quando ok). */
  checkoutUrl: string | null;
  /** Estado externo (quando ok). */
  externalCheckoutId: string | null;
}

/**
 * Resolve a ordem de compra local pela `externalReference` (ancorada no
 * webhook). Usada pela página pública de retorno (/checkout/retorno) e por
 * reconciliação/auditoria. NUNCA expõe dados sensíveis — apenas os campos que
 * a página precisa para mostrar o estado honesto.
 */
export async function findCheckoutOrderByReference(
  externalReference: string
): Promise<CheckoutOrder | null> {
  const ref = externalReference.trim();
  if (!ref) return null;
  try {
    return (await bll.checkoutOrder.findUnique({
      where: { externalReference: ref },
    })) as unknown as CheckoutOrder | null;
  } catch {
    return null;
  }
}

/** Gera uma referência externa única por compra (colisão astronomicamente improvável). */
export function buildExternalReference(email: string): string {
  const safe = normalizeEmail(email) ?? "cliente";
  const local = safe.replace(/[^a-z0-9@._-]/gi, "").slice(0, 64);
  return `${CHECKOUT_ORDER_REF_PREFIX}${local}:${randomUUID()}`;
}

/**
 * Lê o `asaasCustomerId` do comprador autenticado, quando existir.
 * Best-effort: qualquer falha devolve `null` e o checkout segue criando o
 * customer pelo e-mail — nunca bloqueia a compra por causa disso.
 */
async function readAsaasCustomerId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const user = (await bll.user.findUnique({
      where: { id: userId },
      select: { asaasCustomerId: true },
    })) as unknown as { asaasCustomerId: string | null } | null;
    return user?.asaasCustomerId ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria a ordem local (PENDING) e dispara o POST /v3/checkouts no Asaas.
 * `planId` é o id do plano (banco ou `plan:<slug>`); `planSlug` é resolvido
 * pelo id quando ausente. O comprador pode não ter User (`userId` ausente).
 */
export async function startPublicCheckout(input: {
  email: string;
  name: string | null;
  planId: string;
  /** User id apenas se o comprador já for um User nosso (opcional). */
  userId?: string | null;
}): Promise<PublicCheckoutResult> {
  const cfg = getAsaasConfig();
  const email = normalizeEmail(input.email) ?? "";

  // 1) Fail-closed: sem chave, nenhuma chamada HTTP e nenhuma URL fake.
  if (!cfg.apiKey) {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      message: "Pagamento online em configuração.",
      order: null,
      checkoutUrl: null,
      externalCheckoutId: null,
    };
  }
  if (!email) {
    return {
      ok: false,
      status: "CONFIGURED",
      message: "E-mail inválido.",
      order: null,
      checkoutUrl: null,
      externalCheckoutId: null,
    };
  }

  // 2) Plano SEMPRE resolvido no servidor (nunca preço vindo do browser).
  //    `getPlanById` aceita tanto o id real do banco quanto o id do catálogo
  //    (`plan:<slug>`) e faz fallback no catálogo oficial quando o banco está
  //    indisponível — mantendo o `planId` gravado FK-safe quando há banco.
  const plan = await getPlanById(input.planId);
  if (!plan || !plan.active) {
    return {
      ok: false,
      status: "CONFIGURED",
      message: "Plano não encontrado.",
      order: null,
      checkoutUrl: null,
      externalCheckoutId: null,
    };
  }

  // 3) Referência externa ÚNICA desta compra.
  const externalReference = buildExternalReference(email);

  // 4) Cria a ordem local em PENDING ANTES da chamada externa (reconciliação).
  //    `planId` é uma FK opcional. Quando `getPlanById` cai no FALLBACK do
  //    catálogo em memória (banco indisponível no momento da resolução), o id
  //    devolvido é `plan:<slug>` — que NÃO existe na tabela `Plan`. Gravar isso
  //    violaria a FK e derrubaria o checkout com um 500. Nesse caso enviamos
  //    `null` (a coluna aceita nulo) e seguimos: o `planSlug`/`planName`/
  //    `expectedAmountCents` já carregam tudo o que a ordem precisa para
  //    reconciliar no webhook.
  const planIdForOrder = plan.id.startsWith("plan:") ? null : plan.id;

  const order = (await bll.checkoutOrder.create({
    data: {
      email,
      name: input.name ?? null,
      userId: input.userId ?? null,
      planId: planIdForOrder,
      planSlug: plan.slug,
      planName: plan.name,
      expectedAmountCents: plan.priceCents,
      currency: plan.currency,
      billingType: plan.type, // "ONE_TIME" | "RECURRING"
      billingInterval: plan.billingInterval ?? null,
      status: "PENDING",
      externalReference,
      externalCheckoutId: null,
      externalPaymentId: null,
      externalSubscriptionId: null,
      paidAt: null,
      audit: { step: "order_created", at: new Date().toISOString() },
      // `id` e `updatedAt` NÃO são informados de propósito: são gerados pelo
      // Prisma (`@default(cuid())` e `@updatedAt` no schema). Enviá-los aqui
      // como `undefined` era o que disparava o PrismaClientValidationError
      // no fluxo público do checkout.
    },
  })) as unknown as CheckoutOrder;

  // 5) Chama o checkout hospedado oficial (POST /v3/checkouts).
  //    Se o comprador já é nosso User e já tem customer no Asaas, REUTILIZA —
  //    evita criar um segundo customer para a mesma pessoa. Sem customerId,
  //    enviamos `customerData` (nome/e-mail) para o Asaas criar o cliente.
  //    Os dois campos são mutuamente exclusivos.
  const asaasCustomerId = await readAsaasCustomerId(input.userId);

  let checkout: AsaasCheckoutResponse;
  try {
    checkout = await asaasClient.post<AsaasCheckoutResponse>(
      "/checkouts",
      buildHostedCheckoutRequest({
        plan,
        externalReference,
        billingType: cfg.billingType,
        asaasCustomerId,
        buyerName: input.name ?? null,
        buyerEmail: email,
      }),
      cfg
    );
  } catch (err) {
    // Falha ao criar o checkout no Asaas → marca a ordem como FAILED e devolve
    // erro honesto. O comprador pode tentar novamente (nova ordem).
    try {
      await bll.checkoutOrder.update({
        where: { id: order.id },
        data: {
          status: "FAILED",
          audit: {
            step: "asaas_checkout_failed",
            at: new Date().toISOString(),
            error: err instanceof Error ? err.message : "Erro ao chamar o Asaas",
          },
        },
      });
    } catch {
      /* segue */
    }
    console.error("[asaas-checkout-order] falha ao criar checkout no Asaas", err);
    return {
      ok: false,
      status: "CONFIGURED",
      message: "Não foi possível iniciar o pagamento. Tente novamente.",
      order,
      checkoutUrl: null,
      externalCheckoutId: null,
    };
  }

  const checkoutUrl = extractCheckoutUrl(checkout);

  // 6) Persiste o id do checkout externo + URL (status segue PENDING).
  try {
    await bll.checkoutOrder.update({
      where: { id: order.id },
      data: {
        externalCheckoutId: checkout.id ?? null,
        audit: {
          step: "checkout_created",
          at: new Date().toISOString(),
          checkoutReturnedUrl: Boolean(checkoutUrl),
        },
      },
    });
  } catch {
    /* segue — a ordem já tem o essencial */
  }

  // Se o Asaas não devolveu URL, a ordem fica PENDING porém sem URL (auditável).
  if (!checkoutUrl) {
    return {
      ok: false,
      status: "CONFIGURED",
      message: "Pagamento criado, mas sem URL de pagamento. Tente novamente.",
      order,
      checkoutUrl: null,
      externalCheckoutId: checkout.id ?? null,
    };
  }

  return {
    ok: true,
    status: "CONFIGURED",
    message: "Checkout iniciado. O acesso é liberado somente após a confirmação do pagamento.",
    order,
    checkoutUrl,
    externalCheckoutId: checkout.id ?? null,
  };
}
