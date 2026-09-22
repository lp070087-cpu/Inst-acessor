import { prisma } from "@/lib/db";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";
import { effectiveGrantStatus } from "@/lib/first-access/core";
// A lista de rotas premium vive em `@/lib/navigation` para ser a MESMA fonte no
// servidor (aqui) e no client (a sidebar, que marca quais itens ficam
// bloqueados). Duas listas divergiriam com o tempo — uma dizendo "premium",
// a outra deixando entrar.
export { PREMIUM_ROUTES } from "@/lib/navigation";

/**
 * ACESSO PREMIUM — FONTE DE VERDADE (SERVER-ONLY)
 * ===============================================
 *
 * REGRA DE PRODUTO (escopo oficial):
 *
 *   CONTA ≠ ASSINATURA.
 *
 * Criar conta no Inst Acessor é gratuito e NÃO concede acesso premium. O acesso
 * premium só existe com UMA das duas provas:
 *
 *   1. um `AccessGrant` VÁLIDO (pagamento confirmado pelo webhook do Asaas,
 *      ou liberação manual feita pelo ADMIN); ou
 *   2. uma `Subscription` ATIVA e não vencida (mesma origem).
 *
 * O ADMIN exclusivo (`lp070087@gmail.com`) nunca é bloqueado — ele precisa
 * administrar contas sem ter comprado.
 *
 * O QUE ESTA FUNÇÃO **NÃO** FAZ (propositalmente):
 *   - NÃO cria grant, NÃO cria subscription, NÃO escreve nada no banco;
 *   - NÃO usa `localStorage`, querystring, cookie ou qualquer valor do
 *     navegador — só o `userId` da sessão, resolvido no servidor;
 *   - NÃO trata "sem grant" como "usuário antigo, libera por segurança".
 *     Foi exatamente esse fallback que fazia conta gratuita receber premium.
 *
 * Ausência de dado é ausência: sem grant e sem assinatura → `hasAccess: false`,
 * com `reason: "NO_ACCESS"`. Nunca um "true" por omissão.
 */

export type PremiumReason =
  /** ADMIN exclusivo — acesso administrativo, não comercial. */
  | "ADMIN"
  /** `AccessGrant` válido (Asaas confirmado ou liberação manual do ADMIN). */
  | "GRANT"
  /** `Subscription` ativa e ainda dentro do período pago. */
  | "SUBSCRIPTION"
  /** Conta existe, mas nunca teve direito de acesso pago. */
  | "NO_ACCESS"
  /** Teve direito de acesso e o período terminou. */
  | "EXPIRED"
  /** Teve direito de acesso e ele foi cancelado. */
  | "CANCELED"
  /** Ainda precisa concluir o primeiro acesso (prova de posse do e-mail). */
  | "PENDING_FIRST_ACCESS"
  /** Leitura impossível (banco indisponível) — NUNCA tratado como acesso. */
  | "UNKNOWN";

export interface PremiumAccess {
  /** Fonte decisória — útil para auditoria e para a UI explicar o motivo. */
  reason: PremiumReason;
  /** true SOMENTE com prova de acesso válida (ou ADMIN). */
  hasAccess: boolean;
  /** true quando o acesso vem de liberação manual do ADMIN (não é pagamento). */
  manual: boolean;
  /** Nome do plano vinculado ao acesso (quando houver). */
  planName: string | null;
  /** ISO da expiração (quando houver). */
  expiresAt: string | null;
}

const DENIED: PremiumAccess = {
  reason: "NO_ACCESS",
  hasAccess: false,
  manual: false,
  planName: null,
  expiresAt: null,
};

interface GrantLite {
  email: string | null;
  userId?: string | null;
  planName?: string | null;
  origin?: string | null;
  status: string;
  expiresAt: Date | null;
  createdAt?: Date;
}

interface SubscriptionLite {
  status: string;
  expiresAt: Date | null;
  planId?: string | null;
  provider?: string | null;
  amountCents?: number | null;
  accessSource?: string | null;
  createdAt?: Date;
}

const iso = (d: Date | null | undefined): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

/**
 * NÚCLEO PURO DA DECISÃO — sem banco, sem relógio implícito, sem I/O.
 *
 * Existe separado para poder ser EXECUTADO e conferido (bancada com controles
 * negativos): "conta sem grant não recebe premium" é uma afirmação que precisa
 * de prova, não de leitura de código. `resolvePremiumAccess` é só a camada que
 * lê o banco e entrega os dados aqui.
 *
 * @param input.email   e-mail do usuário (já resolvido pelo servidor)
 * @param input.isAdmin resultado de `isOfficialAdminEmail(email)`
 * @param input.now     instante de referência (injetado para o teste controlar)
 */
export function decidePremiumAccess(input: {
  email: string | null;
  isAdmin: boolean;
  grants: GrantLite[];
  subscriptions: SubscriptionLite[];
  now: Date;
}): PremiumAccess {
  const { isAdmin, grants, subscriptions, now } = input;

  // O ADMIN não depende de compra: ele administra contas, não assina.
  if (isAdmin) {
    return {
      reason: "ADMIN",
      hasAccess: true,
      manual: false,
      planName: null,
      expiresAt: null,
    };
  }

  // ---- 1. AccessGrant válido (Asaas confirmado / liberação manual) --------
  // A ordem é por `createdAt desc`: o grant mais recente é o que manda.
  for (const grant of grants) {
    const status = effectiveGrantStatus(grant.status, grant.expiresAt, now);
    if (status === "ACTIVE") {
      return {
        reason: "GRANT",
        hasAccess: true,
        manual: grant.origin === "ADMIN_MANUAL",
        planName: grant.planName ?? null,
        expiresAt: iso(grant.expiresAt),
      };
    }
  }

  // ---- 2. Subscription ativa e dentro do período -------------------------
  for (const sub of subscriptions) {
    const expires = sub.expiresAt ? sub.expiresAt.getTime() : null;
    // `expiresAt` nulo NÃO é acesso vitalício: sem data de fim não há prova de
    // período pago, então não libera. (Assinatura sem vencimento só existe
    // como estado inválido neste produto.)
    const active = sub.status === "ACTIVE" && expires !== null && expires > now.getTime();
    if (active) {
      return {
        reason: "SUBSCRIPTION",
        hasAccess: true,
        manual: sub.provider === "MANUAL" || sub.accessSource === "ADMIN_MANUAL",
        planName: null,
        expiresAt: iso(sub.expiresAt),
      };
    }
  }

  // ---- 3. Motivo exato da negativa (nunca "sem acesso" genérico) ---------
  const hasExpired =
    grants.some((g) => effectiveGrantStatus(g.status, g.expiresAt, now) === "EXPIRED") ||
    subscriptions.some(
      (s) => s.status === "EXPIRED" || (s.expiresAt !== null && s.expiresAt.getTime() <= now.getTime())
    );
  const hasCanceled =
    grants.some((g) => effectiveGrantStatus(g.status, g.expiresAt, now) === "CANCELED") ||
    subscriptions.some((s) => s.status === "CANCELED");
  const pendingFirstAccess = grants.some(
    (g) => effectiveGrantStatus(g.status, g.expiresAt, now) === "PENDING_FIRST_ACCESS"
  );

  return {
    ...DENIED,
    reason: hasExpired
      ? "EXPIRED"
      : hasCanceled
        ? "CANCELED"
        : pendingFirstAccess
          ? "PENDING_FIRST_ACCESS"
          : "NO_ACCESS",
  };
}

/**
 * Camada de I/O: para quem é o admin (e-mail do BANCO — nunca a sessão JWT, que
 * congela o valor no login), quais grants existem e quais assinaturas existem.
 * A decisão em si é de `decidePremiumAccess`.
 */
async function readPremiumSources(userId: string): Promise<{
  email: string | null;
  isAdmin: boolean;
  grants: GrantLite[];
  subscriptions: SubscriptionLite[];
}> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })) as unknown as { email: string | null } | null;

  const p = prisma as unknown as {
    accessGrant?: { findMany(args?: unknown): Promise<GrantLite[]> };
    subscription?: { findMany(args?: unknown): Promise<SubscriptionLite[]> };
  };

  const email = user?.email ?? null;

  // O grant é procurado por DOIS vínculos, e isso não é redundância:
  //
  //   - `userId`: caminho normal (o primeiro acesso vinculou o grant à conta);
  //   - `email`: o webhook do Asaas cria o grant ANTES de existir conta, com
  //     `userId: null` (comprador sem cadastro). Se esse comprador depois criar
  //     a conta por /cadastro em vez do link de ativação, o grant PAGO
  //     continuaria com `userId` nulo — e um filtro só por `userId` bloquearia
  //     um cliente que pagou. O e-mail é a ponte; nunca é fonte de privilégio
  //     porque o e-mail vem do banco, não do navegador.
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  const grantWhere = normalizedEmail
    ? { OR: [{ userId }, { email: normalizedEmail }] }
    : { userId };

  const grants =
    (await p.accessGrant?.findMany({
      where: grantWhere,
      orderBy: { createdAt: "desc" },
    })) ?? [];

  const subscriptions =
    (await p.subscription?.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) ?? [];

  return {
    email,
    isAdmin: isOfficialAdminEmail(email),
    grants,
    subscriptions,
  };
}

export async function resolvePremiumAccess(
  userId: string
): Promise<PremiumAccess> {
  try {
    const sources = await readPremiumSources(userId);
    return decidePremiumAccess({ ...sources, now: new Date() });
  } catch {
    // Banco indisponível: NEGAR e dizer que não foi possível LER. Dizer
    // "premium: sim" sem conseguir ler seria inventar um direito.
    return {
      reason: "UNKNOWN",
      hasAccess: false,
      manual: false,
      planName: null,
      expiresAt: null,
    };
  }
}
