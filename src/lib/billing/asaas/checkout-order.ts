import { createHmac, randomUUID } from "crypto";

import { bll, type CheckoutOrder } from "@/lib/billing/db";
import { getPlanById } from "@/lib/billing/plans";
import { resolveCheckoutPrice } from "@/lib/billing/promo-db";
import { attemptCheckoutReservation } from "@/lib/billing/capacity-db";
import { normalizeEmail } from "@/lib/first-access/core";
import { asaasClient, AsaasHttpError } from "./client";
import { getAsaasConfig } from "./config";
import { buildHostedCheckoutRequest, extractCheckoutUrl, getAsaasCheckoutOrigin } from "./hosted-checkout";
import { getGatewayConfig } from "@/lib/billing/gateways/config";
import { CHECKOUT_SESSION_REF_PREFIX, type AsaasCheckoutResponse } from "./types";

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
  /**
   * Motivo TIPADO do bloqueio quando `ok === false` por CAPACIDADE.
   * `"capacity"` = sem vaga (teto atingido ou vendas fechadas). A rota traduz
   * isso num 409 e o cliente oferece a lista de espera. `undefined` nos demais
   * erros (integração, e-mail, plano) — nada de bloqueio de vaga.
   */
  reason?: "capacity" | "in_progress" | null;
  /** Detalhe do bloqueio de capacidade (para a UI decidir o que mostrar). */
  capacity?: {
    reason: string;
    used: number;
    maxPayers: number | null;
    seatsRemaining: number | null;
  } | null;
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

/** Janela em que um novo clique reaproveita o mesmo checkout hospedado (< minutesToExpire). */
export const CHECKOUT_REUSE_WINDOW_MS = 30 * 60_000;
/** Ordem ainda sem checkout externo é considerada "em criação" por este tempo. */
export const CHECKOUT_IN_FLIGHT_MS = 2 * 60_000;

/**
 * Impressão digital do checkout (HMAC-SHA256 com segredo do servidor) usada
 * para reaproveitar a ordem em duplo clique SEM expor o checkout de outra
 * pessoa: quem digita o e-mail de terceiros com outros dados não recebe a URL
 * (que traz os dados do comprador pré-preenchidos). Sem segredo configurado,
 * não há reaproveitamento (comportamento anterior).
 */
export function checkoutFingerprint(parts: Array<string | number | boolean | null | undefined>): string | null {
  const secret = (process.env.TOKEN_ENCRYPTION_KEY ?? "").trim();
  if (secret.length < 16) return null;
  return createHmac("sha256", `checkout-reuse:${secret}`)
    .update(JSON.stringify(parts.map((v) => (v === undefined ? null : v))))
    .digest("hex");
}

/** Gera uma referência externa única por compra (colisão astronomicamente improvável). */
export function buildExternalReference(email: string, sessionUserId?: string | null): string {
  // Checkout de SESSÃO autenticada: marcador durável com o id do User (ver
  // CHECKOUT_SESSION_REF_PREFIX). Nunca derivado de dado do navegador.
  const sessionId = (sessionUserId ?? "").trim();
  if (sessionId && /^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
    return `${CHECKOUT_SESSION_REF_PREFIX}${sessionId}:${randomUUID()}`;
  }
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
  /**
   * true SOMENTE quando a identidade veio de uma SESSÃO autenticada. Só então
   * o `User.asaasCustomerId` salvo é reutilizado (`customer`) — um comprador
   * anônimo que digita o e-mail de um User existente não pode abrir um checkout
   * vinculado ao customer (e aos dados) daquela pessoa.
   */
  reuseStoredCustomer?: boolean;
  /** Dados obrigatórios do comprador (checkout hospedado). Normalizados. */
  buyer?: {
    cpfCnpj?: string | null;
    phone?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    postalCode?: string | null;
    province?: string | null;
  } | null;
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
  // Check before plan/price reads, capacity reservation, order creation or HTTP.
  // The current API may return only an ID: every checkout therefore requires
  // an explicit hosted origin even when older responses include a direct link.
  if (!getAsaasCheckoutOrigin(cfg, process.env.VERCEL_ENV === "preview")) {
    console.error("[asaas-checkout-order] configuração de ASAAS_CHECKOUT_ORIGIN/ASAAS_BASE_URL inválida ou ausente");
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      message: "Pagamento online indisponível: a origem e o ambiente de checkout precisam ser configurados com segurança. Contate o suporte.",
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

  // 2b) Gateway: o plano precisa permitir Asaas (lido da config unificada).
  // Degradação honesta: se a config não puder ser lida, permite (o checkout
  // segue com Asaas — o padrão seguro).
  try {
    const gw = await getGatewayConfig();
    const allowed = gw.plans[plan.slug] ?? ["asaas"];
    const asaasEnabled = gw.gateways.asaas.enabled;
    if (!asaasEnabled || !allowed.includes("asaas")) {
      return {
        ok: false,
        status: "CONFIGURED",
        message: "Forma de pagamento indisponível para este plano.",
        order: null,
        checkoutUrl: null,
        externalCheckoutId: null,
      };
    }
  } catch {
    // segue — sem config, vale o padrão (Asaas)
  }

  // 3) PREÇO — resolvido AQUI, no servidor (P17–P21). O navegador nunca envia
  //    valor: ele envia o `planId`. A promoção (pré-venda) só se aplica se
  //    (a) o admin a mantiver ligada, (b) o countdown — se houver — ainda não
  //    venceu, e (c) o HISTÓRICO REAL do comprador ainda tiver direito a ela.
  //    Configuração inválida (promo ≥ cheio) é descartada e vale o preço cheio.
  const pricing = await resolveCheckoutPrice({
    slug: plan.slug,
    basePriceCents: plan.priceCents,
    userId: input.userId ?? null,
  });
  const chargeCents = pricing.priceCents;

  // 4) Referência externa ÚNICA desta compra.
  const externalReference = buildExternalReference(
    email,
    input.reuseStoredCustomer === true ? input.userId ?? null : null
  );

  // 5) RESERVA DE VAGA + criação da ordem local em PENDING, na MESMA transação.
  //    `planId` é uma FK opcional. Quando `getPlanById` cai no FALLBACK do
  //    catálogo em memória (banco indisponível no momento da resolução), o id
  //    devolvido é `plan:<slug>` — que NÃO existe na tabela `Plan`. Gravar isso
  //    violaria a FK e derrubaria o checkout com um 500. Nesse caso enviamos
  //    `null` (a coluna aceita nulo) e seguimos: o `planSlug`/`planName`/
  //    `expectedAmountCents` já carregam tudo o que a ordem precisa para
  //    reconciliar no webhook.
  //
  //    SEM VAGA → devolvemos `reason:"capacity"` e NENHUMA ordem é criada.
  //    A decisão (pagantes ativos + reservas) é tomada DENTRO da transação
  //    SERIALIZABLE, então dois compradores simultâneos nunca pegam a última
  //    vaga. Este é o chokepoint por onde TODA compra pública passa.
  const planIdForOrder = plan.id.startsWith("plan:") ? null : plan.id;

  const fingerprint = checkoutFingerprint([
    email,
    input.name ?? null,
    input.userId ?? null,
    input.reuseStoredCustomer === true,
    plan.slug,
    chargeCents,
    input.buyer?.cpfCnpj ?? null,
    input.buyer?.phone ?? null,
    input.buyer?.postalCode ?? null,
    input.buyer?.address ?? null,
    input.buyer?.addressNumber ?? null,
    input.buyer?.province ?? null,
  ]);

  const reservation = await attemptCheckoutReservation({
    email,
    name: input.name ?? null,
    userId: input.userId ?? null,
    planId: planIdForOrder,
    planSlug: plan.slug,
    planName: plan.name,
    // O valor ESPERADO pela ordem é o preço RESOLVIDO NO SERVIDOR, não o de
    // catálogo: é contra este número que o webhook valida o valor que o Asaas
    // confirmar. Um checkout criado com promoção e conferido contra o preço
    // cheio seria recusado como divergência; e um checkout com preço cheio
    // conferido contra a promoção liberaria acesso pagando menos.
    expectedAmountCents: chargeCents,
    currency: plan.currency,
    billingType: plan.type, // "ONE_TIME" | "RECURRING"
    billingInterval: plan.billingInterval ?? null,
    externalReference,
    audit: {
      step: "order_created",
      at: new Date().toISOString(),
      // Trilha de auditoria do PREÇO: qual foi cobrado, qual era o cheio e
      // por que a promoção aplicou (ou não). Nunca guarda dado pessoal.
      basePriceCents: pricing.basePriceCents,
      chargedPriceCents: chargeCents,
      promoApplied: pricing.applied,
      promoLabel: pricing.label,
      promoSkipReason: pricing.skipReason,
      promoCountdownRunning: pricing.countdownRunning,
      ...(fingerprint ? { checkoutFingerprint: fingerprint } : {}),
    },
    reuse: fingerprint
      ? { fingerprint, windowMs: CHECKOUT_REUSE_WINDOW_MS, inFlightMs: CHECKOUT_IN_FLIGHT_MS }
      : null,
    // `id` e `updatedAt` NÃO são informados de propósito: são gerados pelo
    // Prisma (`@default(cuid())` e `@updatedAt` no schema).
  });

  if (!reservation.ok) {
    // Sem vaga: NADA foi criado e NADA será cobrado. A rota traduz isto num 409
    // e o checkout oferece a lista de espera com a mensagem do admin.
    return {
      ok: false,
      status: "CONFIGURED",
      message: reservation.decision.message,
      order: null,
      checkoutUrl: null,
      externalCheckoutId: null,
      reason: "capacity",
      capacity: {
        reason: reservation.decision.reason,
        used: reservation.decision.used,
        maxPayers: reservation.decision.maxPayers,
        seatsRemaining: reservation.decision.seatsRemaining,
      },
    };
  }

  const order = reservation.order as unknown as CheckoutOrder;

  // 5b) DUPLO CLIQUE / REQUISIÇÕES SIMULTÂNEAS: a ordem pendente do MESMO
  //     checkout foi reaproveitada. Nenhuma nova cobrança é criada no Asaas.
  if (reservation.reused) {
    const reusedUrl = order.externalCheckoutId
      ? extractCheckoutUrl({ id: order.externalCheckoutId }, cfg)
      : null;
    if (reusedUrl) {
      return {
        ok: true,
        status: "CONFIGURED",
        message: "Checkout iniciado. O acesso é liberado somente após a confirmação do pagamento.",
        order,
        checkoutUrl: reusedUrl,
        externalCheckoutId: order.externalCheckoutId ?? null,
      };
    }
    return {
      ok: false,
      status: "CONFIGURED",
      reason: "in_progress",
      message: "Seu pagamento já está sendo preparado. Aguarde alguns segundos e tente novamente.",
      order: null,
      checkoutUrl: null,
      externalCheckoutId: null,
    };
  }

  // 6) Chama o checkout hospedado oficial (POST /v3/checkouts).
  //    Se o comprador já é nosso User e já tem customer no Asaas, REUTILIZA —
  //    evita criar um segundo customer para a mesma pessoa. Sem customerId,
  //    enviamos `customerData` (nome/e-mail) para o Asaas criar o cliente.
  //    Os dois campos são mutuamente exclusivos.
  const asaasCustomerId = input.reuseStoredCustomer === true
    ? await readAsaasCustomerId(input.userId)
    : null;

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
        buyerCpfCnpj: input.buyer?.cpfCnpj ?? null,
        buyerPhone: input.buyer?.phone ?? null,
        buyerAddress: input.buyer?.address ?? null,
        buyerAddressNumber: input.buyer?.addressNumber ?? null,
        buyerPostalCode: input.buyer?.postalCode ?? null,
        buyerProvince: input.buyer?.province ?? null,
        // Preço JÁ resolvido no servidor (catálogo + promoção + histórico real).
        chargePriceCents: chargeCents,
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
    // Log técnico SANITIZADO: apenas status/código/mensagem do erro conhecido
    // da API — nunca o corpo completo nem qualquer segredo (API key, token).
    const errStatus = err instanceof AsaasHttpError ? err.status : null;
    const errCode = err instanceof AsaasHttpError ? err.code : null;
    console.error(
      `[asaas-checkout-order] falha ao criar checkout no Asaas status=${errStatus ?? "-"} code=${errCode ?? "-"}`
    );
    return {
      ok: false,
      status: "CONFIGURED",
      message: "Não foi possível iniciar o pagamento. Tente novamente.",
      order,
      checkoutUrl: null,
      externalCheckoutId: null,
    };
  }

  const checkoutUrl = extractCheckoutUrl(checkout, cfg);

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
          // Só reaproveitável se houver URL comprovável.
          ...(fingerprint && checkoutUrl ? { checkoutFingerprint: fingerprint } : {}),
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
