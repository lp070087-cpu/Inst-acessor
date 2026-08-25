import type { Metadata } from "next";
import { PenSquare } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Gerador de Copy",
  description:
    "Crie legendas e textos para seus posts — em breve com inteligência artificial.",
};

export default function GeradorCopyPage() {
  return (
    <PagePlaceholder
      title="Gerador de Copy"
      icon={PenSquare}
      description="Legendas, chamadas e textos prontos em segundos. O gerador de copy com IA será liberado em breve."
    />
  );
}
