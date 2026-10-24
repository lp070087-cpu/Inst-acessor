import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/first-access/core";
import { INVITE_TTL_DAYS } from "@/lib/billing/capacity";

/**
 * LISTA DE ESPERA — ACESSO A DADOS
 * ==================================
 * Model novo `WaitlistEntry` (ver `prisma/schema.prisma` e a migration aditiva
 * `prisma/migrations/*_lista_de_espera`). O delegate ainda não existe no client
 * gerado do sandbox, então é acessado por cast controlado — mesmo padrão de
 * `billing/db.ts` e `admin/settings-db.ts`.
 *
 * A identidade é o E-MAIL NORMALIZADO (minúsculo, trim): entrar duas vezes com
 * o mesmo e-mail é idempotente (upsert por `email @unique`). NUNCA guardamos
 * nada além de nome/e-mail/notas — nenhum dado de pagamento.
 */

export type WaitlistStatus = "WAITING" | "INVITED" | "CONVERTED" | "EXPIRED";

export const WAITLIST_STATUSES: WaitlistStatus[] = [
  "WAITING",
  "INVITED",
  "CONVERTED",
  "EXPIRED",
];

export interface WaitlistEntryRow {
  id: string;
  name: string | null;
  email: string;
  status: string;
  invitedAt: Date | null;
  expiresAt: Date | null;
  notes: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WaitlistDelegate {
  create(args: unknown): Promise<WaitlistEntryRow>;
  findMany(args?: unknown): Promise<WaitlistEntryRow[]>;
  findFirst(args?: unknown): Promise<WaitlistEntryRow | null>;
  findUnique(args: unknown): Promise<WaitlistEntryRow | null>;
  update(args: unknown): Promise<WaitlistEntryRow>;
  updateMany(args?: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  upsert(args: unknown): Promise<WaitlistEntryRow>;
}

function delegate(): WaitlistDelegate {
  const p = prisma as unknown as { waitlistEntry?: WaitlistDelegate };
  if (!p.waitlistEntry) {
    throw new Error(
      "Model WaitlistEntry indisponível — rode `npx prisma generate` após aplicar a migration."
    );
  }
  return p.waitlistEntry;
}

/** `true` quando o model existe no client (pós `prisma generate`). */
export function waitlistAvailable(): boolean {
  return Boolean((prisma as unknown as { waitlistEntry?: unknown }).waitlistEntry);
}

/**
 * Entra na lista de espera — IDEMPOTENTE por e-mail normalizado.
 *
 * Se a pessoa já está na lista, NÃO cria duplicata: atualiza o nome (quando
 * informado) e mantém o status atual. Devolve `created: false` para a UI poder
 * dizer "você já está na lista" em vez de fingir um cadastro novo.
 *
 * Quem JÁ tem convite vencedor não regride: um reingresso NÃO rebaixa o status
 * de `INVITED` de volta para `WAITING`.
 */
export async function joinWaitlist(input: {
  name?: string | null;
  email: string;
  notes?: string | null;
}): Promise<{ entry: WaitlistEntryRow; created: boolean }> {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("E-mail inválido.");
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 160) : null;
  const notes =
    typeof input.notes === "string" && input.notes.trim()
      ? input.notes.trim().slice(0, 500)
      : null;

  const existing = await delegate().findUnique({ where: { email } });
  if (existing) {
    if (name && name !== existing.name) {
      const updated = await delegate().update({
        where: { id: existing.id },
        data: { name },
      });
      return { entry: updated, created: false };
    }
    return { entry: existing, created: false };
  }

  const entry = await delegate().create({
    data: {
      email,
      name,
      notes,
      status: "WAITING",
    },
  });
  return { entry, created: true };
}

/** Lista paginada (admin). `status` filtra; `null` = todas. */
export async function listWaitlist(opts?: {
  status?: WaitlistStatus | null;
  take?: number;
}): Promise<WaitlistEntryRow[]> {
  const where = opts?.status ? { status: opts.status } : {};
  return delegate().findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts?.take ?? 200, 1), 500),
  });
}

/** Contagem por status (para os cartões do painel). */
export async function countWaitlistByStatus(): Promise<Record<WaitlistStatus, number>> {
  const rows = await delegate().findMany({ select: { status: true } });
  const out: Record<WaitlistStatus, number> = {
    WAITING: 0,
    INVITED: 0,
    CONVERTED: 0,
    EXPIRED: 0,
  };
  for (const r of rows as unknown as { status: string }[]) {
    if ((WAITLIST_STATUSES as string[]).includes(r.status)) {
      out[r.status as WaitlistStatus] += 1;
    }
  }
  return out;
}

/** Quantos convites ainda vigentes (seguram vaga). */
export async function countActiveInvites(now: Date = new Date()): Promise<number> {
  return delegate().count({ where: { status: "INVITED", expiresAt: { gt: now } } });
}

/**
 * Convida uma entrada: status → INVITED, `invitedAt`/`expiresAt` definidos.
 * Expiração PADRAO de 7 dias (`INVITE_TTL_DAYS`). Idempotente na prática: se
 * já estava convidada e o convite não venceu, apenas renova o prazo.
 */
export async function inviteWaitlistEntry(
  id: string,
  opts?: { ttlDays?: number }
): Promise<WaitlistEntryRow | null> {
  const existing = await delegate().findUnique({ where: { id } });
  if (!existing) return null;
  const now = new Date();
  const ttlDays = opts?.ttlDays && opts.ttlDays > 0 ? opts.ttlDays : INVITE_TTL_DAYS;
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000);
  return delegate().update({
    where: { id },
    data: { status: "INVITED", invitedAt: now, expiresAt },
  });
}

/** Marca como CONVERTED (virou pagante). Marca o instante. */
export async function markWaitlistConverted(
  id: string
): Promise<WaitlistEntryRow | null> {
  const existing = await delegate().findUnique({ where: { id } });
  if (!existing) return null;
  return delegate().update({
    where: { id },
    data: { status: "CONVERTED", convertedAt: new Date() },
  });
}

/** Marca como EXPIRED (convite venceu ou admin desistiu). */
export async function expireWaitlistEntry(id: string): Promise<WaitlistEntryRow | null> {
  const existing = await delegate().findUnique({ where: { id } });
  if (!existing) return null;
  return delegate().update({ where: { id }, data: { status: "EXPIRED" } });
}

/** Remove uma entrada da lista. */
export async function removeWaitlistEntry(id: string): Promise<void> {
  const p = prisma as unknown as {
    waitlistEntry?: { delete(args: unknown): Promise<unknown> };
  };
  if (p.waitlistEntry) await p.waitlistEntry.delete({ where: { id } });
}

/**
 * Rebaixa convites VENCIDOS de INVITED → EXPIRED. Devolve quantos mudaram.
 * A expiração também é aplicada na leitura (o status efetivo é derivado), então
 * este é apenas um saneamento para o painel ficar honesto — não é a regra.
 */
export async function sweepExpiredInvites(now: Date = new Date()): Promise<number> {
  const res = await delegate().updateMany({
    where: { status: "INVITED", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  return res.count;
}

/** Quem tem convite vigente para este e-mail? (usado no checkout) */
export async function findActiveInvite(
  email: string,
  now: Date = new Date()
): Promise<WaitlistEntryRow | null> {
  const e = normalizeEmail(email);
  if (!e) return null;
  try {
    return await delegate().findFirst({
      where: { email: e, status: "INVITED", expiresAt: { gt: now } },
    });
  } catch {
    return null;
  }
}

/**
 * Quando o pagamento de um convidado é confirmado, marca CONVERTED por e-mail.
 * Best-effort: falha não derruba o webhook.
 */
export async function convertByEmail(email: string): Promise<void> {
  const e = normalizeEmail(email);
  if (!e) return;
  try {
    await delegate().updateMany({
      where: { email: e, status: { in: ["INVITED", "WAITING"] } },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });
  } catch {
    /* nunca derruba o fluxo de acesso */
  }
}
