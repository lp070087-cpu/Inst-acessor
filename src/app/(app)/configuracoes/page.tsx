import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { InstallAppCard } from "@/components/pwa/install-app-card";

export const metadata: Metadata = {
  title: "Configurações",
  description: "Preferências da sua conta.",
};

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PagePlaceholder
        title="Configurações"
        icon={Settings}
        description="Notificações, idioma, fuso horário e preferências do dashboard. Essas opções serão liberadas nas próximas fases."
      />

      {/* PWA — instalação discreta e opcional. Nunca é um popup. */}
      <InstallAppCard />
    </div>
  );
}
