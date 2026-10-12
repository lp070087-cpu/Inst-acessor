import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { createFaq, listFaqs } from "@/lib/comment-direct/db";
import { createFaqSchema } from "@/lib/validators/comment-direct";

export const dynamic = "force-dynamic";

/**
 * GET  /api/comment-direct/faq — lista as respostas frequentes do usuário
 * POST /api/comment-direct/faq — cria uma FAQ
 *
 * A FAQ é a BASE AUTORIZADA que a IA usa para sugerir respostas no Direct. O
 * que não estiver aqui a IA não pode inventar.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const faqs = await listFaqs(session.user.id);
    return NextResponse.json({ faqs });
  } catch (err) {
    console.error("[comment-direct/faq] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as respostas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createFaqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const faq = await createFaq(session.user.id, {
      question: parsed.data.question.trim(),
      answer: parsed.data.answer.trim(),
      keywords: parsed.data.keywords.map((k) => k.trim()).filter(Boolean),
      category: parsed.data.category,
    });

    return NextResponse.json({ ok: true, faq });
  } catch (err) {
    console.error("[comment-direct/faq] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível salvar a resposta." }, { status: 500 });
  }
}
