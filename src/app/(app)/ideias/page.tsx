import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Ideias",
  description: "Inspiração e sugestões de conteúdo para o seu Instagram.",
};

export default function IdeiasPage() {
  return (
    <PagePlaceholder
      title="Central de Ideias"
      icon={Lightbulb}
      description="Ideias de conteúdo para o seu nicho, com base no que funciona no seu perfil. Disponível em breve."
    />
  );
}
