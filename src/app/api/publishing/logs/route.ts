import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { pub } from "@/lib/publishing/db";
import { sanitizeMessage } from "@/lib/publishing/errors";

export const dynamic = "force-dynamic";

/**
 * FASE 7 — API DE LOGS / HISTÓRICO DE PUBLICAÇÃO (Parte 12)
 * ==========================================================
 * GET /api/publishing/logs — histórico de operações (filtros).
 *
 * Segurança: session-required + owner-check (userId da sessão).
 * Logs NUNCA contêm tokens/secrets/payloads sensíveis — o erro já vem
 * sanitizado, e aqui reforçamos com sanitizeMessage.
 */

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const operation = url.searchParams.get("operation") ?? undefined;
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

    const where: Record<string, unknown> = { userId };
    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (operation) where.operation = operation;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const rows = (await pub.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    })) as unknown as {
      id: string;
      userId: string;
      queueId: string | null;
      contentId: string | null;
      platform: string;
      operation: string;
      status: string;
      attempts: number;
      errorCode: string | null;
      errorMessage: string | null;
      externalId: string | null;
      provider: string | null;
      createdAt: Date;
    }[];

    return NextResponse.json({
      logs: rows.map((r) => ({
        id: r.id,
        queueId: r.queueId,
        contentId: r.contentId,
        platform: r.platform,
        operation: r.operation,
        status: r.status,
        attempts: r.attempts,
        errorCode: r.errorCode,
        // Reforço: nunca vaza segredos na resposta.
        errorMessage: r.errorMessage ? sanitizeMessage(r.errorMessage) : null,
        externalId: r.externalId,
        provider: r.provider,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[publishing-logs] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }
}
