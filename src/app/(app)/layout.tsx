import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { getActiveAccessForUser } from "@/lib/first-access";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  // Garante que o primeiro acesso foi concluído antes de entrar no app.
  // (Campos novos via shim → args com cast, mesmo padrão do repository bll/fa.)
  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, firstAccessCompleted: true },
  } as unknown as never)) as unknown as {
    id: string;
    firstAccessCompleted: boolean;
  } | null;

  if (user && !user.firstAccessCompleted) {
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

  // Expiração: se o acesso terminou/cancelou, mostra tela de renovação.
  // NUNCA deleta o User — apenas bloqueia recursos pagos.
  const access = await getActiveAccessForUser(session.user.id);
  if (!access.active) {
    redirect("/expirado");
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <AppSidebar user={session.user} />
        <main className="lg:pl-72 min-h-screen flex flex-col">
          <div className="flex-1 px-5 sm:px-8 lg:px-10 py-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
