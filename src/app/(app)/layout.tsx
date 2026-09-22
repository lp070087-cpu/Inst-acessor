import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";
import { resolvePremiumAccess } from "@/lib/access/premium";
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

  // ACESSO EFETIVO (fonte única): grant válido OU assinatura ativa OU ADMIN.
  //
  // Aqui o valor só marca a sidebar (cadeado). QUEM BLOQUEIA o módulo é
  // `requirePremiumPage()` no topo de cada página do plano — essa é a
  // autoridade. Ler o estado neste layout é o que permite o menu não mentir.
  const access = await resolvePremiumAccess(session.user.id);

  // PRIMEIRO ACESSO — o fluxo de ativação (criar a própria senha) só se aplica
  // a usuários com um grant pendente (PENDING_FIRST_ACCESS) que AINDA NÃO
  // possuem senha. Usuários com senha (conta criada via /cadastro ou já
  // ativada) passam direto — isso elimina o ciclo /primeiro-acesso ↔ /dashboard
  // que deixava a página piscando para contas legadas.
  const needsActivation =
    access.reason === "PENDING_FIRST_ACCESS" && !user?.passwordHash;
  if (needsActivation) {
    redirect("/primeiro-acesso");
  }

  // Garante que o onboarding foi concluído antes de entrar no app.
  // A mesma consulta traz a identidade REAL da conta (nome + foto) para a
  // sidebar: a sessão é JWT e congela esses valores no login, então uma edição
  // no Perfil não apareceria aqui sem sair e entrar de novo.
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      onboardingCompleted: true,
      avatar: true,
      user: { select: { name: true } },
    },
  });

  if (!profile?.onboardingCompleted) {
    redirect("/onboarding");
  }

  // ACESSO AOS MÓDULOS DO PLANO — autoridade em `requirePremiumPage()`, no topo
  // de cada página premium. Aqui o layout apenas repassa `hasAccess` para a
  // sidebar marcar os itens com cadeado (exibição; nunca autorização).
  //
  // O que continua acessível sem plano (conta gratuita de verdade): Dashboard,
  // Redes Sociais, Minha Assinatura, Perfil, Configurações e Sobre. Nada é
  // apagado e o usuário não é deslogado.
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <AppSidebar
          user={session.user}
          isAdmin={isAdmin}
          hasPremiumAccess={access.hasAccess}
          account={{ name: profile?.user?.name ?? null, avatar: profile?.avatar ?? null }}
        />
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
