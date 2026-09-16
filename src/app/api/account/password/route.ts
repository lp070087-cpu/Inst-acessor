import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validators/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/account/password — troca de senha do usuário autenticado.
 *
 * POR QUE ESTA ROTA EXISTE
 * ------------------------
 * Até este bloco o app NÃO tinha nenhum fluxo de troca de senha: senha só era
 * criada no cadastro e no primeiro acesso. Ou seja, um botão "Alterar senha" na
 * tela seria decorativo. Em vez de exibir um botão que não faz nada, o fluxo foi
 * implementado de verdade — com as regras abaixo.
 *
 * SEGURANÇA
 * ---------
 *   - Sessão obrigatória; só o PRÓPRIO usuário troca a própria senha.
 *   - A senha ATUAL é exigida e conferida com `verifyPassword` (bcrypt). Sem
 *     isso, uma sessão aberta esquecida viraria troca definitiva de credencial.
 *   - A nova senha é validada por Zod (mín. 8, confirmação, diferente da atual)
 *     antes de qualquer gravação.
 *   - Nada aqui toca e-mail, tokens, cobrança ou sessões de outros usuários.
 *   - Nenhum valor de senha (nem hash) é devolvido ou registrado em log.
 *
 * Contas sem `passwordHash` (órfãs, criadas por webhook sem primeiro acesso)
 * recebem uma resposta específica — a tela orienta o primeiro acesso em vez de
 * fingir que a senha atual estava errada.
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message ?? "Dados inválidos.", field: issue?.path?.[0] ?? null },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Esta conta ainda não tem uma senha definida. Conclua o primeiro acesso para criar sua senha.",
          code: "NO_PASSWORD",
        },
        { status: 409 }
      );
    }

    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "A senha atual está incorreta.", field: "currentPassword" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/password] erro ao trocar senha", err);
    return NextResponse.json(
      { error: "Não foi possível alterar sua senha. Tente novamente." },
      { status: 500 }
    );
  }
}
