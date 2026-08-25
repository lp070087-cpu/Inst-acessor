import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "IA Acessor",
  description:
    "Sua mentoria com IA — em breve, estratégias e recomendações personalizadas.",
};

export default function IaAcessorPage() {
  return (
    <PagePlaceholder
      title="IA Acessor"
      icon={Sparkles}
      description="Sua mentoria com inteligência artificial está sendo preparada. Em breve você receberá estratégias e recomendações personalizadas para o seu perfil."
    />
  );
}
