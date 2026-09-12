import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";

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
 * Retorna a sessão autenticada e garante que o usuário é o ADMIN exclusivo.
 *
 * A autorização é SEMPRE feita no servidor, consultando o banco (fonte da
 * verdade) — nunca apenas escondendo botões na UI. A regra final valida o
 * e-mail normalizado contra `isOfficialAdminEmail` (canônico `lp070087@gmail.com`
 * ou `ADMIN_EMAIL` do ambiente). Usuários não autorizados (ou suspensos) são
 * redirecionados para /dashboard.
 *
 * Um usuário com `role === "ADMIN"` no banco, mas e-mail diferente do oficial,
 * NÃO recebe privilégios administrativos (caso de teste E).
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
    select: { email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE" || !isOfficialAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  return { session, user: { id: userId, role: "ADMIN" } };
}
