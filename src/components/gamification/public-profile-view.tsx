"use client";

import * as React from "react";
import {
  Users,
  TrendingUp,
  Instagram,
  Award,
  Crown,
  Sparkles,
  Share2,
  Copy as CopyIcon,
  Medal,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
// Tipo puro (sem banco) — seguro importar num Client Component.
import type { RankTierInfo } from "@/lib/gamification/xp";

// ------------------------------------------------------------
// Tipos públicos (serializáveis — o servidor envia somente dados
// de evolução/gamificação; NUNCA email/tokens/ids internos/faturamento)
// ------------------------------------------------------------

export interface PublicAchievementItem {
  slug: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  xpReward: number;
  unlockedAt: string | null;
}

export interface PublicProfilePayload {
  handle: string;
  name: string;
  image: string | null;
  instagramUsername: string | null;
  // Progressão (real)
  level: number;
  xp: number;
  totalXpEarned: number;
  xpInLevel: number;
  xpNeededForNext: number;
  progressToNext: number;
  /**
   * Faixa geral (Bronze→Lendário) sobre o XP acumulado. `label: null` antes do
   * Bronze — nesse caso o perfil mostra a distância real, nunca inventa faixa.
   */
  tier?: RankTierInfo | null;
  // Posição (real)
  position: number | null;
  totalUsers: number;
  // Social (real)
  followers: number | null;
  growth30d: number | null;
  // Conquistas desbloqueadas (reais)
  achievements: PublicAchievementItem[];
}

const TIER_ORDER: Record<string, number> = { BRONZE: 0, PRATA: 1, OURO: 2, DESAFIO: 3 };
const TIER_LABEL: Record<string, string> = {
  BRONZE: "Bronze",
  PRATA: "Prata",
  OURO: "Ouro",
  DESAFIO: "Desafio",
};

function tierChip(tier: string): string {
  switch (tier) {
    case "OURO":
      return "bg-warn/10 text-warn border border-warn/20";
    case "PRATA":
      return "bg-surface text-ink-soft border border-border-soft";
    case "DESAFIO":
      return "bg-ai-soft text-purple border border-purple/20";
    default:
      return "bg-warn-soft text-warn border border-warn/20";
  }
}

function achievementIcon(tier: string) {
  if (tier === "DESAFIO") return Sparkles;
  if (tier === "OURO") return Crown;
  if (tier === "PRATA") return Medal;
  return Award;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatSigned(n: number): string {
  const abs = new Intl.NumberFormat("pt-BR").format(Math.abs(n));
  return n > 0 ? `+${abs}` : n < 0 ? `-${abs}` : "0";
}

function bestAchievement(list: PublicAchievementItem[], onlyDesafio = false) {
  const unlocked = list.filter((a) => (onlyDesafio ? a.tier === "DESAFIO" : a.tier !== "DESAFIO"));
  if (unlocked.length === 0) return null;
  return unlocked.sort((a, b) => {
    const diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0);
    if (diff !== 0) return diff;
    return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
  })[0];
}

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

export function PublicProfileView({ payload }: { payload: PublicProfilePayload }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const url = React.useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    []
  );

  const badge = bestAchievement(payload.achievements, false);
  const trophy = bestAchievement(payload.achievements, true);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast("Link do perfil copiado!");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  async function shareEvolution() {
    // O PAR (Rank, Nível) é a identidade do Rank — "Bronze • Nível 2". Mostrar
    // só "Bronze" não distinguiria dois usuários em níveis internos diferentes.
    const tierText = payload.tier
      ? `${payload.tier.fullLabel} com ${payload.totalXpEarned} XP acumulados`
      : `${payload.totalXpEarned} XP acumulados`;
    const shareData = {
      title: `${payload.name} no Inst Acessor`,
      text: `Veja a evolução de ${payload.name} — ${tierText}.`,
      url,
    };
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // usuário cancelou — cai no fallback de cópia
    }
    await copyLink();
  }

  const igLabel = payload.instagramUsername
    ? `@${payload.instagramUsername}`
    : "Instagram não conectado";

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-5">
      {/* Card principal */}
      <div className="rounded-2xl bg-card border border-border-soft shadow-md overflow-hidden">
        {/* Faixa superior */}
        <div className="h-24 bg-brand-grad relative">
          <div className="absolute -bottom-9 left-6 rounded-full border-4 border-card">
            <Avatar name={payload.name} src={payload.image} size="lg" className="w-[72px] h-[72px] text-[22px]" />
          </div>
        </div>

        <div className="pt-12 px-6 pb-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-ink leading-tight truncate">
                {payload.name}
              </h1>
              <p className="text-[13px] text-ink-soft flex items-center gap-1.5">
                {payload.instagramUsername ? (
                  <>
                    <Instagram size={13} className="text-purple flex-none" />
                    <span className="truncate">{igLabel}</span>
                  </>
                ) : (
                  <span className="text-ink-muted flex items-center gap-1.5">
                    <Instagram size={13} className="flex-none" />
                    {igLabel}
                  </span>
                )}
              </p>
            </div>
            <Badge tone="brand" size="md" className="flex-none">
              {payload.tier?.label ?? `Nível ${payload.level}`}
            </Badge>
          </div>

          {/* Métricas principais */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Metric icon={Users} label="Seguidores" value={payload.followers != null ? formatCount(payload.followers) : "—"} empty={payload.followers == null} />
            <Metric icon={TrendingUp} label="Crescimento (30d)" value={payload.growth30d != null ? formatSigned(payload.growth30d) : "—"} empty={payload.growth30d == null} />
            <Metric icon={Zap} label="XP total" value={formatCount(payload.xp)} empty={false} />
            <Metric
              icon={Medal}
              label="Posição no rank"
              value={payload.position != null ? `#${payload.position}` : "—"}
              empty={payload.position == null}
              sub={payload.position != null ? `de ${payload.totalUsers}` : "sem XP ainda"}
            />
          </div>

          {/* Progresso p/ a próxima faixa do Rank (ou próximo nível, se a
              faixa ainda não foi alcançada / já é a máxima). */}
          <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[12.5px] font-semibold text-ink-soft">
                {payload.tier?.nextLabel
                  ? `Progresso para ${payload.tier.nextLabel}`
                  : payload.tier?.label
                    ? "Topo da progressão alcançado"
                    : `Progresso para o nível ${payload.level + 1}`}
              </span>
              <span className="font-data font-bold text-[14px] text-ink">
                {payload.xpInLevel} / {payload.xpNeededForNext} XP
              </span>
            </div>
            <ProgressBar
              value={payload.tier?.progressToNextTier ?? payload.progressToNext}
              gradient="brand"
            />
            <p className="text-[11.5px] text-ink-muted">
              {payload.tier?.nextLabel
                ? `${Math.round(payload.tier.progressToNextTier ?? 0)}% até ${payload.tier.nextLabel} · ${payload.totalXpEarned} XP acumulados no total`
                : `${Math.round(payload.progressToNext)}% do caminho · ${payload.totalXpEarned} XP acumulados no total`}
            </p>
          </div>

          {/* Conquistas desbloqueadas */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-purple" />
              <h2 className="font-display text-[15px] font-bold text-ink">
                Conquistas desbloqueadas
              </h2>
              <Badge tone="ai" size="sm">{payload.achievements.length}</Badge>
            </div>
            {payload.achievements.length === 0 ? (
              <p className="text-[13px] text-ink-muted rounded-xl border border-dashed border-[#D0D4DB] bg-surface/30 px-4 py-5 text-center">
                Ainda sem conquistas públicas — elas aparecem aqui conforme o perfil evolui.
              </p>
            ) : (
              /* NUNCA colocar `{/* ... *\/}` no início de um ramo de ternário:
                 o comentário fecha o `(` e racha o JSX. Por isso o comentário
                 aqui usa a forma de bloco simples dentro do texto JSX abaixo. */
              <div className="flex flex-wrap gap-2">
                {payload.achievements.map((a) => (
                  <span
                    key={a.slug}
                    title={a.description}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-pill px-3 py-1.5 bg-surface text-ink-soft border border-border-soft"
                  >
                    <Award size={13} className="flex-none text-purple" />
                    {a.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Melhor badge / Melhor troféu */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold text-ink-soft flex items-center gap-1.5">
                <Crown size={14} className="text-warn" />
                Melhor badge
              </span>
              {badge ? (
                <>
                  <p className="text-[14px] font-bold text-ink">{badge.title}</p>
                </>
              ) : (
                <p className="text-[13px] text-ink-muted">— Nenhuma ainda</p>
              )}
            </div>
            <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold text-ink-soft flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple" />
                Melhor troféu
              </span>
              {trophy ? (
                <>
                  <p className="text-[14px] font-bold text-ink">{trophy.title}</p>
                </>
              ) : (
                <p className="text-[13px] text-ink-muted">— Nenhuma ainda</p>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button onClick={copyLink} className="gap-2">
              {copied ? <ShieldCheck size={15} /> : <CopyIcon size={15} />}
              {copied ? "Link copiado!" : "Copiar link do perfil"}
            </Button>
            <Button variant="outline" onClick={shareEvolution} className="gap-2">
              <Share2 size={15} /> Compartilhar evolução
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-ink-muted px-2 text-center">
        Perfil público de evolução e gamificação do Inst Acessor — apenas dados públicos.
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  empty,
  sub,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  value: string;
  empty?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-1.5 min-w-0">
      <span className="text-[11.5px] font-semibold text-ink-soft flex items-center gap-1.5 truncate">
        <Icon size={13} className="text-purple flex-none" />
        <span className="truncate">{label}</span>
      </span>
      <p className={cn("font-data font-bold text-[20px] leading-none", empty ? "text-ink-muted" : "text-ink")}>
        {value}
      </p>
      {sub ? <span className="text-[11px] text-ink-muted truncate">{sub}</span> : null}
    </div>
  );
}
