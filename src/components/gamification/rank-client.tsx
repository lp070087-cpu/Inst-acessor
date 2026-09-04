"use client";

import * as React from "react";
import {
  Trophy,
  Medal,
  Target,
  Award,
  CheckCircle2,
  Lock,
  TrendingUp,
  Zap,
  History,
  Plus,
  Trash2,
  Loader2,
  Crown,
  Star,
  Sparkles,
  Flame,
  BarChart3,
  Target as TargetIcon,
  CalendarDays,
  Check,
  UserCog,
  Users,
  Share2,
  Copy as CopyIcon,
  Instagram,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------
// Tipos (espelham o payload da API /rank)
// ------------------------------------------------------------

interface ProgressData {
  level: number;
  xp: number;
  totalXpEarned: number;
  xpInLevel: number;
  xpNeededForNext: number;
  progressToNext: number;
}

interface SummaryData {
  position: number | null;
  totalUsers: number;
}

interface RankingEntry {
  userId: string;
  name: string | null;
  level: number;
  xp: number;
  position: number;
  isMe: boolean;
}

interface EvolutionPoint {
  label: string;
  level: number;
  xp: number;
}

interface AchievementData {
  slug: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  xpReward: number;
  threshold: number;
  unit: string;
  hidden: boolean;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
  xpGranted: boolean;
}

interface GoalData {
  id: string;
  category: string;
  title: string;
  description: string;
  targetValue: number | null;
  currentValue: number | null;
  unit: string;
  platform: string;
  status: string;
  deadline: string | null;
  progressPercent: number;
}

interface XpLogData {
  source: string;
  refId: string;
  amount: number;
  createdAt: string;
}

// Rodada #274 — Impulso/Ritmo: metas prontas + streak + nome exibido.
interface RitmoCardData {
  id: string;
  bandId: string;
  period: "dia" | "semana" | "mes";
  periodKey: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  unit: string;
  isPercent: boolean;
  progressPercent: number;
  status: "pendente" | "concluida" | "sem-dados";
  xpReward: number;
  remainingLabel: string;
  available: boolean;
  granted: boolean;
}

interface MomentumData {
  cards: RitmoCardData[];
  streakDays: number;
  activeWeekStreak: number;
  nextStreakBonus: number;
  todayXp: number;
  bonusXpGranted: number;
  completedNow: { cardId: string; bandId: string; title: string; period: string; xpReward: number }[];
  bonusesGrantedNow: { day: number; amount: number }[];
}

interface DisplayNameData {
  source: "profile" | "instagram";
  value: string;
  storedSource: "profile" | "instagram";
  hasInstagram: boolean;
}

interface RankSocialData {
  followers: number | null;
  growth30d: number | null;
  instagramConnected: boolean;
  instagramUsername: string | null;
}

interface RankProfilePublicData {
  name: string;
  image: string | null;
  username: string | null;
  igUsername: string | null;
  igName: string | null;
}

interface RankInitialData {
  progress: ProgressData;
  summary: SummaryData;
  ranking: { entries: RankingEntry[] };
  evolution: EvolutionPoint[];
  achievements: AchievementData[];
  goals: GoalData[];
  xpLogs: XpLogData[];
  momentum?: MomentumData;
  displayName?: DisplayNameData;
  social?: RankSocialData;
  profilePublic?: RankProfilePublicData;
}

interface RankClientProps {
  initial: RankInitialData;
}

// ------------------------------------------------------------
// Rótulos / cores
// ------------------------------------------------------------

const SOURCE_LABEL: Record<string, string> = {
  "salvar-copy": "Copy salva",
  "gerar-copy": "Copy gerada",
  "salvar-ideia": "Ideia salva",
  "gerar-ideia": "Ideia gerada",
  "criar-rascunho": "Rascunho criado",
  "analisar-desempenho": "Análise de desempenho",
  "calcular-score": "Score calculado",
  "executar-recomendacao": "Recomendação executada",
  "completar-experimento": "Experimento concluído",
  "concluir-meta": "Meta concluída",
  "sincronizar-instagram": "Sincronização do Instagram",
  "sincronizar-tiktok": "Sincronização do TikTok",
  "concluir-onboarding": "Onboarding concluído",
  "melhorar-perfil": "Perfil melhorado",
  "conquista-desbloqueada": "Conquista desbloqueada",
  // Rodada #274 — Impulso/Ritmo
  "ritmo-seguidores": "Meta de seguidores batida",
  "ritmo-ideias": "Meta de ideias batida",
  "ritmo-copy": "Meta de copies batida",
  "ritmo-ia": "Meta de IA batida",
  "ritmo-publicar": "Meta de publicações batida",
  "ritmo-alcance": "Meta de alcance batida",
  "ritmo-engajamento": "Meta de engajamento batida",
  "ritmo-crescimento": "Meta de crescimento geral batida",
  "streak-bonus": "Bônus de sequência",
};

const GOAL_CATEGORY_LABEL: Record<string, string> = {
  crescimento: "Crescimento",
  engajamento: "Engajamento",
  consistencia: "Consistência",
};

const TIER_LABEL: Record<string, string> = {
  BRONZE: "Bronze",
  PRATA: "Prata",
  OURO: "Ouro",
  DESAFIO: "Desafio",
};

function tierClass(tier: string): string {
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
  if (tier === "PRATA") return Star;
  return Flame;
}

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

export function RankClient({ initial }: RankClientProps) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState("visao-geral");

  const [progress, setProgress] = React.useState<ProgressData>(initial.progress);
  const [summary, setSummary] = React.useState<SummaryData>(initial.summary);
  const [ranking, setRanking] = React.useState<RankingEntry[]>(initial.ranking.entries);
  const [evolution, setEvolution] = React.useState<EvolutionPoint[]>(initial.evolution);
  const [achievements, setAchievements] = React.useState<AchievementData[]>(initial.achievements);
  const [goals, setGoals] = React.useState<GoalData[]>(initial.goals);
  const [xpLogs, setXpLogs] = React.useState<XpLogData[]>(initial.xpLogs);
  const [momentum, setMomentum] = React.useState<MomentumData | null>(initial.momentum ?? null);
  const [displayName, setDisplayName] = React.useState<DisplayNameData | null>(
    initial.displayName ?? null
  );
  const [social, setSocial] = React.useState<RankSocialData | null>(initial.social ?? null);
  const [profilePublic, setProfilePublic] = React.useState<RankProfilePublicData | null>(
    initial.profilePublic ?? null
  );

  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  // Perfil público — link real (usando o domínio oficial; quando o app roda em
  // preview/dev, o link reflete o domínio do deploy atual via window.location).
  const publicProfileUrl = React.useMemo(() => {
    const username = profilePublic?.username ?? profilePublic?.igUsername ?? null;
    if (!username) return null;
    return `${window.location.origin}/p/${encodeURIComponent(username)}`;
  }, [profilePublic]);

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg, "success");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  async function handleShareEvolution() {
    const shareData = {
      title: "Inst Acessor — Minha evolução",
      text: `Estou no nível ${progress.level} com ${progress.xp} XP no Inst Acessor!`,
      url: publicProfileUrl ?? window.location.href,
    };
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // usuário cancelou — cai no fallback
    }
    if (publicProfileUrl) await copyText(publicProfileUrl, "Link copiado!");
    else await copyText(window.location.href, "Link copiado!");
  }

  // Sub-aba de conquistas (visíveis vs. todas)
  const [onlyVisible, setOnlyVisible] = React.useState(true);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const visibleCount = achievements.filter((a) => !a.hidden).length;
  const totalCount = achievements.length;
  const unlockedPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  async function checkAchievements() {
    setChecking(true);
    try {
      const res = await fetch("/api/rank/conquistas", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao verificar conquistas.", "error");
        return;
      }
      const reload = await fetch("/api/rank");
      const full = await reload.json();
      if (reload.ok) {
        setProgress(full.progress);
        setSummary(full.summary);
        setRanking(full.ranking.entries);
        setEvolution(full.evolution);
        setAchievements(full.achievements);
        setGoals(full.goals);
        setXpLogs(full.xpLogs);
        if (full.momentum) setMomentum(full.momentum);
        if (full.displayName) setDisplayName(full.displayName);
        if (full.social) setSocial(full.social);
        if (full.profilePublic) setProfilePublic(full.profilePublic);
      }
      if (data.unlockedNow) {
        toast(`${data.amount} XP conquistado! Continue assim.`);
      } else {
        toast("Nada novo por enquanto — continue as ações recomendadas.");
      }
    } catch {
      toast("Não foi possível verificar conquistas.", "error");
    } finally {
      setChecking(false);
    }
  }

  async function reloadAll() {
    try {
      const res = await fetch("/api/rank");
      const full = await res.json();
      if (!res.ok) return;
      setProgress(full.progress);
      setSummary(full.summary);
      setRanking(full.ranking.entries);
      setEvolution(full.evolution);
      setAchievements(full.achievements);
      setGoals(full.goals);
      setXpLogs(full.xpLogs);
      if (full.momentum) setMomentum(full.momentum);
      if (full.displayName) setDisplayName(full.displayName);
      if (full.social) setSocial(full.social);
      if (full.profilePublic) setProfilePublic(full.profilePublic);
    } catch {
      // silencioso — UI já tem dados
    }
  }

  const visibleAchievements = achievements.filter((a) => !a.hidden);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — nível + posição */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-center rounded-xl bg-card border border-border-soft shadow-xs p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <CircularProgress
            value={progress.progressToNext}
            size={150}
            strokeWidth={11}
            gradientId="rankRing"
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="brand" size="md">
                Nível {progress.level}
              </Badge>
              <Badge tone="neutral" size="md">
                {progress.xp} XP
              </Badge>
            </div>
            <h2 className="font-display text-[18px] font-bold text-ink mt-1">
              {progress.xpInLevel} / {progress.xpNeededForNext} XP para o próximo nível
            </h2>
            <p className="text-[13px] text-ink-soft">
              {Math.round(progress.progressToNext)}% do caminho. Total acumulado:{" "}
              {progress.totalXpEarned} XP.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <div className="flex items-center gap-2">
            <Medal size={20} className="text-purple" />
            <span className="font-data font-bold text-[24px] text-ink">
              {summary.position !== null ? `#${summary.position}` : "—"}
            </span>
            <span className="text-[13px] text-ink-soft">de {summary.totalUsers} usuário(s)</span>
          </div>
          <p className="text-[12.5px] text-ink-muted max-w-[260px] lg:text-right">
            Sua posição no ranking por XP. Evolui com ações reais.
          </p>
          <Button variant="outline" size="sm" onClick={checkAchievements} disabled={checking} className="gap-2">
            {checking ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {checking ? "Verificando..." : "Verificar conquistas"}
          </Button>
        </div>
      </div>

      {/* Rodada #289 — Resumo social no topo (seguidores/crescimento/IG/conquistas) */}
      <SocialSummaryStrip
        social={social}
        unlockedCount={unlockedCount}
        visibleCount={visibleCount}
      />

      {/* Abas */}
      <Tabs
        tabs={[
          { id: "visao-geral", label: "Visão geral" },
          { id: "perfil-publico", label: "Perfil Público" },
          { id: "ranking", label: "Ranking" },
          { id: "metas", label: "Metas" },
          { id: "conquistas", label: "Conquistas" },
          { id: "historico", label: "Histórico de XP" },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {tab === "visao-geral" && (
        <VisaoGeral
          progress={progress}
          evolution={evolution}
          unlockedCount={unlockedCount}
          visibleCount={visibleCount}
          goals={goals}
          momentum={momentum}
          displayName={displayName}
          onDisplayNameChange={(info) => setDisplayName(info)}
          toast={toast}
        />
      )}

      {tab === "perfil-publico" && (
        <PerfilPublicoView
          progress={progress}
          summary={summary}
          social={social}
          profilePublic={profilePublic}
          unlockedCount={unlockedCount}
          totalCount={totalCount}
          achievements={achievements}
          publicProfileUrl={publicProfileUrl}
          onCopyLink={(u) => copyText(u, "Link do perfil copiado!")}
          onShare={() => handleShareEvolution()}
        />
      )}

      {tab === "ranking" && (
        <RankingView entries={ranking} me={summary} />
      )}

      {tab === "metas" && (
        <MetasView
          goals={goals}
          onChanged={reloadAll}
          toast={toast}
          onOpenCreate={() => setGoalModalOpen(true)}
        />
      )}

      {tab === "conquistas" && (
        <ConquistasView
          achievements={achievements}
          onlyVisible={onlyVisible}
          onToggleVisible={() => setOnlyVisible((v) => !v)}
          unlockedCount={unlockedCount}
          visibleCount={visibleCount}
          unlockedPct={unlockedPct}
          currentLevel={progress.level}
        />
      )}

      {tab === "historico" && (
        <HistoricoView xpLogs={xpLogs} />
      )}

      {/* Modal criar meta */}
      <CreateGoalModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onCreated={() => {
          setGoalModalOpen(false);
          reloadAll();
        }}
        toast={toast}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Visão geral
// ------------------------------------------------------------

function VisaoGeral({
  progress,
  evolution,
  unlockedCount,
  visibleCount,
  goals,
  momentum,
  displayName,
  onDisplayNameChange,
  toast,
}: {
  progress: ProgressData;
  evolution: EvolutionPoint[];
  unlockedCount: number;
  visibleCount: number;
  goals: GoalData[];
  momentum: MomentumData | null;
  displayName: DisplayNameData | null;
  onDisplayNameChange: (info: DisplayNameData) => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
}) {
  const activeGoals = goals.filter((g) => g.status === "ATIVA");
  const doneGoals = goals.filter((g) => g.status === "CONCLUIDA").length;
  const completion = visibleCount > 0 ? Math.round((unlockedCount / visibleCount) * 100) : 0;
  const hasMomentum = momentum !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Evolução */}
        <div className="lg:col-span-2 rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2">
              <TrendingUp size={18} className="text-purple" />
              Evolução do seu XP
            </h3>
            <p className="text-[13px] text-ink-soft mt-0.5">
              Acúmulo de XP ao longo do tempo. Cada ponto é uma ação real registrada.
            </p>
          </div>
          {evolution.length === 0 ? (
            <div className="h-52 rounded-[16px] bg-surface/40 border border-dashed border-[#D0D4DB] flex items-center justify-center">
              <p className="text-[13px] text-ink-soft">
                Ainda não há XP registrado — faça ações no app para começar a acumular.
              </p>
            </div>
          ) : (
            <EvolutionSvg points={evolution} />
          )}
        </div>

        {/* Resumo rápido */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-ink-soft">Nível</span>
              <Badge tone="brand">{progress.level}</Badge>
            </div>
            <ProgressBar value={progress.progressToNext} gradient="brand" />
            <p className="text-[12.5px] text-ink-muted">
              {progress.xpInLevel} / {progress.xpNeededForNext} XP para o próximo nível
            </p>
          </div>

          <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-ink-soft">Conquistas</span>
              <Badge tone="ai">{unlockedCount}/{visibleCount}</Badge>
            </div>
            <ProgressBar value={completion} gradient="magenta" />
            <p className="text-[12.5px] text-ink-muted">
              {completion}% das conquistas visíveis desbloqueadas
            </p>
          </div>

          <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-ink-soft">Metas ativas</span>
              <Badge tone={activeGoals.length > 0 ? "success" : "neutral"}>{activeGoals.length}</Badge>
            </div>
            <p className="text-[12.5px] text-ink-muted">
              {doneGoals} concluída(s). Metas concluídas rendem XP.
            </p>
          </div>
        </div>
      </div>

      {/* Rodada #274 — Impulso: streak + metas prontas (MESMO sistema visual) */}
      {hasMomentum && (
        <MomentumSection
          momentum={momentum}
          displayName={displayName}
          onDisplayNameChange={onDisplayNameChange}
          toast={toast}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Impulso (rodada #274) — metas prontas + sequência
// ------------------------------------------------------------

const PERIOD_LABEL_SHORT: Record<string, string> = {
  dia: "Diárias",
  semana: "Semanais",
  mes: "Mensais",
};

function MomentumSection({
  momentum,
  displayName,
  onDisplayNameChange,
  toast,
}: {
  momentum: MomentumData;
  displayName: DisplayNameData | null;
  onDisplayNameChange: (info: DisplayNameData) => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
}) {
  const [openGroup, setOpenGroup] = React.useState<Record<string, boolean>>({
    dia: true,
    semana: true,
    mes: true,
  });
  const [savingName, setSavingName] = React.useState(false);

  const grouped = React.useMemo(() => {
    const g: Record<string, RitmoCardData[]> = { dia: [], semana: [], mes: [] };
    for (const c of momentum.cards) {
      if (g[c.period]) g[c.period].push(c);
    }
    return g;
  }, [momentum.cards]);

  const doneCount = momentum.cards.filter((c) => c.status === "concluida").length;
  const totalDone = momentum.cards.length;
  const streakPct = Math.min(100, Math.round((momentum.streakDays / (momentum.nextStreakBonus || 30)) * 100));

  async function changeSource(source: "profile" | "instagram") {
    setSavingName(true);
    try {
      const res = await fetch("/api/rank/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao atualizar nome exibido.", "error");
        return;
      }
      if (data.displayName) onDisplayNameChange(data.displayName);
      toast("Nome exibido atualizado.");
    } catch {
      toast("Erro ao atualizar nome exibido.", "error");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sequência + bônus + nome exibido */}
      <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2">
            <Zap size={18} className="text-purple" />
            Impulso
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="brand" size="sm">
              <Flame size={12} /> Sequência: {momentum.streakDays} {momentum.streakDays === 1 ? "dia" : "dias"}
            </Badge>
            {momentum.activeWeekStreak > 0 && (
              <Badge tone="ai" size="sm">
                {momentum.activeWeekStreak} {momentum.activeWeekStreak === 1 ? "semana ativa" : "semanas ativas"}
              </Badge>
            )}
            <Badge tone="neutral" size="sm">
              Hoje: {momentum.todayXp} XP
            </Badge>
            {doneCount > 0 && (
              <Badge tone="success" size="sm">
                <CheckCircle2 size={12} /> {doneCount}/{totalDone} metas batidas
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Próximo marco de sequência */}
          <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-2.5">
            <span className="text-[12.5px] font-semibold text-ink-soft flex items-center gap-1.5">
              <CalendarDays size={14} className="text-purple" />
              Próximo marco de sequência
            </span>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="font-display text-[20px] font-bold text-ink">
                  {momentum.streakDays} <span className="text-[14px] font-semibold text-ink-muted">de {momentum.nextStreakBonus} dias</span>
                </p>
                <p className="text-[12.5px] text-ink-muted">
                  {momentum.streakDays >= momentum.nextStreakBonus
                    ? "Sequência máxima do ciclo atingida — mantenha o ritmo!"
                    : `Faltam ${momentum.nextStreakBonus - momentum.streakDays} ${momentum.nextStreakBonus - momentum.streakDays === 1 ? "dia" : "dias"} para +${momentum.nextStreakBonus} XP`}
                </p>
              </div>
            </div>
            <ProgressBar value={streakPct} gradient="magenta" size="sm" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {[3, 7, 15, 30].map((m) => {
                const reached = momentum.streakDays >= m;
                return (
                  <span
                    key={m}
                    className={cn(
                      "text-[10.5px] font-bold rounded-pill px-2 py-0.5 border",
                      reached
                        ? "bg-success-soft text-success border-success/25"
                        : "bg-surface text-ink-muted border-border-soft"
                    )}
                  >
                    {reached ? <Check size={11} className="inline mr-0.5" /> : null}
                    {m}d · +{m === 3 ? 20 : m === 7 ? 50 : m === 15 ? 120 : 300} XP
                  </span>
                );
              })}
            </div>
          </div>

          {/* Nome exibido */}
          <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-2.5">
            <span className="text-[12.5px] font-semibold text-ink-soft flex items-center gap-1.5">
              <UserCog size={14} className="text-purple" />
              Como você aparece no Rank
            </span>
            <p className="text-[14px] font-semibold text-ink truncate">
              {displayName?.value ?? "Usuário"}
            </p>
            <div className="flex flex-col gap-1.5 mt-0.5">
              <button
                onClick={() => changeSource("profile")}
                disabled={savingName}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] font-semibold transition-all cursor-pointer disabled:opacity-50",
                  displayName?.storedSource === "profile"
                    ? "bg-ai-soft border-purple/40 text-purple"
                    : "bg-card border-border-soft text-ink-soft hover:text-ink"
                )}
              >
                <span className="w-4 h-4 rounded-full border border-current grid place-items-center flex-none">
                  {displayName?.source === "profile" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                </span>
                Nome do perfil
              </button>
              <button
                onClick={() => changeSource("instagram")}
                disabled={savingName || !displayName?.hasInstagram}
                title={!displayName?.hasInstagram ? "Conecte uma conta Instagram para usar esta opção" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                  displayName?.storedSource === "instagram"
                    ? "bg-ai-soft border-purple/40 text-purple"
                    : "bg-card border-border-soft text-ink-soft hover:text-ink"
                )}
              >
                <span className="w-4 h-4 rounded-full border border-current grid place-items-center flex-none">
                  {displayName?.source === "instagram" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                </span>
                Nome da conta Instagram
                {!displayName?.hasInstagram && <span className="text-[11px] text-ink-muted ml-auto">sem conta</span>}
              </button>
            </div>
            {displayName?.source === "instagram" && displayName?.storedSource === "instagram" ? (
              <p className="text-[11.5px] text-ink-muted">Usando o nome da conta Instagram conectada.</p>
            ) : displayName?.storedSource === "instagram" && !displayName?.hasInstagram ? (
              <p className="text-[11.5px] text-ink-muted">
                Conta Instagram indisponível — mostrando o nome do perfil.
              </p>
            ) : (
              <p className="text-[11.5px] text-ink-muted">Usando o nome do perfil do Inst Acessor.</p>
            )}
          </div>
        </div>
      </div>

      {/* Metas prontas agrupadas por período */}
      <div className="flex flex-col gap-4">
        {(["dia", "semana", "mes"] as const).map((period) => {
          const cards = grouped[period];
          if (!cards || cards.length === 0) return null;
          const concluded = cards.filter((c) => c.status === "concluida").length;
          const open = openGroup[period] ?? true;
          return (
            <div key={period} className="rounded-xl bg-card border border-border-soft shadow-xs">
              <button
                onClick={() => setOpenGroup((s) => ({ ...s, [period]: !s[period] }))}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer text-left"
                aria-expanded={open}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-[15px] font-bold text-ink">
                    {PERIOD_LABEL_SHORT[period]}
                  </span>
                  <Badge tone={concluded === cards.length ? "success" : "neutral"} size="sm">
                    {concluded}/{cards.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  {concluded === cards.length && (
                    <span className="text-[12px] font-semibold text-success flex items-center gap-1">
                      <CheckCircle2 size={13} /> Concluído
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-ink-muted transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  >
                    ▾
                  </span>
                </div>
              </button>
              {open && (
                <div className="px-5 pb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cards.map((c) => (
                    <MomentumCard key={c.id} card={c} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MomentumCard({ card }: { card: RitmoCardData }) {
  const done = card.status === "concluida";
  const noData = card.status === "sem-dados";

  return (
    <div
      className={cn(
        "rounded-xl border shadow-xs p-4 flex flex-col gap-3",
        done ? "bg-brand-grad-card border-purple/25" : noData ? "bg-card border-border-soft opacity-80" : "bg-card border-border-soft"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="font-display text-[14px] font-bold text-ink leading-tight">{card.title}</p>
          <p className="text-[12px] text-ink-soft">{card.subtitle}</p>
        </div>
        <Badge
          tone={done ? "success" : noData ? "neutral" : "warning"}
          size="xs"
          className="flex-none"
        >
          {done ? "Concluída" : noData ? "Sem dados" : "Em andamento"}
        </Badge>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="font-data text-[18px] font-bold text-ink">
            {card.available ? (
              card.isPercent ? (
                <>
                  {card.current}%
                  <span className="text-[13px] text-ink-muted font-semibold">
                    {" "}/ +{card.target}%
                  </span>
                </>
              ) : (
                <>
                  {card.current}
                  <span className="text-[13px] text-ink-muted font-semibold">
                    {" "}/ {card.target} {card.unit}
                  </span>
                </>
              )
            ) : (
              <span className="text-[15px] text-ink-muted">—</span>
            )}
          </p>
          <p className="text-[11.5px] text-ink-muted">{card.remainingLabel}</p>
        </div>
        <span className="text-[12.5px] font-bold text-ink-soft flex items-center gap-1">
          <Zap size={13} className="text-purple" /> +{card.xpReward} XP
        </span>
      </div>

      <ProgressBar
        value={card.progressPercent}
        gradient={done ? "green" : "brand"}
        size="sm"
      />
    </div>
  );
}

// ------------------------------------------------------------
// Resumo social no topo (rodada #289) — 4 métricas reais
// ------------------------------------------------------------

function SocialSummaryStrip({
  social,
  unlockedCount,
  visibleCount,
}: {
  social: RankSocialData | null;
  unlockedCount: number;
  visibleCount: number;
}) {
  const followers = social?.followers != null ? formatCount(social.followers) : "—";
  const growth =
    social?.growth30d != null
      ? formatSigned(social.growth30d)
      : "—";
  const instagram = social?.instagramConnected
    ? social.instagramUsername
      ? `@${social.instagramUsername}`
      : "Conectado"
    : "Não conectado";

  const items: { label: string; value: string; hint: string; icon: LucideIcon; ok?: boolean }[] = [
    {
      label: "Seguidores",
      value: followers,
      hint: "Instagram · mais recente",
      icon: Users,
      ok: social?.followers != null,
    },
    {
      label: "Crescimento",
      value: growth,
      hint: "nos últimos 30 dias",
      icon: TrendingUp,
      ok: social?.growth30d != null,
    },
    {
      label: "Instagram",
      value: instagram,
      hint: social?.instagramConnected ? "conta conectada" : "conecte sua conta p/ exibir",
      icon: Instagram,
      ok: social?.instagramConnected ?? false,
    },
    {
      label: "Conquistas",
      value: `${unlockedCount}/${visibleCount}`,
      hint: "desbloqueadas (visíveis)",
      icon: Award,
      ok: unlockedCount > 0,
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl bg-card border border-border-soft shadow-xs p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-[10px] bg-ai-soft text-purple grid place-items-center flex-none">
              <it.icon size={15} />
            </span>
            <span className="text-[12.5px] font-semibold text-ink-soft">{it.label}</span>
          </div>
          <p className="font-data font-bold text-[20px] leading-none text-ink">{it.value}</p>
          <p className="text-[11.5px] text-ink-muted">{it.hint}</p>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Perfil Público (rodada #289) — aba logo após "Visão geral"
// ------------------------------------------------------------

const TIER_ORDER: Record<string, number> = { BRONZE: 0, PRATA: 1, OURO: 2, DESAFIO: 3 };

function bestAchievement(list: AchievementData[], onlyDesafio = false) {
  const unlocked = list.filter((a) => a.unlocked && (onlyDesafio ? a.tier === "DESAFIO" : a.tier !== "DESAFIO"));
  if (unlocked.length === 0) return null;
  return unlocked.sort((a, b) => {
    const diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0);
    if (diff !== 0) return diff;
    // entre honrarias do mesmo tier, mostra a mais recente primeiro
    return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
  })[0];
}

function PerfilPublicoView({
  progress,
  summary,
  social,
  profilePublic,
  unlockedCount,
  totalCount,
  achievements,
  publicProfileUrl,
  onCopyLink,
  onShare,
}: {
  progress: ProgressData;
  summary: SummaryData;
  social: RankSocialData | null;
  profilePublic: RankProfilePublicData | null;
  unlockedCount: number;
  totalCount: number;
  achievements: AchievementData[];
  publicProfileUrl: string | null;
  onCopyLink: (url: string) => void;
  onShare: () => void;
}) {
  const name = profilePublic?.name ?? "Usuário";
  const ig = profilePublic?.igUsername ?? profilePublic?.username ?? null;
  const pos = summary.position !== null ? `#${summary.position}` : "—";

  const badge = bestAchievement(achievements, false);
  const trophy = bestAchievement(achievements, true);

  const stats: { label: string; value: string; icon: LucideIcon; empty: boolean }[] = [
    {
      label: "Seguidores",
      value: social?.followers != null ? formatCount(social.followers) : "—",
      icon: Users,
      empty: social?.followers == null,
    },
    {
      label: "Crescimento (30d)",
      value: social?.growth30d != null ? formatSigned(social.growth30d) : "—",
      icon: TrendingUp,
      empty: social?.growth30d == null,
    },
    {
      label: "Instagram",
      value: ig ? `@${ig}` : "Não conectado",
      icon: Instagram,
      empty: !ig,
    },
    {
      label: "Conquistas",
      value: `${unlockedCount}/${totalCount}`,
      icon: Award,
      empty: unlockedCount === 0,
    },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      {/* Card principal — como o perfil aparece publicamente */}
      <div className="rounded-xl bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-5">
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar name={name} src={profilePublic?.image ?? null} size="lg" />
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="font-display text-[18px] font-bold text-ink truncate">{name}</h3>
            <p className="text-[13px] text-ink-soft flex items-center gap-1.5 flex-wrap">
              {ig ? (
                <>
                  <Instagram size={13} className="text-purple flex-none" />
                  <span className="truncate">@{ig}</span>
                </>
              ) : (
                <span className="text-ink-muted">Instagram não conectado</span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone="brand" size="sm">Nível {progress.level}</Badge>
              <Badge tone="neutral" size="sm">{progress.xp} XP</Badge>
              <Badge tone="ai" size="sm">Rank {pos}</Badge>
            </div>
          </div>
        </div>

        <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-2.5">
          <span className="text-[12.5px] font-semibold text-ink-soft">
            Progresso para o nível {progress.level + 1}
          </span>
          <ProgressBar value={progress.progressToNext} gradient="brand" />
          <p className="text-[12.5px] text-ink-muted">
            {progress.xpInLevel} / {progress.xpNeededForNext} XP ·{" "}
            {Math.round(progress.progressToNext)}%
          </p>
        </div>

        <div className="grid gap-3 grid-cols-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-ink-soft flex items-center gap-1.5">
                <s.icon size={13} className="text-purple" />
                {s.label}
              </span>
              <p className={cn("font-data font-bold text-[18px] leading-none", s.empty ? "text-ink-muted" : "text-ink")}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="gap-2"
            disabled={!publicProfileUrl}
            onClick={() => publicProfileUrl && onCopyLink(publicProfileUrl)}
          >
            <CopyIcon size={15} /> Copiar link do perfil
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onShare}>
            <Share2 size={15} /> Compartilhar evolução
          </Button>
        </div>
        {!publicProfileUrl && (
          <p className="text-[12px] text-ink-muted">
            Defina um nome de usuário no Perfil para gerar o link público.
          </p>
        )}
      </div>

      {/* Honrarias reais */}
      <div className="flex flex-col gap-5">
        <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-2">
          <h4 className="font-display text-[14px] font-bold text-ink flex items-center gap-2">
            <Crown size={16} className="text-warn" />
            Melhor badge
          </h4>
          {badge ? (
            <div className="flex items-center gap-3">
              <span className={cn("w-10 h-10 rounded-[14px] grid place-items-center", tierClass(badge.tier))}>
                {achievementIcon(badge.tier)({ size: 18 })}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[13.5px] font-semibold text-ink truncate">{badge.title}</p>
                <span className="text-[11.5px] text-ink-muted">{TIER_LABEL[badge.tier] ?? badge.tier}</span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">— Nenhuma ainda</p>
          )}
        </div>

        <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-2">
          <h4 className="font-display text-[14px] font-bold text-ink flex items-center gap-2">
            <Sparkles size={16} className="text-purple" />
            Melhor troféu
          </h4>
          {trophy ? (
            <div className="flex items-center gap-3">
              <span className={cn("w-10 h-10 rounded-[14px] grid place-items-center", tierClass(trophy.tier))}>
                {achievementIcon(trophy.tier)({ size: 18 })}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[13.5px] font-semibold text-ink truncate">{trophy.title}</p>
                <span className="text-[11.5px] text-ink-muted">{TIER_LABEL[trophy.tier] ?? trophy.tier}</span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">— Nenhuma ainda</p>
          )}
        </div>

        <div className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-2">
          <h4 className="font-display text-[14px] font-bold text-ink flex items-center gap-2">
            <Globe size={16} className="text-purple" />
            Link público
          </h4>
          {publicProfileUrl ? (
            <p className="text-[12px] text-ink-muted break-all leading-relaxed">{publicProfileUrl}</p>
          ) : (
            <p className="text-[12.5px] text-ink-muted">
              Seu perfil público fica em <span className="font-semibold text-ink-soft">/p/[usuário]</span>. Conecte o
              Instagram ou defina um nome de usuário para ativar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EvolutionSvg({ points }: { points: EvolutionPoint[] }) {
  const values = points.map((p) => p.xp);
  const W = 720;
  const H = 210;
  const PAD = { top: 18, right: 16, bottom: 26, left: 42 };

  // Escala do eixo Y: sempre cobre 0 → valor máximo, com "ticks" bonitos e
  // inteiros (nunca 566667 / 333333 / 999999 quebrados). O eixo começa em 0
  // pois XP é acumulado e não pode ser negativo.
  const rawMax = Math.max(...values, 0);
  const ticks = niceTicks(rawMax);
  const upper = ticks[ticks.length - 1];
  const lower = 0;
  const ySpan = upper - lower || 1;

  const x = (i: number) => {
    if (values.length === 1) return PAD.left + (W - PAD.left - PAD.right) / 2;
    return PAD.left + (i / (values.length - 1)) * (W - PAD.left - PAD.right);
  };
  const y = (v: number) => PAD.top + ((upper - v) / ySpan) * (H - PAD.top - PAD.bottom);

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const areaPath = values.length === 1
    ? `${linePath} L${x(0).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`
    : `${linePath} L${x(values.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolução do XP">
      <defs>
        <linearGradient id="xpArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="xpLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F43F8E" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      {ticks.map((tick, t) => {
        const gy = y(tick);
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} stroke="#E5E7EB" strokeDasharray="4 4" />
            <text x={PAD.left - 8} y={gy + 3} textAnchor="end" fontSize="10.5" fill="#9CA3AF">
              {tick === 0 ? "0" : formatXp(tick)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#xpArea)" />
      <path d={linePath} fill="none" stroke="url(#xpLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {values.length === 1 ? (
        <circle cx={x(0)} cy={y(values[0])} r="5" fill="#F43F8E" stroke="#fff" strokeWidth="2" />
      ) : (
        <>
          <circle cx={x(0)} cy={y(values[0])} r="4" fill="#fff" stroke="#A855F7" strokeWidth="2" />
          <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4.5" fill="#F43F8E" stroke="#fff" strokeWidth="2" />
        </>
      )}

      {values.length === 1 ? (
        <text
          x={x(0)}
          y={H - 6}
          textAnchor="middle"
          fontSize="10.5"
          fill="#9CA3AF"
        >
          {shortDate(points[0]?.label)}
        </text>
      ) : (
        [0, Math.floor((values.length - 1) / 2), values.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"}
            fontSize="10.5"
            fill="#9CA3AF"
          >
            {shortDate(points[i]?.label)}
          </text>
        ))
      )}
    </svg>
  );
}

function formatXp(n: number): string {
  // XP é sempre inteiro. Para valores grandes usa-se abreviação inteira (sem
  // decimais) para os rótulos do eixo — nunca "566,7k" quebrado.
  if (Math.abs(n) >= 1_000) {
    if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
    if (Math.abs(n) >= 10_000) return `${Math.round(n / 1_000)}k`;
    return `${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  }
  return String(Math.round(n));
}

/**
 * Gera "ticks" bonitos e INTEIROS para o eixo Y do gráfico de XP.
 * - 3 a 5 linhas de grade (incluindo o 0).
 * - Sempre cobre o valor máximo dos dados (upper >= max).
 * - Passo inteiro "redondo" (1/2/5 × potência de 10) → rótulos legíveis,
 *   sem números concatenados tipo 566667/333333/999999.
 */
function niceTicks(maxValue: number): number[] {
  const max = Math.max(1, Math.ceil(maxValue));
  const baseStep = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, baseStep))));
  const norm = baseStep / mag;
  const stepF = norm <= 1 ? mag : norm <= 2 ? 2 * mag : norm <= 5 ? 5 * mag : 10 * mag;
  const step = Math.max(1, Math.ceil(stepF));
  const k = Math.max(1, Math.ceil(max / step));
  const ticks: number[] = [];
  for (let i = 0; i <= k; i++) ticks.push(i * step);
  return ticks;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatSigned(n: number): string {
  const abs = new Intl.NumberFormat("pt-BR").format(Math.abs(n));
  return n > 0 ? `+${abs}` : n < 0 ? `-${abs}` : "0";
}

function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ------------------------------------------------------------
// Ranking
// ------------------------------------------------------------

function RankingView({ entries, me }: { entries: RankingEntry[]; me: SummaryData }) {
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="flex flex-col gap-5">
      {/* Pódio */}
      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[podium[1], podium[0], podium[2]]
            .filter(Boolean)
            .map((e) => (
              <div
                key={e.userId}
                className={cn(
                  "rounded-xl border shadow-xs p-5 flex flex-col items-center gap-2 text-center",
                  e.isMe ? "bg-brand-grad-card border-purple/30" : "bg-card border-border-soft"
                )}
              >
                <span className={cn("w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold", e.position === 1 ? "bg-warn/15 text-warn" : e.position === 2 ? "bg-surface text-ink-soft" : "bg-warn-soft text-warn")}>
                  {e.position === 1 ? <Crown size={18} /> : e.position === 2 ? <Medal size={18} /> : <Medal size={18} />}
                </span>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-display text-[14px] font-bold text-ink max-w-full truncate">
                    {e.name}
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    Nível {e.level} · {e.xp} XP
                  </span>
                </div>
                {e.isMe && <Badge tone="brand" size="xs">Você</Badge>}
              </div>
            ))}
        </div>
      )}

      {/* Lista completa */}
      <div className="rounded-xl bg-card border border-border-soft shadow-xs">
        {entries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Trophy}
              title="Ranking vazio"
              description="Quando outros usuários acumularem XP, o ranking aparece aqui."
            />
          </div>
        ) : (
          <div className="divide-y divide-border-soft">
            {entries.map((e) => (
              <div
                key={e.userId}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5",
                  e.isMe && "bg-brand-grad-soft"
                )}
              >
                <span className="font-data font-bold text-[15px] text-ink-muted w-8 flex-none text-center">
                  {e.position}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] font-semibold text-ink truncate">
                    {e.name}
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    Nível {e.level} · {e.xp} XP
                  </p>
                </div>
                {e.isMe && <Badge tone="brand" size="xs">Você</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[12.5px] text-ink-muted px-1">
        Posição atual: {me.position !== null ? `#${me.position}` : "fora do ranking"} de{" "}
        {me.totalUsers} usuário(s). O ranking é calculado pelo XP acumulado em ações reais.
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// Metas
// ------------------------------------------------------------

function MetasView({
  goals,
  onChanged,
  toast,
  onOpenCreate,
}: {
  goals: GoalData[];
  onChanged: () => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
  onOpenCreate: () => void;
}) {
  const active = goals.filter((g) => g.status === "ATIVA");
  const done = goals.filter((g) => g.status === "CONCLUIDA");
  const cancelled = goals.filter((g) => g.status === "CANCELADA");

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/rank/metas?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao atualizar meta.", "error");
        return;
      }
      toast("Meta atualizada.");
      onChanged();
    } catch {
      toast("Erro ao atualizar meta.", "error");
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/rank/metas?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast("Erro ao excluir meta.", "error");
        return;
      }
      toast("Meta excluída.");
      onChanged();
    } catch {
      toast("Erro ao excluir meta.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-ink-soft max-w-lg">
          Metas estratégicas (crescimento, engajamento, consistência). O progresso é
          calculado com dados reais das suas redes.
        </p>
        <Button onClick={onOpenCreate} className="gap-2">
          <Plus size={16} /> Nova meta
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-xl bg-card border border-border-soft shadow-xs p-6">
          <EmptyState
            icon={Target}
            title="Nenhuma meta ainda"
            description="Crie sua primeira meta para acompanhar crescimento, engajamento ou consistência com dados reais."
            action={<Button size="sm" onClick={onOpenCreate} className="gap-2"><Plus size={14} /> Criar meta</Button>}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...active, ...done, ...cancelled].map((g) => (
            <div key={g.id} className="rounded-xl bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={g.category === "crescimento" ? "success" : g.category === "engajamento" ? "info" : "warning"}>
                      {GOAL_CATEGORY_LABEL[g.category] ?? g.category}
                    </Badge>
                    <Badge tone={g.status === "CONCLUIDA" ? "success" : g.status === "CANCELADA" ? "danger" : "neutral"}>
                      {g.status === "CONCLUIDA" ? "Concluída" : g.status === "CANCELADA" ? "Cancelada" : "Ativa"}
                    </Badge>
                    {g.platform && <Badge tone="ai">{g.platform}</Badge>}
                  </div>
                  <h3 className="font-display text-[15px] font-bold text-ink mt-1">{g.title}</h3>
                  {g.description && <p className="text-[13px] text-ink-soft">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {g.status === "ATIVA" && (
                    <Button variant="success" size="xs" onClick={() => updateStatus(g.id, "CONCLUIDA")} className="gap-1.5">
                      <CheckCircle2 size={13} /> Concluir
                    </Button>
                  )}
                  {g.status === "ATIVA" && (
                    <Button variant="outline" size="xs" onClick={() => updateStatus(g.id, "CANCELADA")}>
                      Cancelar
                    </Button>
                  )}
                  {g.status === "CONCLUIDA" && (
                    <Button variant="outline" size="xs" onClick={() => updateStatus(g.id, "ATIVA")}>
                      Reabrir
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" onClick={() => remove(g.id)} aria-label="Excluir meta" className="text-ink-muted hover:text-danger">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-ink-soft">
                    {g.currentValue ?? 0} {g.unit}
                    {g.targetValue ? ` de ${g.targetValue} ${g.unit}` : ""}
                  </span>
                  <span className="text-ink-muted">{g.progressPercent}%</span>
                </div>
                <ProgressBar
                  value={g.progressPercent}
                  gradient={g.status === "CONCLUIDA" ? "green" : "brand"}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGoalModal({
  open,
  onClose,
  onCreated,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
}) {
  const [category, setCategory] = React.useState("crescimento");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [targetValue, setTargetValue] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [platform, setPlatform] = React.useState("instagram");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!title.trim()) {
      toast("Dê um título à meta.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rank/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          description: description.trim() || undefined,
          targetValue: targetValue ? Number(targetValue) : undefined,
          unit: unit.trim() || undefined,
          platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao criar meta.", "error");
        return;
      }
      toast("Meta criada!");
      onCreated();
    } catch {
      toast("Erro ao criar meta.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova meta" description="Defina uma meta estratégica com dados reais.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">Categoria</label>
          <div className="flex gap-2 flex-wrap">
            {["crescimento", "engajamento", "consistencia"].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1.5 rounded-pill border text-[12.5px] font-semibold transition-all cursor-pointer",
                  category === c
                    ? "bg-ai-soft border-purple/40 text-purple"
                    : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                )}
              >
                {GOAL_CATEGORY_LABEL[c] ?? c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Alcançar 500 seguidores"
            className="rounded-lg border border-border bg-bg-ice px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/10 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">Descrição (opcional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Meta para o próximo mês"
            className="rounded-lg border border-border bg-bg-ice px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/10 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-ink-soft">Meta (valor)</label>
            <input
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              inputMode="numeric"
              placeholder="Ex.: 500"
              className="rounded-lg border border-border bg-bg-ice px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/10 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-ink-soft">Unidade</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ex.: seguidores"
              className="rounded-lg border border-border bg-bg-ice px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/10 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">Plataforma</label>
          <div className="flex gap-2">
            {["instagram", "tiktok"].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  "px-3 py-1.5 rounded-pill border text-[12.5px] font-semibold transition-all cursor-pointer",
                  platform === p
                    ? "bg-ai-soft border-purple/40 text-purple"
                    : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                )}
              >
                {p === "instagram" ? "Instagram" : "TikTok"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <TargetIcon size={15} />}
            {saving ? "Salvando..." : "Criar meta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Conquistas
// ------------------------------------------------------------

function ConquistasView({
  achievements,
  onlyVisible,
  onToggleVisible,
  unlockedCount,
  visibleCount,
  unlockedPct,
  currentLevel,
}: {
  achievements: AchievementData[];
  onlyVisible: boolean;
  onToggleVisible: () => void;
  unlockedCount: number;
  visibleCount: number;
  unlockedPct: number;
  currentLevel: number;
}) {
  const list = onlyVisible ? achievements.filter((a) => !a.hidden) : achievements;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-ink-soft max-w-lg">
          {unlockedCount} de {visibleCount} conquistas visíveis desbloqueadas ({unlockedPct}%).
          A partir de ~70%, desafios mais difíceis aparecem.
        </p>
        <Button variant="outline" size="sm" onClick={onToggleVisible} className="gap-2">
          {onlyVisible ? <Sparkles size={14} /> : <Award size={14} />}
          {onlyVisible ? "Mostrar todas" : "Mostrar visíveis"}
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl bg-card border border-border-soft shadow-xs p-6">
          <EmptyState
            icon={Award}
            title="Nenhuma conquista"
            description="Conquistas são desbloqueadas por ações reais: criar copies, ideias, rascunhos, rodar análises, completar experimentos e mais."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const Icon = achievementIcon(a.tier);
            const pct = a.threshold > 0 ? Math.min(100, Math.round((a.progress / a.threshold) * 100)) : 0;
            return (
              <div
                key={a.slug}
                className={cn(
                  "rounded-xl border shadow-xs p-5 flex flex-col gap-3",
                  a.unlocked ? "bg-brand-grad-card border-purple/25" : "bg-card border-border-soft"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("w-10 h-10 rounded-[14px] grid place-items-center", a.unlocked ? "bg-brand-grad text-white" : "bg-surface text-ink-muted")}>
                    {a.unlocked ? <Icon size={18} /> : <Lock size={17} />}
                  </span>
                  <Badge tone={a.unlocked ? "success" : "neutral"} size="xs">
                    {a.unlocked ? "Desbloqueada" : "Bloqueada"}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-display text-[15px] font-bold text-ink">{a.title}</h3>
                  <p className="text-[12.5px] text-ink-soft leading-relaxed">{a.description}</p>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={cn("text-[11px] font-bold rounded-pill px-2.5 py-1", tierClass(a.tier))}>
                    {TIER_LABEL[a.tier] ?? a.tier}
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    {a.progress} / {a.threshold} {a.unit}
                  </span>
                </div>

                <ProgressBar value={pct} gradient={a.unlocked ? "green" : "brand"} size="xs" />

                <p className="text-[12.5px] font-semibold text-ink-soft flex items-center gap-1.5">
                  <Zap size={13} className="text-purple" /> +{a.xpReward} XP ao desbloquear
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Histórico de XP
// ------------------------------------------------------------

function HistoricoView({ xpLogs }: { xpLogs: XpLogData[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-soft max-w-lg">
        Auditoria completa das concessões de XP. Cada ação real é registrada uma única vez —
        a mesma ação nunca concede XP duas vezes.
      </p>

      {xpLogs.length === 0 ? (
        <div className="rounded-xl bg-card border border-border-soft shadow-xs p-6">
          <EmptyState
            icon={History}
            title="Sem XP ainda"
            description="Faça ações no app (criar copy, salvar ideia, rodar análise, completar experimento...) para começar a acumular XP."
          />
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border-soft shadow-xs divide-y divide-border-soft">
          {xpLogs.map((l) => (
            <div key={`${l.source}-${l.refId}-${l.createdAt}`} className="flex items-center gap-4 px-5 py-3.5">
              <span className="w-8 h-8 rounded-[10px] bg-ai-soft text-purple grid place-items-center flex-none">
                <Zap size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink truncate">
                  {SOURCE_LABEL[l.source] ?? l.source}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {new Date(l.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="font-data font-bold text-[15px] text-success flex-none">
                +{l.amount} XP
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-[12.5px] text-ink-muted px-1">
        <BarChart3 size={14} className="mt-0.5 flex-none" />
        A progressão recompensa comportamentos que contribuem para crescimento: consistência,
        executar recomendações, testar conteúdos e acompanhar resultados.
      </p>
    </div>
  );
}
