import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

/**
 * Retorna a sessão autenticada ou redireciona para /login.
 * Uso: `const session = await requireSession();`
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Retorna a sessão autenticada e garante que o onboarding foi concluído.
 * Uso em páginas internas que dependem do perfil (ex.: dashboard).
 */
export async function requireOnboardedSession() {
  const session = await requireSession();
  const userId = session.user.id;

  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  if (!profile?.onboardingCompleted) {
    redirect("/onboarding");
  }

  return { session, profile };
}

/**
 * Retorna a sessão autenticada e garante que o usuário é ADMIN ativo.
 *
 * A autorização é SEMPRE feita no servidor, consultando o banco (fonte da
 * verdade) — nunca apenas escondendo botões na UI. Usuários não-admin (ou
 * suspensos) são redirecionados para /dashboard.
 *
 * Uso em páginas/rotas da área administrativa (`/admin` e `/api/admin/*`).
 */
export async function requireAdminSession(): Promise<{
  session: Session;
  user: { id: string; role: "ADMIN" };
}> {
  const session = await requireSession();
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    redirect("/dashboard");
  }

  return { session, user: { id: userId, role: "ADMIN" } };
}
