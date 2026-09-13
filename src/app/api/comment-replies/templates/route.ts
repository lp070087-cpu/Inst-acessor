import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { createTemplate, listTemplates } from "@/lib/comment-replies/db";
import { createTemplateSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * Templates de resposta.
 *
 * A distinção `exactReply` implementa os dois comportamentos pedidos:
 *   • "Usar exatamente esta resposta"      → exactReply = true
 *   • "Usar como exemplo para a IA"        → exactReply = false
 */
export async function GET() {
  try {
    const session = await requireSession();
    const templates = await listTemplates(session.user.id);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[comment-replies/templates] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as respostas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const template = await createTemplate(session.user.id, parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    console.error("[comment-replies/templates] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível salvar a resposta." }, { status: 500 });
  }
}
