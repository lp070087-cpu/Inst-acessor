import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";
import { getActiveAccessForUser } from "@/lib/first-access";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  // Estado do usuário no banco (fase "Primeiro Acesso").
  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, firstAccessCompleted: true, passwordHash: true },
  } as unknown as never)) as unknown as {
    id: string;
    email: string | null;
    firstAccessCompleted: boolean;
    passwordHash: string | null;
  } | null;

  // Autorização do ADMIN é decidida NO SERVIDOR (nunca no client), pela mesma
  // regra oficial (`isOfficialAdminEmail`) usando o e-mail do BANCO (fonte da
  // verdade — idêntico ao `requireAdminSession`). Apenas o e-mail canônico
  // normalizado recebe o item "Admin" no menu. Clientes comuns nunca veem.
  const isAdmin = isOfficialAdminEmail(user?.email ?? null);

  // Expiração/estado do acesso (PENDING_FIRST_ACCESS / ACTIVE / EXPIRED / CANCELED).
  const access = await getActiveAccessForUser(session.user.id);

  // PRIMEIRO ACESSO — o fluxo de ativação (criar a própria senha) só se aplica
  // a usuários com um grant pendente (PENDING_FIRST_ACCESS) que AINDA NÃO
  // possuem senha. Usuários com senha (conta criada via /cadastro ou já
  // ativada) passam direto — isso elimina o ciclo /primeiro-acesso ↔ /dashboard
  // que deixava a página piscando para contas legadas.
  const needsActivation =
    access.status === "PENDING_FIRST_ACCESS" && !user?.passwordHash;
  if (needsActivation) {
    redirect("/primeiro-acesso");
  }

  // Garante que o onboarding foi concluído antes de entrar no app
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingCompleted: true },
  });

  if (!profile?.onboardingCompleted) {
    redirect("/onboarding");
  }

  // Expiração real: apenas EXPIRED/CANCELED bloqueiam os recursos pagos.
  // PENDING_FIRST_ACCESS é estado de ativação, NÃO de expiração — por isso não
  // usamos `!access.active` aqui (equivaleria a mandar quem ainda vai ativar
  // para a tela de renovação).
  if (access.status === "EXPIRED" || access.status === "CANCELED") {
    redirect("/expirado");
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <AppSidebar user={session.user} isAdmin={isAdmin} />
        <main className="lg:pl-72 min-h-screen flex flex-col min-w-0">
          {/* `min-w-0` é o que permite os filhos encolherem: em flex, o
              item herda `min-width:auto` e qualquer conteúdo largo (tabela,
              gráfico, texto sem quebra) força a coluna a crescer e a página
              inteira a rolar na horizontal. Com `min-w-0` a largura fica
              limitada ao container e o filho é quem resolve o excesso. */}
          <div className="flex-1 min-w-0 px-5 sm:px-8 lg:px-10 py-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
