import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { FirstAccessForm } from "./first-access-form";

export const metadata: Metadata = {
  title: "Ative seu acesso",
  description:
    "Ative seu acesso ao Inst Acessor com o mesmo e-mail usado na compra.",
};

/**
 * PRIMEIRO ACESSO — página pública de ativação.
 * O cliente informa o e-mail da compra, prova a posse (link de uso único)
 * e cria a própria senha. NUNCA é gerada senha automática.
 *
 * - Já autenticado e JÁ TEM SENHA (conta pronta) → /dashboard.
 *   (IMPORTANTE: não redireciona usuário autenticado SEM senha — grant
 *   pendente com sessão órfã — para /dashboard, senão o layout do app o
 *   mandaria de volta para cá, criando loop.)
 * - Senão → fluxo de ativação.
 */
export default async function FirstAccessPage() {
  const session = await getSession();

  if (session?.user) {
    // Consulta o banco: usuário com senha já tem conta ativada → vai pro app.
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    } as unknown as never)) as unknown as { passwordHash: string | null } | null;

    if (user?.passwordHash) {
      redirect("/dashboard");
    }
    // Sem senha → permanece nesta página para concluir a ativação.
  }

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-grad" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          Primeiro acesso
        </span>
      </div>
      <h1 className="font-display text-[24px] font-bold text-ink">
        Ative seu acesso
      </h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5">
        Use o mesmo e-mail da sua compra. Você vai criar sua própria senha em
        seguida — nunca receberá uma senha pronta.
      </p>

      <div className="mt-7">
        <FirstAccessForm />
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-soft">
        Já tem conta?{" "}
        <a href="/login" className="font-semibold text-purple hover:text-indigo">
          Entrar
        </a>
      </p>
    </div>
  );
}
