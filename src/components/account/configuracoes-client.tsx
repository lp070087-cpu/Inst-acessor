"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Instagram,
  Music2,
  Check,
  ExternalLink,
  CreditCard,
  UserRound,
  ShieldCheck,
  Clock,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { SyncMetricsButton } from "@/components/dashboard/sync-metrics-button";
import type { DisplayNameSource } from "@/lib/gamification";
import { cn } from "@/lib/utils";

/**
 * CONFIGURAÇÕES — cliente
 * ========================
 * Regra desta tela: SÓ entra opção que tem backend de verdade. Nada de
 * interruptor decorativo, nada de botão que só finge salvar.
 *
 * O que existe de verdade:
 *   1. Nome exibido → `PATCH /api/rank/display-name`, a preferência REAL que o
 *      Rank já lê (JSON `UserPreferences.dashboard`). É a MESMA rota — não há
 *      uma segunda implementação.
 *   2. Integrações  → estado REAL da conexão + "Atualizar métricas", que é o
 *      `SyncMetricsButton` já usado no Dashboard
 *      (`POST /api/integrations/<rede>/sync`). Reaproveitado, não recriado.
 *      Nenhum token/chave aparece aqui.
 *   3. Assinatura   → plano real via `getMySubscription` + link para /assinatura.
 *   4. Aplicativo   → card de instalação PWA (renderizado pela página).
 *
 * O que NÃO existe e por isso NÃO aparece:
 *   - notificações (e-mail/push): não há preferência nem envio por evento;
 *   - seletores de idioma/fuso: `UserPreferences.locale/timezone` existem no
 *     banco mas NADA no app os consome — um seletor não mudaria comportamento
 *     nenhum. Aparecem como informação, não como opção clicável.
 */

export interface ConfigConnection {
  platform: "instagram" | "tiktok";
  /** Status real da conexão (CONNECTED/DISCONNECTED/CONNECTING/ERROR). */
  status: string;
  connected: boolean;
  /** @username da conta conectada (dado não sensível). */
  username: string | null;
  /** Rótulo de frescor vindo de `describeSync` (fonte única). */
  lastSyncLabel: string;
  lastSyncDetail: string | null;
  lastSyncStale: boolean;
}

interface ConfiguracoesClientProps {
  displayName: {
    /** Preferência que o usuário ESCOLHEU (antes de fallback). */
    storedSource: DisplayNameSource;
    /** Preferência efetivamente aplicada depois dos fallbacks reais. */
    source: DisplayNameSource;
    /** Nome final exibido hoje. */
    value: string;
    hasInstagram: boolean;
    igUsername: string | null;
    profileName: string | null;
  };
  connections: ConfigConnection[];
  subscription: {
    planName: string | null;
    status: string | null;
    expiresAt: string | null;
  };
  preferences: { locale: string; timezone: string };
}

export function ConfiguracoesClient({
  displayName,
  connections,
  subscription,
  preferences,
}: ConfiguracoesClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [source, setSource] = React.useState<DisplayNameSource>(
    displayName.storedSource
  );
  const [savingSource, setSavingSource] = React.useState(false);

  async function setDisplayName(next: DisplayNameSource) {
    if (next === source || savingSource) return;
    setSavingSource(true);
    const previous = source;
    try {
      const res = await fetch("/api/rank/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        // Reverte o estado local: a preferência NÃO foi gravada.
        setSource(previous);
        toast(data.error ?? "Não foi possível salvar sua preferência.", "error");
        return;
      }
      setSource(next);
      toast("Nome exibido atualizado.");
      router.refresh();
    } catch {
      setSource(previous);
      toast("Não foi possível conectar. Verifique sua internet.", "error");
    } finally {
      setSavingSource(false);
    }
  }

  /**
   * Diferença entre o que foi escolhido e o que está sendo usado: só acontece
   * quando a preferência é "Instagram" mas a conta não está conectada (ou não
   * tem nome/@). O sistema cai para o nome do perfil — e avisamos, em vez de
   * fingir que o Instagram está em uso.
   */
  const usingFallback = source === "instagram" && displayName.source === "profile";

  return (
    <div className="flex flex-col gap-6">
      {/* ================= CONTA ================= */}
      <Section
        icon={<UserRound size={20} />}
        title="Conta"
        description="Foto, nome, dados públicos e senha ficam na página de Perfil."
      >
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-purple hover:underline"
        >
          Abrir meu perfil
          <ExternalLink size={13} />
        </Link>
      </Section>

      {/* ================= NOME EXIBIDO ================= */}
      <Section
        icon={<Check size={20} />}
        title="Nome exibido"
        description="Como você aparece no Rank e no seu perfil público."
      >
        <div className="flex flex-col gap-2.5">
          <ChoiceRow
            label="Nome do meu perfil"
            hint={
              displayName.profileName
                ? `Hoje: ${displayName.profileName}`
                : "Defina um nome de exibição no Perfil para usar esta opção."
            }
            selected={source === "profile"}
            disabled={savingSource}
            onSelect={() => setDisplayName("profile")}
          />
          <ChoiceRow
            label={
              displayName.igUsername
                ? `Conta do Instagram (@${displayName.igUsername})`
                : "Conta do Instagram"
            }
            hint={
              displayName.hasInstagram
                ? "Usa o nome e o @ da sua conta conectada."
                : "Conecte uma conta do Instagram para usar esta opção."
            }
            selected={source === "instagram"}
            disabled={savingSource || !displayName.hasInstagram}
            onSelect={() => setDisplayName("instagram")}
          />

          <p className="text-[12.5px] text-ink-muted mt-1">
            Aparecendo como{" "}
            <strong className="font-semibold text-ink">{displayName.value}</strong>.
            {savingSource && " Salvando..."}
          </p>

          {usingFallback && (
            <p className="text-[12.5px] text-warn">
              Sua preferência é o Instagram, mas nenhuma conta conectada tem nome
              disponível — por isso o nome do perfil está sendo usado.
            </p>
          )}
        </div>
      </Section>

      {/* ================= INTEGRAÇÕES ================= */}
      <Section
        icon={<Instagram size={20} />}
        title="Integrações"
        description="Estado real das suas conexões e a atualização dos seus dados."
      >
        <div className="flex flex-col gap-3">
          {connections.map((c) => {
            const Icon = c.platform === "instagram" ? Instagram : Music2;
            const label = c.platform === "instagram" ? "Instagram" : "TikTok";

            return (
              <div
                key={c.platform}
                className="flex flex-col gap-3 rounded-md border border-border-soft px-4 py-3.5"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="w-9 h-9 rounded-[10px] bg-ai-soft text-purple grid place-items-center flex-none">
                    <Icon size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {label}
                      {c.connected && c.username ? (
                        <span className="text-ink-soft font-medium"> · @{c.username}</span>
                      ) : (
                        <span className="text-ink-soft font-medium">
                          {" "}
                          · Nenhuma conta conectada
                        </span>
                      )}
                    </p>
                    {c.connected && (
                      <p className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted mt-0.5">
                        <Clock size={12} className="flex-none" />
                        {c.lastSyncLabel}
                        {c.lastSyncDetail ? ` · ${c.lastSyncDetail}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 flex-none">
                    <StatusBadge status={c.status} />
                    {/* Sinaliza sem apagar: o último dado real continua na tela. */}
                    {c.connected && c.lastSyncStale && (
                      <span className="text-[11.5px] font-semibold text-warn">
                        Desatualizado
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                  {/* Mesmo componente/rota do Dashboard — não é uma segunda
                      implementação de sincronização. */}
                  <SyncMetricsButton connected={c.connected} platform={c.platform} />
                  <Link
                    href="/redes-sociais"
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[13px] font-semibold",
                      "text-purple hover:underline"
                    )}
                  >
                    {c.connected ? "Gerenciar conexão" : "Conectar"}
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[12px] text-ink-muted mt-4">
          Por segurança, o Inst Acessor nunca exibe as chaves de acesso das suas
          contas conectadas — apenas o estado da conexão.
        </p>
      </Section>

      {/* ================= ASSINATURA ================= */}
      <Section
        icon={<CreditCard size={20} />}
        title="Assinatura"
        description="Plano, pagamento e histórico ficam na área de assinatura."
      >
        <div className="flex flex-wrap items-center gap-3">
          {subscription.planName ? (
            <>
              <span className="text-[13.5px] text-ink">
                <span className="font-semibold">{subscription.planName}</span>
                {subscription.expiresAt && (
                  <span className="text-ink-soft">
                    {" "}
                    · válido até{" "}
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                      new Date(subscription.expiresAt)
                    )}
                  </span>
                )}
              </span>
              {subscription.status && <StatusBadge status={subscription.status} />}
            </>
          ) : (
            <span className="text-[13.5px] text-ink-soft">
              Nenhuma assinatura ativa no momento.
            </span>
          )}
          <Link
            href="/assinatura"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-purple hover:underline"
          >
            Ver minha assinatura
            <ExternalLink size={13} />
          </Link>
        </div>
      </Section>

      {/* ================= APLICATIVO ================= */}
      <Section
        icon={<ShieldCheck size={20} />}
        title="Privacidade e segurança"
        description="Como o Inst Acessor trata o acesso às suas contas."
      >
        <ul className="flex flex-col gap-2">
          {[
            "O acesso às suas redes é guardado de forma criptografada.",
            "Chaves, tokens e senhas nunca são exibidos nesta tela.",
            "Nada é publicado na sua conta sem a sua autorização.",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2.5 text-[13px] text-ink-soft"
            >
              <Check size={15} className="text-success flex-none mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-border-soft">
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              Idioma
            </dt>
            <dd className="text-[14px] text-ink mt-1">
              {preferences.locale === "pt-BR" ? "Português (Brasil)" : preferences.locale}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              Fuso horário
            </dt>
            <dd className="text-[14px] text-ink mt-1">
              {preferences.timezone.replace(/_/g, " ")}
            </dd>
          </div>
        </dl>
        <p className="text-[12px] text-ink-muted mt-3">
          Definidos no cadastro. Hoje não há como alterá-los pelo aplicativo.
        </p>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------
// Blocos
// ------------------------------------------------------------

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
      <div className="flex items-start gap-4">
        <span className="w-11 h-11 rounded-[13px] bg-ai-soft text-purple grid place-items-center flex-none">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold text-ink">{title}</h2>
          <p className="text-[13px] text-ink-soft mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Opção de escolha única. É um `button` com `aria-checked` (não um switch):
 * a ação GRAVA na hora, então precisa ser uma ação explícita do usuário — e não
 * um estado que ficaria pendente de "salvar".
 */
function ChoiceRow({
  label,
  hint,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        selected
          ? "border-purple/40 bg-ai-soft"
          : "border-border-soft hover:border-purple/30 hover:bg-surface/60"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 w-4 h-4 rounded-full border-2 grid place-items-center flex-none",
          selected ? "border-purple" : "border-border"
        )}
      >
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-purple" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink-muted mt-0.5">{hint}</span>
      </span>
    </button>
  );
}
