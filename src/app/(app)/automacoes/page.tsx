import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { pub } from "@/lib/publishing/db";
import { listDirectRules, listDirectLogs } from "@/lib/comment-direct/db";
import { PageHeader } from "@/components/layout/page-header";
import { AutomationsBridgeClient } from "@/components/automations/automations-bridge-client";

export const metadata: Metadata = {
  title: "Automações",
  description: "Ponte para o motor real de Comentário → Direct.",
};

export const dynamic = "force-dynamic";

/**
 * PONTE DE AUTOMAÇÕES
 * ===================
 * A tela NÃO é mais um segundo motor. Ela mostra, em SOMENTE LEITURA:
 *   1. as regras REAIS do motor Comentário → Direct (`CommentDirectRule`),
 *      avaliadas por `evaluateComment` a partir do webhook de comentários;
 *   2. o histórico REAL de disparos (`CommentDirectLog`);
 *   3. o material LEGADO (`AutomationRule` + `AutomationExecution`) — preservado,
 *      mas deixado claro que NÃO dispara.
 *
 * Criar/editar/ativar acontece em Respostas Inteligentes → Automações. Duplicar
 * um segundo motor (que era o defeito: regras salvas que nada avaliava) foi
 * evitado de propósito.
 */
export default async function AutomationsPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // ---- Motor REAL (Comentário → Direct): regras + histórico de disparos ----
  const realRules = await listDirectRules(userId);
  const realLogs = await listDirectLogs(userId, 20);

  // ---- Material LEGADO (preservado, somente leitura, não dispara) ----
  const legacyRules = (await pub.automationRule.findMany({
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
  }[];

  const legacyExecutions = (await pub.automationExecution.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })) as unknown as {
    id: string;
    status: string;
    detail: string | null;
    createdAt: Date;
  }[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Zap}
        title="Automações"
        description="O envio automático de mensagem privada é feito pelo motor de Comentário → Direct, em Respostas Inteligentes → Automações. Esta tela mostra o que esse motor tem e mantém as regras antigas visíveis (sem disparar)."
      />

      <AutomationsBridgeClient
        realRules={realRules.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          triggerType: r.triggerType,
          triggerTerms: r.triggerTerms,
          messageText: r.messageText,
          dailyLimit: r.dailyLimit,
          onePerUser: r.onePerUser,
          pausedUntil: r.pausedUntil ? r.pausedUntil.toISOString() : null,
        }))}
        logs={realLogs.map((l) => ({
          id: l.id,
          commenterUsername: l.commenterUsername,
          originalComment: l.originalComment,
          matchedTrigger: l.matchedTrigger,
          status: l.status,
          reason: l.reason,
          createdAt: l.createdAt.toISOString(),
        }))}
        legacyRules={legacyRules.map((r) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger,
          platform: r.platform,
          keywords: r.keywords,
          action: r.action,
          enabled: r.enabled,
          createdAt: r.createdAt.toISOString(),
        }))}
        legacyExecutions={legacyExecutions.map((e) => ({
          id: e.id,
          status: e.status,
          detail: e.detail ?? "",
          createdAt: e.createdAt.toISOString(),
        }))}
        directAutomationsHref="/respostas-inteligentes?section=automacoes"
      />
    </div>
  );
}
