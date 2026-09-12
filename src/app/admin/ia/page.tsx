import type { Metadata } from "next";
import { Cpu } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getAIAdminStatus } from "@/lib/admin/ai-config";
import { AdminAIClient } from "@/components/admin/admin-ai-client";

export const metadata: Metadata = {
  title: "IA Acessor — Inst Acessor",
  description: "Configuração central da IA (somente administração).",
};

export const dynamic = "force-dynamic";

export default async function AdminIaPage() {
  await requireAdminSession();

  // Estado real da IA — nunca expõe a chave completa.
  const status = await getAIAdminStatus();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Cpu size={26} className="text-purple" />
          IA Acessor
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Configuração central dos provedores de IA. Os clientes não configuram
          chave de API — apenas a administração.
        </p>
      </div>

      <AdminAIClient
        initialStatus={{
          aiConfigured: status.aiConfigured,
          activeProvider: status.activeProvider,
          openai: status.openai,
          gemini: status.gemini,
        }}
      />
    </div>
  );
}
