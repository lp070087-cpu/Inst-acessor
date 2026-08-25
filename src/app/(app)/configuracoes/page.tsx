import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Configurações",
  description: "Preferências da sua conta.",
};

export default function ConfiguracoesPage() {
  return (
    <PagePlaceholder
      title="Configurações"
      icon={Settings}
      description="Notificações, idioma, fuso horário e preferências do dashboard. Essas opções serão liberadas nas próximas fases."
    />
  );
}
