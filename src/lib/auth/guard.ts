import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";
import { resolvePremiumAccess } from "@/lib/access/premium";

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
 * Guarda dos MÓDULOS DO PLANO (IA, Score, Rank, Calendário Inteligente,
 * Respostas Inteligentes, Análise de Desempenho, Mentoria, Ideias e Perfil de
 * Inteligência).
 *
 * Chamada no TOPO de cada página premium, antes de qualquer leitura de dado:
 * sem direito de acesso (`resolvePremiumAccess`), redireciona para
 * `/acesso-restrito` — e nada é consultado nem renderizado antes disso.
 *
 * Por que a checagem mora na página e não no layout do route group: o layout
 * não conhece a própria rota (as páginas não recebem `pathname`), e depender de
 * um header repassado pelo middleware significaria que um header ausente LIBERA
 * o módulo — um erro silencioso na direção errada. Aqui, a página que exige
 * plano é a mesma que o declara, e a checagem roda em TODA requisição.
 *
 * Server Components têm renderização DUPLICADA; `redirect()` lança e é
 * memoizado, então a segunda passagem é barata.
 */
export async function requirePremiumPage(): Promise<void> {
  const session = await requireSession();
  const access = await resolvePremiumAccess(session.user.id);
  if (!access.hasAccess) {
    redirect("/acesso-restrito");
  }
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
