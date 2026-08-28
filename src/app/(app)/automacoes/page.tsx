import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { pub } from "@/lib/publishing/db";
import { AutomationsClient } from "@/components/automations/automations-client";

export const metadata: Metadata = {
  title: "Automações",
  description: "Fundação de automações de comentário para DM do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const rows = (await pub.automationRule.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })) as unknown as {
    id: string;
    name: string;
    trigger: string;
    platform: string;
    keywords: string[];
    action: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];

  const executions = (await pub.automationExecution.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })) as unknown as {
    id: string;
    ruleId: string | null;
    eventId: string | null;
    status: string;
    detail: string | null;
    createdAt: Date;
  }[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Zap size={26} className="text-purple" />
          Automações
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Prepare respostas automáticas para comentários. Nenhuma mensagem é
          enviada automaticamente nesta fase — apenas a estrutura e a avaliação
          das regras.
        </p>
      </div>

      <AutomationsClient
        initial={{
          rules: rows.map((r) => ({
            id: r.id,
            name: r.name,
            trigger: r.trigger,
            platform: r.platform,
            keywords: r.keywords,
            action: r.action,
            enabled: r.enabled,
            createdAt: r.createdAt.toISOString(),
          })),
          executions: executions.map((e) => ({
            id: e.id,
            ruleId: e.ruleId,
            eventId: e.eventId,
            status: e.status,
            detail: e.detail ?? "",
            createdAt: e.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
