import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Mentoria",
  description: "Acompanhamento personalizado para o seu crescimento.",
};

export default function MentoriaPage() {
  return (
    <PagePlaceholder
      title="Mentoria"
      icon={GraduationCap}
      description="Sua mentoria personalizada com planos de ação semanais será liberada em breve, com base nos dados do seu perfil."
    />
  );
}
