import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Gerador de Anúncios",
  description: "Crie campanhas e anúncios para o seu Instagram.",
};

export default function GeradorAnunciosPage() {
  return (
    <PagePlaceholder
      title="Gerador de Anúncios"
      icon={Megaphone}
      description="Crie campanhas e anúncios com o apoio da inteligência artificial. Disponível nas próximas fases."
    />
  );
}
