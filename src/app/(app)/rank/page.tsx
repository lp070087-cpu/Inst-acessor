import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Rank",
  description: "Sua posição no ranking de crescimento do Instagram.",
};

export default function RankPage() {
  return (
    <PagePlaceholder
      title="Rank"
      icon={Trophy}
      description="Acompanhe sua posição no ranking, compare com o nicho e evolua de nível. Disponível em breve."
    />
  );
}
