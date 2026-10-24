import { settings } from "@/lib/admin/settings-db";

/**
 * AUDITORIA DAS MUDANÇAS COMERCIAIS (append-only)
 * ===============================================
 * Toda alteração feita pelo admin nos planos (ativar/desativar, ajustar
 * franquia, ligar/desligar promoção) deixa um registro imutável: QUEM, QUANDO e
 * O QUE mudou. Vive numa key própria de `SystemSetting`
 * (`billing.plan-audit.v1`) como um array JSON — evita migration, como combinado.
 *
 * A lista é CAPADA (`MAX_ENTRIES`) e mantém os registros MAIS RECENTES. Passar do
 * teto descarta os mais antigos — o objetivo é dar rastro recente para operação,
 * não ser um arquivo fiscal permanente. A entrada mais nova fica primeiro.
 *
 * Nada aqui permite editar ou apagar um registro: só `appendAudit` acrescenta.
 */

export const AUDIT_SETTING_KEY = "billing.plan-audit.v1";

/** Teto de registros guardados. Além disso, os mais antigos saem. */
export const MAX_AUDIT_ENTRIES = 200;

export interface AuditEntry {
  /** Id do registro (timestamp + aleatório — só para keys do React). */
  id: string;
  /** Instante ISO 8601 (UTC). */
  at: string;
  /** E-mail do admin que fez a alteração (a autoridade é o guard do servidor). */
  actor: string;
  /** Categoria da mudança. */
  action: "plan.active" | "plan.limits" | "promo.update";
  /** Slug do plano afetado (ou `null` quando a mudança é global, ex.: countdown). */
  slug: string | null;
  /** Descrição curta e legível em pt-BR. */
  summary: string;
  /** Valores antes/depois quando fizer sentido (opcional). */
  before?: unknown;
  after?: unknown;
}

function isEntry(v: unknown): v is AuditEntry {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.at === "string" &&
    typeof e.actor === "string" &&
    typeof e.action === "string" &&
    typeof e.summary === "string"
  );
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normaliza o payload cru (string JSON ou array) numa lista válida e capada. */
export function parseAuditLog(raw: unknown): AuditEntry[] {
  if (typeof raw === "string") {
    try {
      return parseAuditLog(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEntry).slice(0, MAX_AUDIT_ENTRIES);
}

/** Lê o log (mais recente primeiro). Nunca lança; devolve `[]` em falha. */
export async function readAuditLog(): Promise<AuditEntry[]> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: AUDIT_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (!row || row.value == null) return [];
    return parseAuditLog(row.value);
  } catch {
    return [];
  }
}

/**
 * Acrescenta um registro (mais recente primeiro) e respeita o teto.
 * Devolve o registro criado. NUNCA lança por falha de gravação: a auditoria não
 * pode impedir a ação comercial que o admin pediu — mas o erro é sinalizado no
 * console para a operação notar.
 */
export async function appendAudit(
  input: Omit<AuditEntry, "id" | "at">
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    ...input,
    id: makeId(),
    at: new Date().toISOString(),
  };
  try {
    const current = await readAuditLog();
    const next = [entry, ...current].slice(0, MAX_AUDIT_ENTRIES);
    const value = JSON.stringify(next);
    await settings.systemSetting.upsert({
      where: { key: AUDIT_SETTING_KEY },
      create: { key: AUDIT_SETTING_KEY, value },
      update: { value },
    });
  } catch (err) {
    console.error("[plan-audit] falha ao gravar registro de auditoria", err);
  }
  return entry;
}
