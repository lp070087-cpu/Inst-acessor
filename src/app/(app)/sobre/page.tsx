import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Sobre o Inst Acessor",
  description: "Conheça o produto.",
};

export default function SobrePage() {
  return (
    <PagePlaceholder
      title="Sobre o Inst Acessor"
      icon={Info}
      description="O Inst Acessor analisa seu perfil, acompanha sua evolução e transforma métricas em estratégia. Saiba mais sobre o produto em breve."
    />
  );
}
