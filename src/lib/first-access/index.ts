/**
 * PRIMEIRO ACESSO — SERVIÇO (server-only)
 * =========================================
 * Fluxo pós-pagamento/pós-liberação:
 *   1) O direito de acesso é vinculado ao E-MAIL (AccessGrant, origem
 *      ASAAS ou ADMIN_MANUAL).
 *   2) O cliente informa o e-mail → prova a posse (token de uso único) →
 *      cria a própria senha (bcrypt) → entra.
 *   3) NUNCA é criada senha automática/fixa; NUNCA se confirma que um
 *      e-mail tem acesso sem prova de posse (anti-enumeração).
 *
 * Segurança:
 *   - Tokens aleatórios com expiração, uso único, hash armazenado.
 *   - Não usa JWT eterno para ativação.
 *   - Respostas nunca incluem passwordHash/tokens/secrets.
 *   - `requestFirstAccess` NUNCA revela se o e-mail tem acesso.
 */

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  AccessGrantStatus,
  ACCESS_GRANT_STATUSES,
  EMAIL_NOT_ELIGIBLE_MESSAGE,
  FIRST_ACCESS_TOKEN_TTL_MINUTES,
  effectiveGrantStatus,
  generateRandomToken,
  hashToken,
  isFirstAccessTokenUsable,
  isStrongPassword,
  isValidOrigin,
  normalizeEmail,
} from "./core";

export type {
  AccessGrantStatus,
  AccessOrigin,
} from "./core";
export {
  ACCESS_GRANT_STATUSES,
  EMAIL_NOT_ELIGIBLE_MESSAGE,
  FIRST_ACCESS_TOKEN_TTL_MINUTES,
  effectiveGrantStatus,
  generateRandomToken,
  hashToken,
  isFirstAccessTokenUsable,
  isStrongPassword,
  isValidOrigin,
  normalizeEmail,
} from "./core";

// ------------------------------------------------------------
// Tipos de retorno (sempre seguros — nunca passwordHash/tokens)
// ------------------------------------------------------------

export interface FirstAccessLookupResult {
  ok: boolean;
  /** true se o e-mail tem acesso liberado (não expirado/cancelado). */
  eligible: boolean;
  /** Dados NÃO sensíveis exibidos na tela de boas-vindas. */
  grant: {
    email: string;
    planName: string | null;
    origin: string;
    startAt: string | null;
    expiresAt: string | null;
    status: AccessGrantStatus;
    alreadyCompleted: boolean;
  } | null;
}

export interface RequestFirstAccessResult {
  ok: boolean;
  /** Sempre a mesma mensagem genérica, independente de existir acesso. */
  message: string;
  /** true apenas se um token foi criado (para testes/diagnóstico internos). */
  tokenCreated: boolean;
  /** Expiração do token (para auditoria interna; nunca expõe o token cru). */
  tokenExpiresAt?: string | null;
  /**
   * TOKEN CRU — retornado APENAS UMA vez, no momento da criação, para que o
   * chamador possa (a) enviá-lo por e-mail via provider ou (b) exibi-lo em
   * modo desenvolvimento. NUNCA é armazenado (apenas o hash fica no banco).
   */
  rawToken?: string | null;
  /** E-mail normalizado para o qual o token foi criado. */
  email?: string | null;
}

export interface VerifyTokenResult {
  ok: boolean;
  /** E-mail associado ao token (preenchido quando ok). */
  email?: string;
  /** Motivo de falha seguro (não revela se e-mail existe). */
  message?: string;
  /** Dados do grant (quando ok). */
  grant?: {
    email: string;
    planName: string | null;
    origin: string;
    startAt: string | null;
    expiresAt: string | null;
    status: AccessGrantStatus;
  } | null;
  /** Se um User já existe com este e-mail. */
  userExists?: boolean;
}

export interface CreateFirstAccessAccountResult {
  ok: boolean;
  error?: string;
  /** true se a conta foi criada; false se já existia (vinculada). */
  created?: boolean;
  /** true se o primeiro acesso foi registrado. */
  firstAccessCompleted?: boolean;
  /** Código de erro seguro (para roteamento no frontend). */
  code?: "USER_EXISTS" | "INVALID_TOKEN" | "WEAK_PASSWORD" | "NOT_ELIGIBLE" | "ERROR";
}

export interface CompleteFirstAccessResult {
  ok: boolean;
  error?: string;
  code?: "NOT_ELIGIBLE" | "USER_NOT_FOUND" | "ERROR";
}

export interface CompleteTourResult {
  ok: boolean;
  error?: string;
}

// ------------------------------------------------------------
// Banco — delegates via cast (mesmo padrão de src/lib/billing/db.ts)
// ------------------------------------------------------------

type AnyPrismaClient = typeof prisma & Record<string, unknown>;
const p = prisma as AnyPrismaClient;

interface Delegate<T> {
  findUnique(args: unknown): Promise<T | null>;
  findFirst(args?: unknown): Promise<T | null>;
  findMany(args?: unknown): Promise<T[]>;
  create(args: unknown): Promise<T>;
  update(args: unknown): Promise<T>;
  updateMany(args?: unknown): Promise<{ count: number }>;
  upsert(args: unknown): Promise<T>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
}

interface AccessGrantRow {
  id: string;
  email: string;
  userId?: string | null;
  planName?: string | null;
  origin: string;
  status: string;
  startAt: Date | null;
  expiresAt: Date | null;
  firstAccessCompleted: boolean;
  firstAccessCompletedAt?: Date | null;
}

/** Campos de User usados nesta fase (novos campos via shim). */
interface UserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  firstAccessCompleted?: boolean;
  tourCompleted?: boolean;
}

interface FirstAccessTokenRow {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  consumed: boolean;
  userId?: string | null;
}

const fa = {
  accessGrant: p.accessGrant as unknown as Delegate<AccessGrantRow>,
  firstAccessToken: p.firstAccessToken as unknown as Delegate<FirstAccessTokenRow>,
  user: p.user as unknown as Delegate<UserRow>,
};

/**
 * Localiza o grant válido mais recente para o e-mail (não cancelado,
 * não expirado). Retorna null se não houver acesso liberado.
 * NÃO diferencia "e-mail sem acesso" de "e-mail inválido" externamente.
 */
export async function findEligibleGrant(
  email: string
): Promise<AccessGrantRow | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const now = new Date();
  const grants = (await fa.accessGrant.findMany({
    where: {
      email: normalized,
      status: { in: ["PENDING_FIRST_ACCESS", "ACTIVE"] },
    },
    orderBy: { createdAt: "desc" },
  })) as unknown as AccessGrantRow[];

  for (const grant of grants) {
    const status = effectiveGrantStatus(grant.status, grant.expiresAt, now);
    if (status === "EXPIRED" || status === "CANCELED") continue;
    // Se o grant já expirou mas está PENDING/ACTIVE persistido, atualiza no banco.
    if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) {
      try {
        await fa.accessGrant.update({
          where: { id: grant.id },
          data: { status: "EXPIRED" },
        });
      } catch {
        /* concorrência: segue com leitura */
      }
      continue;
    }
    return grant;
  }
  return null;
}

/**
 * Verifica se o e-mail tem acesso liberado (para a tela de boas-vindas,
 * já com prova de posse). Retorna dados NÃO sensíveis.
 */
export async function lookupFirstAccess(email: string): Promise<FirstAccessLookupResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, eligible: false, grant: null };
  }
  const grant = await findEligibleGrant(normalized);
  if (!grant) {
    return { ok: false, eligible: false, grant: null };
  }
  return {
    ok: true,
    eligible: true,
    grant: {
      email: grant.email,
      planName: grant.planName ?? null,
      origin: grant.origin,
      startAt: grant.startAt ? grant.startAt.toISOString() : null,
      expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
      status: effectiveGrantStatus(grant.status, grant.expiresAt, new Date()),
      alreadyCompleted: grant.firstAccessCompleted,
    },
  };
}

/**
 * ETAPA 1 — solicita o token de primeiro acesso para o e-mail.
 *
 * Anti-enumeração: a resposta é SEMPRE a mesma mensagem genérica,
 * quer o e-mail tenha acesso ou não. Se houver acesso, cria um token
 * de uso único. O envio REAL do e-mail é feito por um provider desacoplado
 * (ver `src/lib/email/`); sem provider configurado, o token é apenas
 * registrado (NUNCA fingimos envio).
 */
export async function requestFirstAccessToken(email: string): Promise<RequestFirstAccessResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, message: EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
  }

  const grant = await findEligibleGrant(normalized);
  if (!grant) {
    return { ok: false, message: EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
  }

  // Se o primeiro acesso já foi concluído para este e-mail, o cliente deve
  // usar o login normal. Não emitimos mais token.
  if (grant.firstAccessCompleted) {
    return { ok: false, message: EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
  }

  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + FIRST_ACCESS_TOKEN_TTL_MINUTES * 60_000
  );

  // Invalida tokens anteriores não usados (evita múltiplos ativos).
  try {
    await fa.firstAccessToken.updateMany({
      where: { email: normalized, consumed: false },
      data: { consumed: true, usedAt: new Date() },
    });
  } catch {
    /* segue */
  }

  try {
    await fa.firstAccessToken.create({
      data: {
        email: normalized,
        tokenHash,
        expiresAt,
        consumed: false,
        usedAt: null,
        userId: grant.userId ?? null,
      },
    });
  } catch {
    return { ok: false, message: EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
  }

  // O token cru é devolvido UMA vez, no momento da criação. O banco só guarda
  // o hash. O chamador decide o que fazer (enviar por e-mail ou exibir em dev).
  return {
    ok: true,
    message: EMAIL_NOT_ELIGIBLE_MESSAGE,
    tokenCreated: true,
    tokenExpiresAt: expiresAt.toISOString(),
    rawToken,
    email: normalized,
  };
}

/**
 * ETAPA 2 — verifica o token de uso único e retorna o e-mail + grant.
 * Consome o token APENAS quando a criação de conta/senha for concluída
 * (em `createFirstAccessAccount`), para permitir retry de UI.
 * Aqui apenas valida e devolve o e-mail.
 */
export async function verifyFirstAccessToken(token: string): Promise<VerifyTokenResult> {
  if (!token || token.length < 16) {
    return { ok: false, message: "Link inválido." };
  }
  const tokenHash = hashToken(token);
  const row = (await fa.firstAccessToken.findUnique({
    where: { tokenHash },
  })) as unknown as FirstAccessTokenRow | null;

  if (!row) {
    return { ok: false, message: "Link inválido." };
  }

  const usable = isFirstAccessTokenUsable(
    { consumed: row.consumed, usedAt: row.usedAt, expiresAt: row.expiresAt },
    new Date()
  );
  if (!usable) {
    return { ok: false, message: "Este link expirou ou já foi usado." };
  }

  const grant = await findEligibleGrant(row.email);
  if (!grant) {
    return { ok: false, message: "Link inválido." };
  }

  const existingUser = (await fa.user.findUnique({
    where: { email: row.email },
    select: { id: true, passwordHash: true },
  })) as unknown as { id: string; passwordHash: string | null } | null;

  return {
    ok: true,
    email: row.email,
    grant: {
      email: grant.email,
      planName: grant.planName ?? null,
      origin: grant.origin,
      startAt: grant.startAt ? grant.startAt.toISOString() : null,
      expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
      status: effectiveGrantStatus(grant.status, grant.expiresAt, new Date()),
    },
    userExists: Boolean(existingUser?.passwordHash),
  };
}

/**
 * ETAPA 3 — cria a conta e a senha (bcrypt) e marca o primeiro acesso.
 * - Se o User já existe com senha → apenas vincula o grant (não duplica).
 * - Se o User não existe → cria com a senha escolhida pelo cliente.
 * - Consome o token de uso único (replay-safe).
 */
export async function createFirstAccessAccount(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<CreateFirstAccessAccountResult> {
  if (!isStrongPassword(input.password)) {
    return { ok: false, code: "WEAK_PASSWORD", error: "A senha deve ter no mínimo 8 caracteres." };
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, code: "WEAK_PASSWORD", error: "As senhas não coincidem." };
  }

  const tokenHash = hashToken(input.token);
  const row = (await fa.firstAccessToken.findUnique({
    where: { tokenHash },
  })) as unknown as FirstAccessTokenRow | null;

  if (!row) {
    return { ok: false, code: "INVALID_TOKEN", error: "Link inválido." };
  }

  const usable = isFirstAccessTokenUsable(
    { consumed: row.consumed, usedAt: row.usedAt, expiresAt: row.expiresAt },
    new Date()
  );
  if (!usable) {
    return { ok: false, code: "INVALID_TOKEN", error: "Este link expirou ou já foi usado." };
  }

  // Consome o token ANTES de prosseguir (uso único — replay falha).
  try {
    await fa.firstAccessToken.update({
      where: { id: row.id },
      data: { consumed: true, usedAt: new Date() },
    });
  } catch {
    return { ok: false, code: "INVALID_TOKEN", error: "Este link expirou ou já foi usado." };
  }

  const grant = await findEligibleGrant(row.email);
  if (!grant) {
    return { ok: false, code: "NOT_ELIGIBLE", error: "Este link não está mais válido." };
  }

  const email = grant.email;
  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  // A) Usuário já existe? Vincula (não duplica).
  const existing = (await fa.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })) as unknown as { id: string; passwordHash: string | null } | null;

  let userId: string;
  let created = false;

  if (existing) {
    userId = existing.id;
    // Se não tinha senha (conta órfã criada por webhook), define agora.
    if (!existing.passwordHash) {
      await fa.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
    }
  } else {
    const user = (await fa.user.create({
      data: { email, passwordHash },
    })) as unknown as { id: string };
    userId = user.id;
    created = true;
  }

  // Vincula o grant ao usuário e marca primeiro acesso concluído.
  await fa.accessGrant.update({
    where: { id: grant.id },
    data: {
      userId,
      status: "ACTIVE",
      firstAccessCompleted: true,
      firstAccessCompletedAt: now,
    },
  });

  // Marca no User (não duplica UserProfile.onboardingCompleted).
  await fa.user.update({
    where: { id: userId },
    data: {
      firstAccessCompleted: true,
      firstAccessCompletedAt: now,
    },
  });

  return { ok: true, created, firstAccessCompleted: true };
}

/**
 * Completa o primeiro acesso de um usuário JÁ autenticado (ex.: webhook
 * marcou como liberado, mas o usuário entrou por outro caminho e precisa
 * ser marcado). Normalmente não é necessário — o fluxo principal passa por
 * `createFirstAccessAccount`.
 */
export async function completeFirstAccess(userId: string): Promise<CompleteFirstAccessResult> {
  const user = (await fa.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstAccessCompleted: true },
  })) as unknown as { id: string; email: string; firstAccessCompleted: boolean } | null;
  if (!user) {
    return { ok: false, code: "USER_NOT_FOUND", error: "Usuário não encontrado." };
  }

  const now = new Date();
  if (!user.firstAccessCompleted) {
    await fa.user.update({
      where: { id: userId },
      data: { firstAccessCompleted: true, firstAccessCompletedAt: now },
    });
  }

  // Também marca grants pendentes do e-mail.
  try {
    const grants = (await fa.accessGrant.findMany({
      where: { email: user.email, firstAccessCompleted: false },
    })) as unknown as AccessGrantRow[];
    for (const grant of grants) {
      await fa.accessGrant.update({
        where: { id: grant.id },
        data: {
          userId,
          status: "ACTIVE",
          firstAccessCompleted: true,
          firstAccessCompletedAt: now,
        },
      });
    }
  } catch {
    /* segue */
  }

  return { ok: true };
}

/**
 * Registra a conclusão/pulo do tour guiado.
 */
export async function completeTour(userId: string): Promise<CompleteTourResult> {
  try {
    await fa.user.update({
      where: { id: userId },
      data: { tourCompleted: true, tourCompletedAt: new Date() },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível registrar o tour." };
  }
}

export interface ActiveAccessInfo {
  /** true se há acesso válido neste momento. */
  active: boolean;
  /** Status efetivo (EXPIRED/CANCELED/ACTIVE/PENDING_FIRST_ACCESS). */
  status: string;
  /** Data de expiração (se houver). */
  expiresAt: string | null;
  /** Nome do plano vinculado (se houver). */
  planName: string | null;
  /** true se o usuário ainda precisa concluir o primeiro acesso. */
  needsFirstAccess: boolean;
}

/**
 * Consulta o acesso ATIVO mais recente do usuário (owner-check).
 * Usado pelo layout do app para bloquear recursos quando o acesso expirou.
 * NUNCA deleta o User — apenas informa a expiração.
 */
export async function getActiveAccessForUser(
  userId: string
): Promise<ActiveAccessInfo> {
  const grants = (await fa.accessGrant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })) as unknown as AccessGrantRow[];

  const now = new Date();

  // Garante que usuários que já concluíram o primeiro acesso tenham um grant
  // ACTIVE (para o layout não bloquear por falta de grant). Se não houver
  // nenhum grant, assume que o acesso está liberado (usuários antigos).
  if (grants.length === 0) {
    return {
      active: true,
      status: "ACTIVE",
      expiresAt: null,
      planName: null,
      needsFirstAccess: false,
    };
  }

  const activeGrant = grants.find((g) => g.userId === userId);
  const grant = activeGrant ?? grants[0];

  const status = effectiveGrantStatus(grant.status, grant.expiresAt, now);
  const needsFirstAccess = status === "PENDING_FIRST_ACCESS";

  return {
    active: status === "ACTIVE",
    status,
    expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
    planName: grant.planName ?? null,
    needsFirstAccess,
  };
}
