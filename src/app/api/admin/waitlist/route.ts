import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { waitlistAdminActionSchema } from "@/lib/validators/waitlist";
import {
  countWaitlistByStatus,
  expireWaitlistEntry,
  inviteWaitlistEntry,
  markWaitlistConverted,
  removeWaitlistEntry,
  sweepExpiredInvites,
  waitlistAvailable,
} from "@/lib/billing/waitlist-db";
import { getCapacityStatus } from "@/lib/billing/capacity-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * LISTA DE ESPERA — API do ADMIN
 * =================================
 * GET  /api/admin/waitlist  → status de capacidade + entradas + contagens
 * POST /api/admin/waitlist  → ações (convidar / expirar / converter / remover)
 *
 * Guardado por `requireAdminSession()` (autorização server-side por e-mail —
 * nunca por role no banco). "Liberar vaga" aqui cria um CONVITE vigente, que
 * SEGURA uma vaga na contagem e permite a essa pessoa comprar mesmo com a loja
 * lotada (ver `decideCapacity`, regra do convite).
 */

export async function GET() {
  await requireAdminSession();
  if (!waitlistAvailable()) {
    return NextResponse.json(
      { error: "Lista de espera indisponível (migration não aplicada)." },
      { status: 503 }
    );
  }
  try {
    // Saneia convites vencidos antes de mostrar (painel honesto).
    await sweepExpiredInvites();
    const [counts, status] = await Promise.all([
      countWaitlistByStatus(),
      getCapacityStatus(null),
    ]);
    return NextResponse.json({
      ok: true,
      counts,
      capacity: status.config,
      decision: status.decision,
    });
  } catch {
    console.error("[admin-waitlist] falha ao ler a lista de espera");
    return NextResponse.json(
      { error: "Não foi possível ler a lista de espera." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  await requireAdminSession();
  if (!waitlistAvailable()) {
    return NextResponse.json(
      { error: "Lista de espera indisponível (migration não aplicada)." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = waitlistAdminActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { action, id, ttlDays } = parsed.data;

  try {
    switch (action) {
      case "invite":
      case "release": {
        // "Liberar vaga" é um convite vigente — a vaga é segurada para esta
        // pessoa até o convite expirar.
        const updated = await inviteWaitlistEntry(id, { ttlDays });
        if (!updated) {
          return NextResponse.json({ error: "Entrada não encontrada." }, { status: 404 });
        }
        return NextResponse.json({ ok: true, action, entry: updated });
      }
      case "expire": {
        const updated = await expireWaitlistEntry(id);
        if (!updated) {
          return NextResponse.json({ error: "Entrada não encontrada." }, { status: 404 });
        }
        return NextResponse.json({ ok: true, action, entry: updated });
      }
      case "convert": {
        const updated = await markWaitlistConverted(id);
        if (!updated) {
          return NextResponse.json({ error: "Entrada não encontrada." }, { status: 404 });
        }
        return NextResponse.json({ ok: true, action, entry: updated });
      }
      case "remove": {
        await removeWaitlistEntry(id);
        return NextResponse.json({ ok: true, action });
      }
      default:
        return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch {
    console.error("[admin-waitlist] falha ao executar ação");
    return NextResponse.json({ error: "Não foi possível concluir a ação." }, { status: 500 });
  }
}
