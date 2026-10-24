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

  const envAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  return normalized === (envAdmin || OFFICIAL_ADMIN_EMAIL);
}

/**
 * Autorização administrativa efetiva (server-only): conta ATIVA, `role` ADMIN
 * registrada no banco E e-mail oficial. Nenhum dos dois sozinho basta — a role
 * não promove outro e-mail, e o e-mail não promove uma conta sem a role (um
 * cadastro novo nasce USER, então registrar o e-mail oficial não dá privilégio).
 */
export function isAuthorizedAdmin(
  user: { email: string | null; role?: string | null; status?: string | null } | null | undefined
): boolean {
  if (!user) return false;
  if (user.status !== undefined && user.status !== "ACTIVE") return false;
  return user.role === "ADMIN" && isOfficialAdminEmail(user.email);
}

/**
 * Lista os e-mails que têm privilégio administrativo (para exibição/segurança).
 * Apenas o canônico e, opcionalmente, o ADMIN_EMAIL do ambiente.
 */
export function authorizedAdminEmails(): string[] {
  const envAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  return [envAdmin || OFFICIAL_ADMIN_EMAIL];
}
