import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Análise de Desempenho",
  description: "Métricas, comparativos e insights do seu Instagram.",
};

export default function AnaliseDesempenhoPage() {
  return (
    <PagePlaceholder
      title="Análise de Desempenho"
      icon={BarChart3}
      description="Compare períodos, formatos e conteúdos para entender o que impulsiona seu crescimento. Disponível quando o Instagram for conectado."
    />
  );
}
