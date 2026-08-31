/**
 * ADMIN ÚNICO E EXCLUSIVO — Fonte de verdade de autorização administrativa.
 * ===========================================================================
 * Regra oficial (escopo permanente): SOMENTE o e-mail abaixo (normalizado) é
 * administrador. A `role` no banco NÃO concede privilégios administrativos por
 * si só — a autorização é SEMPRE validada contra este módulo no servidor.
 *
 * - A regra final valida o e-mail normalizado: `lp070087@gmail.com`.
 * - Se existir `ADMIN_EMAIL` no ambiente, ela é aceita como sobrescrita, mas o
 *   sistema CONTINUA garantindo que apenas e-mails autorizados sejam admin.
 *   (Por padrão, sem env, apenas o e-mail canônico abaixo é autorizado.)
 * - NUNCA importar este módulo em componentes client.
 *
 * Exemplos dos casos de teste:
 *   CASO A — lp070087@gmail.com            → pode acessar Admin.
 *   CASO E — role ADMIN no banco, e-mail diferente → NÃO recebe privilégios.
 */

/** E-mail canônico do administrador exclusivo (normalizado). */
export const OFFICIAL_ADMIN_EMAIL = "lp070087@gmail.com";

/** Normaliza um e-mail para comparação (trim + lowercase). */
export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Autoriza um usuário como administrador por e-mail (normalizado).
 * Server-only. Nunca confia apenas em `role` vinda do banco/cliente.
 */
export function isOfficialAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return false;

  // E-mail canônico (sempre autorizado).
  if (normalized === OFFICIAL_ADMIN_EMAIL) return true;

  // Sobrescrita por variável de ambiente (opcional). Se o DONO definir
  // ADMIN_EMAIL, apenas esse e-mail (normalizado) também é aceito. Nunca
  // criamos um segundo administrador: sem env, o canônico é o único.
  const envAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (envAdmin && normalized === envAdmin) return true;

  return false;
}

/**
 * Lista os e-mails que têm privilégio administrativo (para exibição/segurança).
 * Apenas o canônico e, opcionalmente, o ADMIN_EMAIL do ambiente.
 */
export function authorizedAdminEmails(): string[] {
  const emails = [OFFICIAL_ADMIN_EMAIL];
  const envAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (envAdmin && envAdmin !== OFFICIAL_ADMIN_EMAIL) emails.push(envAdmin);
  return emails;
}
