import type { Metadata } from "next";
import { Plug } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { asaasStatus } from "@/lib/billing/asaas/config";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Integrações — Inst Acessor",
  description: "Status das integrações do sistema.",
};

export const dynamic = "force-dynamic";

/**
 * Configuração real das integrações (a partir das env vars do servidor).
 * NUNCA expõe segredos — apenas "Configurado" / "Não configurado".
 */
function integrationEnvStatus(envKeys: string[]): "configurado" | "nao_configurado" {
  return envKeys.some((k) => Boolean(process.env[k])) ? "configurado" : "nao_configurado";
}

/**
 * Status da integração Instagram com a MESMA regra do código de integração:
 * o par prioritário é INSTAGRAM_APP_ID/SECRET; META_APP_ID/SECRET é apenas
 * compatibilidade temporária. A URL de redirecionamento é obrigatória e
 * explícita. Um app id sem secret NÃO conta como configurado — o servidor
 * recusaria o fluxo.
 */
function instagramEnvStatus(): "configurado" | "nao_configurado" {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  const redirect = process.env.INSTAGRAM_REDIRECT_URI;
  return appId && appSecret && redirect ? "configurado" : "nao_configurado";
}

export default async function AdminIntegrationsPage() {
  await requireAdminSession();

  const [igConnections, tiktokConnections, oauthStates] = await Promise.all([
    prisma.socialConnection.findMany({
      where: { platform: "instagram" },
      select: { status: true, username: true, updatedAt: true },
    }),
    prisma.socialConnection.findMany({
      where: { platform: "tiktok" },
      select: { status: true, username: true, updatedAt: true },
    }),
    prisma.oAuthState.findMany({
      where: { consumed: false, expiresAt: { gt: new Date() } },
      select: { provider: true },
    }),
  ]);

  // Anti-travamento: CONNECTING sem fluxo OAuth ativo e válido é ORFÃO de um
  // fluxo interrompido → trata como DISCONNECTED (nunca prende o badge).
  const activeProviders = new Set(oauthStates.map((s) => s.provider));
  const effectiveStatus = (status: string | null | undefined, provider: string) => {
    if (status === "CONNECTING" && !activeProviders.has(provider)) return "DISCONNECTED";
    return status ?? "DISCONNECTED";
  };
  const igNormalized = igConnections.map((c) => ({
    ...c,
    status: effectiveStatus(c.status, "instagram"),
  }));
  const tiktokNormalized = tiktokConnections.map((c) => ({
    ...c,
    status: effectiveStatus(c.status, "tiktok"),
  }));

  const integracoes = [
    {
      name: "Instagram (Meta)",
      description:
        "Instagram Business Login — conexão de contas Business/Creator e sincronização de métricas.",
      env: instagramEnvStatus(),
      connections: igNormalized,
    },
    {
      name: "TikTok",
      description: "Conexão de contas e sincronização de vídeos.",
      env: integrationEnvStatus(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]),
      connections: tiktokNormalized,
    },
    {
      name: "IA (OpenAI/Gemini)",
      description: "Provedores de IA usados pela IA Acessor e geradores.",
      env: integrationEnvStatus(["OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"]),
      connections: [],
    },
  ];

  // Status real do Asaas (nunca "conectado" sem prova). Devolve apenas
  // rótulos — ambiente ("Sandbox"/"Produção") e se o webhook está configurado.
  // NUNCA expõe chave ou token.
  const asaas = asaasStatus();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Plug size={26} className="text-purple" />
          Integrações
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Status das integrações. Segredos nunca são exibidos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {integracoes.map((it) => (
          <SectionCard key={it.name} title={it.name} description={it.description}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={it.env === "configurado" ? "CONNECTED" : "DISCONNECTED"} />
              <span className="text-[12.5px] text-ink-muted min-w-0 break-words">
                {it.env === "configurado" ? "Configurado no servidor" : "Não configurado"}
              </span>
            </div>
            {it.connections.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {it.connections.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 min-w-0 rounded-[11px] border border-border-soft bg-surface/50 px-4 py-2.5">
                    <span className="text-[13px] font-medium text-ink min-w-0 truncate">
                      {c.username ?? "Conta"}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        ))}

        {/* ASAAS (Billing) — gateway oficial */}
        <SectionCard
          title="Asaas"
          description="Gateway oficial de pagamento — checkout hospedado, cobranças e assinaturas."
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple bg-ai-soft rounded-pill px-2 py-0.5">
              Gateway oficial
            </span>
            <StatusBadge status={asaas.configured ? "CONNECTED" : "DISCONNECTED"} />
            <span className="text-[12.5px] text-ink-muted min-w-0 break-words">
              {asaas.label}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-2.5">
              <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                API
              </dt>
              <dd className="text-[13px] font-medium text-ink mt-0.5">
                {asaas.configured ? "Configurada" : "Não configurada"}
              </dd>
            </div>
            <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-2.5">
              <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                Webhook
              </dt>
              <dd className="text-[13px] font-medium text-ink mt-0.5">
                {asaas.webhookConfigured ? "Configurado" : "Não configurado"}
              </dd>
            </div>
            <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-2.5">
              <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                Ambiente
              </dt>
              <dd className="text-[13px] font-medium text-ink mt-0.5">
                {asaas.environment === "production" ? "Produção" : "Sandbox"}
              </dd>
            </div>
            <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-2.5">
              <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                Checkout
              </dt>
              <dd className="text-[13px] font-medium text-ink mt-0.5">
                {asaas.configured ? "Habilitado" : "Pendente"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-col gap-1.5 text-[12.5px] text-ink-soft">
            <p>
              Checkout: checkout hospedado do Asaas criado no servidor a partir do plano
              escolhido (preço/duração sempre resolvidos no servidor — nunca pelo navegador).
            </p>
            <p>
              A liberação de acesso só ocorre após a confirmação real do pagamento pelo
              webhook. O retorno do checkout, sozinho, não libera nada.
            </p>
            <p>
              Autenticação do webhook: header{" "}
              <code className="font-data">asaas-access-token</code>, conferido no servidor
              contra a variável de ambiente. O valor nunca é exibido aqui.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Observações">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          A configuração das integrações é feita pelas variáveis de ambiente do servidor
          (nunca pelo cliente). Os tokens de acesso são criptografados em repouso
          (AES-256-GCM) e nunca aparecem em logs ou na interface.
        </p>
      </SectionCard>
    </div>
  );
}
