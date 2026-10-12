/**
 * PERMISSÕES DA META — AUDITORIA DE ESCOPO (NÚCLEO PURO)
 * =====================================================
 * O OAuth atual JÁ solicita `instagram_business_manage_messages` e persiste a
 * lista efetivamente CONCEDIDA em `SocialConnection.scopes`. Até agora nada
 * checava esse campo: o envio de DM dependia só de a Meta recusar na hora.
 *
 * Aqui a checagem é explícita e ANTES do envio. Isso importa por dois motivos:
 *   1. FAIL-CLOSED — sem prova de permissão, não envia (ver `hasScope`).
 *   2. UX — em vez de um erro genérico, a tela mostra "integração pendente /
 *      permissão não aprovada" já na abertura.
 *
 * Este arquivo NÃO faz I/O: recebe a string de `scopes` como dado. É puro e
 * testável por execução, no mesmo padrão de `triggers.ts`.
 */

/** Escopo necessário para enviar mensagem privada (Direct) no Instagram. */
export const SCOPE_MANAGE_MESSAGES = "instagram_business_manage_messages";
/** Escopo necessário para ler/responder comentários (já usado hoje). */
export const SCOPE_MANAGE_COMMENTS = "instagram_business_manage_comments";

/**
 * `SocialConnection.scopes` guarda a lista como a Meta devolveu: vírgula ou
 * espaço, às vezes ambos. Normalizamos para um conjunto sem repetição.
 *
 * NUNCA inferimos escopo por permissão de "o que o OAuth pediu": o que vale é
 * o que a Meta CONCEDEU e foi persistido aqui.
 */
export function parseScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * O usuário tem o escopo?
 *
 * FAIL-CLOSED: string ausente/vazia → `false`. Ausência de dado não é prova de
 * permissão; é ausência de prova.
 */
export function hasScope(raw: string | null | undefined, scope: string): boolean {
  const list = parseScopes(raw);
  if (list.length === 0) return false;
  return list.includes(scope);
}

/** Pode ENVIAR mensagem privada (Direct)? */
export function canManageMessages(raw: string | null | undefined): boolean {
  return hasScope(raw, SCOPE_MANAGE_MESSAGES);
}

/** Pode LER/responder comentários? */
export function canManageComments(raw: string | null | undefined): boolean {
  return hasScope(raw, SCOPE_MANAGE_COMMENTS);
}

export type PermissionCode = "granted" | "missing" | "unknown";

/**
 * Estado da permissão para a UI.
 *   - `granted`  → a Meta concedeu (a operação pode ser tentada);
 *   - `missing`  → a Meta NÃO concedeu (mostra "integração pendente");
 *   - `unknown`  → não temos a lista de escopos (nunca tratamos como concedida).
 */
export function permissionState(
  raw: string | null | undefined,
  scope: string
): PermissionCode {
  const list = parseScopes(raw);
  if (list.length === 0) return "unknown";
  return list.includes(scope) ? "granted" : "missing";
}

/**
 * Frase para o usuário quando falta a permissão de mensagens.
 * SEM jargão: não cita nome de escopo, endpoint nem "App Review".
 */
export const MISSING_MESSAGES_PERMISSION_NOTICE =
  "O Instagram ainda não liberou a leitura e o envio de mensagens privadas nesta conta. " +
  "A estrutura da automação fica salva e passa a funcionar automaticamente quando a Meta liberar o acesso.";
