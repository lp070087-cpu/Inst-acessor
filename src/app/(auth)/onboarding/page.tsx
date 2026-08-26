import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Monte seu perfil",
  description: "Conte para o Inst Acessor seus objetivos e nicho.",
};

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingCompleted: true },
  });

  // Se o onboarding já foi concluído, vai direto para o dashboard
  if (profile?.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-grad" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          Primeiros passos
        </span>
      </div>
      <h1 className="font-display text-[24px] font-bold text-ink">
        Vamos montar seu perfil
      </h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5">
        Isso ajuda o Inst Acessor a personalizar sua experiência. Não pedimos
        acesso ao seu Instagram nesta etapa.
      </p>

      <div className="mt-7">
        <OnboardingForm />
      </div>
    </div>
  );
}
