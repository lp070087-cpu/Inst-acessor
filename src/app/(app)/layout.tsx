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
      {/* ITEM 7 — `min-h-dvh` em vez de `min-h-screen`.
          `100vh` no celular é a altura SEM a barra de endereço: o container
          ficava até ~100px mais alto que a área visível e sobrava uma faixa de
          rolagem vazia no fim de toda página. `dvh` acompanha a barra quando
          ela aparece e some. Navegador antigo (sem suporte a `dvh`) ignora a
          declaração e cai no `min-h-screen` do próprio Tailwind — nada quebra. */}
      <div className="min-h-dvh bg-bg">
        <AppSidebar
          user={session.user}
          isAdmin={isAdmin}
          hasPremiumAccess={access.hasAccess}
          account={{ name: profile?.user?.name ?? null, avatar: profile?.avatar ?? null }}
        />
        <main className="lg:pl-72 min-h-dvh flex flex-col min-w-0">
          {/* `min-w-0` é o que permite os filhos encolherem: em flex, o
              item herda `min-width:auto` e qualquer conteúdo largo (tabela,
              gráfico, texto sem quebra) força a coluna a crescer e a página
              inteira a rolar na horizontal. Com `min-w-0` a largura fica
              limitada ao container e o filho é quem resolve o excesso. */}
          {/* MARGENS LATERAIS (item 1) — este div é o ÚNICO ponto de margem de
              todas as páginas internas (a sidebar não desenha header), então o
              ajuste vale para as 21 de uma vez. Antes: `px-5 sm:px-8 lg:px-10`
              (20 → 32 → 40 px por lado) com teto de 1400px. O teto é o que mais
              "espremia" no desktop largo: em 1920px de viewport a caixa tinha
              1400px e sobravam ~260px de vazio em cada lado, somados ao
              `lg:pl-72` (288px) da sidebar. Agora o conteúdo ocupa 1640px e o
              respiro vem do padding, que é intencional e previsível.
              No mobile o padding CAI (não sobe): em 360px de tela, `px-5`
              consumia 11% da largura útil; `px-3.5` devolve 12px ao conteúdo.
              `mx-auto w-full` mantidos para o teto continuar centralizando. */}
          <div className="flex-1 min-w-0 px-3.5 sm:px-6 lg:px-7 2xl:px-10 py-6 sm:py-8 max-w-[1640px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
