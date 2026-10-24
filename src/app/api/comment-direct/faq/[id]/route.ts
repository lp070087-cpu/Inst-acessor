import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { deleteFaq, updateFaq } from "@/lib/comment-direct/db";
import { updateFaqSchema } from "@/lib/validators/comment-direct";

export const dynamic = "force-dynamic";

/** PATCH / DELETE de uma FAQ — owner-check por `userId`. */
async function PATCHHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = updateFaqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const data = {
      ...parsed.data,
      ...(parsed.data.question ? { question: parsed.data.question.trim() } : {}),
      ...(parsed.data.answer ? { answer: parsed.data.answer.trim() } : {}),
      ...(parsed.data.keywords
        ? { keywords: parsed.data.keywords.map((k) => k.trim()).filter(Boolean) }
        : {}),
    };

    const faq = await updateFaq(session.user.id, (await params).id, data);
    if (!faq) return NextResponse.json({ error: "Resposta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, faq });
  } catch (err) {
    console.error("[comment-direct/faq/[id]] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível salvar a resposta." }, { status: 500 });
  }
}

async function DELETEHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const removed = await deleteFaq(session.user.id, (await params).id);
    if (!removed) return NextResponse.json({ error: "Resposta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-direct/faq/[id]] erro ao excluir", err);
    return NextResponse.json({ error: "Não foi possível excluir a resposta." }, { status: 500 });
  }
}

export const PATCH = withPremiumApi(PATCHHandler);

export const DELETE = withPremiumApi(DELETEHandler);
