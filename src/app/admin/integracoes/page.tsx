import type { Metadata } from "next";
import { Plug } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { infinitepayStatus } from "@/lib/billing/infinitepay/config";
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

  // Status real do InfinitePay (nunca "conectado" sem prova).
  const ipStatus = infinitepayStatus();
  const infinitePayCard = {
    name: "InfinitePay (Billing)",
    description:
      "Gateway oficial de pagamento. Checkout por links públicos por plano; confirmação via webhook + payment_check quando a chave estiver configurada.",
    configured: ipStatus.configured,
    webhookConfigured: ipStatus.webhookConfigured,
  };

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
            <div className="flex items-center justify-between">
              <StatusBadge status={it.env === "configurado" ? "CONNECTED" : "DISCONNECTED"} />
              <span className="text-[12.5px] text-ink-muted">
                {it.env === "configurado" ? "Configurado no servidor" : "Não configurado"}
              </span>
            </div>
            {it.connections.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {it.connections.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-2.5">
                    <span className="text-[13px] font-medium text-ink">
                      {c.username ?? "Conta"}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        ))}

        {/* InfinitePay (Billing) — gateway oficial */}
        <SectionCard
          title={infinitePayCard.name}
          description={infinitePayCard.description}
        >
          <div className="flex items-center justify-between">
            <StatusBadge status={infinitePayCard.configured ? "CONNECTED" : "DISCONNECTED"} />
            <span className="text-[12.5px] text-ink-muted">
              {infinitePayCard.configured ? "Checkouts + confirmação" : "Checkouts prontos · webhook pendente"}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-[12.5px] text-ink-soft">
            <p>
              Checkout: links públicos do InfinitePay nos cards de planos (sem chave).
            </p>
            <p>
              Webhook: {infinitePayCard.webhookConfigured ? "configurado" : "aguardando configuração"} ·
              confirmação server-side via payment_check.
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
