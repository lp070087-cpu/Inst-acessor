import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { pub } from "@/lib/publishing/db";
import { automationRateLimiter } from "@/lib/publishing/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * FASE 7 — FUNDAÇÃO DE AUTOMAÇÕES (Parte 14)
 * ===========================================
 * GET  /api/automations — lista regras do usuário
 * POST /api/automations — cria/atualiza uma regra (Comentário→DM futuro)
 * DELETE /api/automations?id=... — remove uma regra
 *
 * NENHUMA chamada real de DM, NENHUM disparo real por palavra-chave.
 * Apenas estrutura preparada: regra + avaliação registrada quando um evento
 * chegar via webhook (que também ainda não dispara ação externa).
 *
 * Session-required + owner-check.
 */

const ruleSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").max(80),
  trigger: z.string().min(2, "Gatilho é obrigatório"),
  platform: z.enum(["instagram", "tiktok"]).default("instagram"),
  keywords: z.array(z.string().max(40)).max(20).default([]),
  action: z.enum(["dm"]).default("dm"),
  enabled: z.boolean().default(false),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rows = (await pub.automationRule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) as unknown as {
      id: string;
      name: string;
      trigger: string;
      platform: string;
      keywords: string[];
      action: string;
      enabled: boolean;
      createdAt: Date;
      updatedAt: Date;
    }[];

    return NextResponse.json({
      rules: rows.map((r) => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        platform: r.platform,
        keywords: r.keywords,
        action: r.action,
        enabled: r.enabled,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[automations] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as automações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!automationRateLimiter.check(userId)) {
      return NextResponse.json({ error: "Muitas solicitações. Aguarde um momento." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = ruleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const created = await pub.automationRule.create({
      data: {
        userId,
        name: parsed.data.name,
        trigger: parsed.data.trigger,
        platform: parsed.data.platform,
        keywords: parsed.data.keywords,
        action: parsed.data.action,
        enabled: parsed.data.enabled,
      },
    });

    return NextResponse.json({ ok: true, rule: created });
  } catch (err) {
    console.error("[automations] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar a regra." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const existing = (await pub.automationRule.findUnique({ where: { id } })) as unknown as {
      userId: string;
    } | null;
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
    }

    await pub.automationRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[automations] erro ao excluir", err);
    return NextResponse.json({ error: "Não foi possível excluir a regra." }, { status: 500 });
  }
}
