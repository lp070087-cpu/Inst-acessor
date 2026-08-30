import { NextResponse } from "next/server";

import { requireAdminSession, requireSession } from "@/lib/auth/guard";
import {
  listQueue,
  cancelQueueItem,
  retryPublication,
  scheduleContent,
  publishContent,
} from "@/lib/publishing";
import { publishingRateLimiter } from "@/lib/publishing/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * FASE 7 — API DA CENTRAL DE PUBLICAÇÃO
 * ======================================
 * GET    /api/publishing — lista a fila de publicação (filtros)
 * POST   /api/publishing — agenda conteúdo para publicação (default)
 * POST   /api/publishing?action=publish — publica agora (enfileira + processa)
 * POST   /api/publishing?action=cancel&id=... — cancela item agendado
 * POST   /api/publishing?action=retry&id=... — re-tenta publicação falhada
 * POST   /api/publishing?action=process — processa itens vencidos (SOMENTE ADMIN)
 *
 * Todas session-required + owner-checked. NUNCA publica por tempo —
 * sempre via adapter com confirmação real.
 */

const scheduleSchema = z.object({
  contentId: z.string().min(1, "Conteúdo é obrigatório"),
  platform: z.enum(["instagram", "tiktok"]),
  format: z.string().min(1, "Formato é obrigatório"),
  scheduledAt: z.string().min(1).optional(),
  caption: z.string().optional(),
  hashtags: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaCount: z.number().optional(),
  mimeType: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const items = await listQueue(userId, { platform, status, from, to });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[publishing] erro ao listar fila", err);
    return NextResponse.json({ error: "Não foi possível carregar a fila de publicação." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Rate limit interno (por usuário) para mutações na fila.
    if (!publishingRateLimiter.check(userId)) {
      return NextResponse.json({ error: "Muitas solicitações. Aguarde um momento." }, { status: 429 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Ações que não usam body JSON.
    if (action === "cancel") {
      const queueId = url.searchParams.get("id");
      if (!queueId) {
        return NextResponse.json({ error: "Item não informado." }, { status: 400 });
      }
      const result = await cancelQueueItem(userId, queueId);
      if (!result) {
        return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, item: result });
    }

    if (action === "retry") {
      const queueId = url.searchParams.get("id");
      if (!queueId) {
        return NextResponse.json({ error: "Item não informado." }, { status: 400 });
      }
      const result = await retryPublication({ userId, queueId });
      return NextResponse.json(result);
    }

    if (action === "process") {
      // Operação de infraestrutura: processa a fila GLOBAL (não por usuário).
      // Restrita a ADMIN para que um usuário comum não possa disparar o worker.
      await requireAdminSession();
      const result = await processQueueSafe();
      return NextResponse.json(result);
    }

    // Corpo JSON (schedule default ou publish agora).
    const body = await request.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    if (action === "publish") {
      const result = await publishContent({
        userId,
        contentId: parsed.data.contentId,
        platform: parsed.data.platform,
        format: parsed.data.format,
        caption: parsed.data.caption ?? "",
        hashtags: parsed.data.hashtags ?? "",
        mediaUrl: parsed.data.mediaUrl ?? "",
        mediaCount: parsed.data.mediaCount ?? 0,
        mimeType: parsed.data.mimeType,
      });
      return NextResponse.json(result);
    }

    const result = await scheduleContent({
      userId,
      contentId: parsed.data.contentId,
      platform: parsed.data.platform,
      format: parsed.data.format,
      scheduledAt: parsed.data.scheduledAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[publishing] erro ao processar", err);
    return NextResponse.json({ error: "Não foi possível processar a solicitação." }, { status: 500 });
  }
}

/** Wrapper seguro: processa a fila apenas se o usuário for owner (dono). */
async function processQueueSafe() {
  // O processamento da fila é uma operação de infraestrutura — nesta fase
  // permitimos apenas para sessões autenticadas (dono validando local).
  const { processQueue } = await import("@/lib/publishing");
  const result = await processQueue(20);
  return { ok: true, processed: result.processed, published: result.published, failed: result.failed };
}
