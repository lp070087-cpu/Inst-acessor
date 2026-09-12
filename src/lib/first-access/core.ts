/**
 * PRIMEIRO ACESSO — NÚCLEO PURO (sem banco)
 * ===========================================
 * Regras de negócio isoladas para testes determinísticos
 * (`npm run first-access:test`), sem instanciar Prisma.
 *
 * Princípios (fase "Primeiro Acesso"):
 *   - A identidade inicial do acesso é o E-MAIL da compra (origem ASAAS) ou
 *     da liberação manual (origem ADMIN_MANUAL).
 *   - NUNCA criar senha automática/fixa/previsível; o cliente cria a própria.
 *   - Somente saber o e-mail NÃO é prova de posse → token de uso único.
 *   - Tokens: aleatórios, com expiração, uso único, nunca em logs, inválidos
 *     após uso. Não usar JWT eterno para ativação.
 *   - Não revelar informação sensível sobre contas (anti-enumeração).
 */

import { createHash, randomBytes } from "node:crypto";

export type AccessOrigin = "INFINITEPAY" | "ASAAS" | "ADMIN_MANUAL";

export type AccessGrantStatus =
  | "PENDING_FIRST_ACCESS"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELED";

/** Estados possíveis de um direito de acesso. */
export const ACCESS_GRANT_STATUSES: AccessGrantStatus[] = [
  "PENDING_FIRST_ACCESS",
  "ACTIVE",
  "EXPIRED",
  "CANCELED",
];

/** Duração padrão de expiração do token de primeiro acesso (minutos). */
export const FIRST_ACCESS_TOKEN_TTL_MINUTES = 60;
/** Número de caracteres do token aleatório (base64url). */
export const FIRST_ACCESS_TOKEN_BYTES = 32;

/** Normaliza e-mail (trim + lowercase). Retorna null se inválido. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Valida força mínima de senha (alinhada ao cadastro: mín. 8). */
export function isStrongPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}

/**
 * Calcula o status efetivo de um grant, considerando o tempo.
 * - CANCELED permanece CANCELED.
 * - Se não expira (null), o status persistido é o efetivo.
 * - Se expirou (now > expiresAt) → EXPIRED (independente do persistido).
 * - Se ainda dentro do período → status persistido (ACTIVE/PENDING_FIRST_ACCESS).
 */
export function effectiveGrantStatus(
  persisted: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date
): AccessGrantStatus {
  if (persisted === "CANCELED") return "CANCELED";
  const base = (persisted ?? "PENDING_FIRST_ACCESS") as AccessGrantStatus;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return base;
}

/**
 * Verifica se o token de primeiro acesso ainda é válido.
 * - Já usado → inválido (replay).
 * - Expirado → inválido.
 * - Caso contrário, válido.
 */
export function isFirstAccessTokenUsable(
  token: {
    consumed: boolean;
    usedAt: Date | null;
    expiresAt: Date;
  },
  now: Date
): boolean {
  if (token.consumed) return false;
  if (token.usedAt) return false;
  if (token.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Gera um token aleatório opaco (base64url, ~43 chars). */
export function generateRandomToken(): string {
  return randomBytes(FIRST_ACCESS_TOKEN_BYTES).toString("base64url");
}

/** Faz hash do token (SHA-256 hex) — NUNCA armazenar o token cru. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Mensagem segura (anti-enumeração) para "e-mail sem acesso". */
export const EMAIL_NOT_ELIGIBLE_MESSAGE =
  "Se houver uma liberação de acesso para este e-mail, enviaremos um link seguro.";

/**
 * Valida se o origin informado é permitido.
 */
export function isValidOrigin(origin: string): origin is AccessOrigin {
  return (
    origin === "INFINITEPAY" ||
    origin === "ASAAS" ||
    origin === "ADMIN_MANUAL"
  );
}
