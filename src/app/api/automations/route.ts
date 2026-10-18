import { withSessionApi } from "@/lib/auth/session-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { pub } from "@/lib/publishing/db";

export const dynamic = "force-dynamic";

/**
 * API DE AUTOMAÇÕES — SUPERADA (ponte)
 * ====================================
 * Esta API manipulava as regras LEGADAS (`AutomationRule`), que guardavam
 * palavras-chave mas NUNCA eram avaliadas por ninguém: o usuário configurava uma
 * palavra e nada acontecia. O motor REAL (Comentário → Direct) vive em
 * `CommentDirectRule`, avaliado por `evaluateComment` a partir do webhook de
 * comentários e gerenciado em `POST/PATCH/DELETE /api/comment-direct/rules`.
 *
 * Para não recriar o defeito (regras que não disparam), o POST NÃO cria mais
 * regras legadas: responde 410 apontando o caminho correto. GET (leitura) e
 * DELETE (limpeza do histórico) continuam funcionando — as linhas existentes
 * são PRESERVADAS e podem ser removidas pelo dono.
 *
 * GET    /api/automations          — lista as regras legadas (somente leitura)
 * POST   /api/automations          — 410: use /api/comment-direct/rules
 * DELETE /api/automations?id=...   — remove uma regra legada do usuário
 *
 * Session-required + owner-check.
 */

async function GETHandler(request: Request) {
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

/**
 * A criação de regra legada foi ENCERRADA: uma regra que ninguém avalia é uma
 * promessa falsa ao usuário. Redireciona para o motor real.
 */
async function POSTHandler() {
  return NextResponse.json(
    {
      error:
        "A criação de regras nesta tela foi descontinuada. Crie a regra em Respostas Inteligentes → Automações (endpoint /api/comment-direct/rules), que é o motor que realmente envia a mensagem privada.",
      code: "SUPERSEDED",
      use: "/api/comment-direct/rules",
    },
    { status: 410 }
  );
}

async function DELETEHandler(request: Request) {
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

export const GET = withSessionApi(GETHandler);

export const POST = withSessionApi(POSTHandler);

export const DELETE = withSessionApi(DELETEHandler);
