import { prisma } from "@/lib/db";
import type {
  Plan,
  Subscription,
  Payment,
  BillingEvent,
  User,
} from "@prisma/client";

/**
 * REPOSITORY — acesso tipado aos models da Fase 6.5 (Planos/Assinatura)
 * + Fase atual (Asaas real): BillingEvent e User.asaasCustomerId.
 *
 * Mesma estratégia das Fases 4/4.5/5/6 (`src/lib/ai/db.ts`,
 * `src/lib/gamification/db.ts`, `src/lib/planning/db.ts`):
 * o client gerado no sandbox ainda não conhece os models 6.5, então usamos
 * delegates via cast controlado com os tipos do shim
 * (`src/types/prisma-shim.d.ts`).
 *
 * A DONA DEVE rodar `npx prisma generate` localmente. Após isso, o client real
 * passa a ter os delegates nativamente e este módulo continua válido.
 */

type AnyPrismaClient = typeof prisma & Record<string, unknown>;
const p = prisma as AnyPrismaClient;

interface Delegate<T> {
  create(args: unknown): Promise<T>;
  findMany(args?: unknown): Promise<T[]>;
  findFirst(args?: unknown): Promise<T | null>;
  findUnique(args: unknown): Promise<T | null>;
  update(args: unknown): Promise<T>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<T>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  upsert(args: unknown): Promise<T>;
}

export const bll = {
  plan: p.plan as unknown as Delegate<Plan>,
  subscription: p.subscription as unknown as Delegate<Subscription>,
  payment: p.payment as unknown as Delegate<Payment>,
  billingEvent: p.billingEvent as unknown as Delegate<BillingEvent>,
  user: p.user as unknown as Delegate<User>,
  // Fase "Primeiro Acesso" — AccessGrant (origem ASAAS/ADMIN_MANUAL).
  accessGrant: p.accessGrant as unknown as Delegate<AccessGrant>,
  // Pedido de compra local (checkout hospedado Asaas).
  checkoutOrder: p.checkoutOrder as unknown as Delegate<CheckoutOrder>,
};

export interface AccessGrant {
  id: string;
  email: string;
  userId?: string | null;
  planId?: string | null;
  planName?: string | null;
  origin: string;
  status: string;
  startAt: Date;
  expiresAt?: Date | null;
  grantedByAdminId?: string | null;
  externalPaymentId?: string | null;
  externalSubscriptionId?: string | null;
  firstAccessCompleted: boolean;
  firstAccessCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckoutOrder {
  id: string;
  email: string;
  name?: string | null;
  userId?: string | null;
  planId?: string | null;
  planSlug: string;
  planName?: string | null;
  expectedAmountCents: number;
  currency: string;
  billingType: string;
  billingInterval?: string | null;
  status: string;
  externalReference: string;
  externalCheckoutId?: string | null;
  externalPaymentId?: string | null;
  externalSubscriptionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date | null;
  audit?: unknown;
}

export { prisma };
