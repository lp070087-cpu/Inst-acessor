import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Minha Assinatura",
  description: "Gerencie seu plano e cobrança.",
};

export default function AssinaturaPage() {
  return (
    <PagePlaceholder
      title="Minha Assinatura"
      icon={CreditCard}
      description="Gerencie seu plano, métodos de pagamento e histórico de cobrança. Assinaturas chegam nas próximas fases."
    />
  );
}
