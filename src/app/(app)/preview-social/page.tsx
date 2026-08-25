import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Preview Social",
  description: "Visualize como seu perfil aparece para o público.",
};

export default function PreviewSocialPage() {
  return (
    <PagePlaceholder
      title="Preview Social"
      icon={Eye}
      description="Veja como seu perfil aparece para os visitantes, com preview de publicações e destaques. Disponível em breve."
    />
  );
}
