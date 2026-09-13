"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  Check,
  UserCog,
  Users,
  Share2,
  Copy as CopyIcon,
  Instagram,
  Globe,
  ChevronRight,
  Flag,
  Minus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";
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

/**
 * Espelho EXATO das constantes reais do motor de metas
 * (`src/lib/gamification/momentum-core.ts`):
 *   STREAK_BONUS_MILESTONES = [3, 7, 15, 30]
 *   STREAK_BONUS_XP = { 3: 20, 7: 50, 15: 120, 30: 300 }
 * Mantido como espelho local porque `momentum-core` é server-only (acessa o
 * banco) e este arquivo é um Client Component. NÃO alterar sem alterar o core.
 */
const STREAK_MILESTONES: { day: number; xp: number }[] = [
  { day: 3, xp: 20 },
  { day: 7, xp: 50 },
  { day: 15, xp: 120 },
  { day: 30, xp: 300 },
];

const TIER_CARD_CLASS: Record<string, string> = {
  OURO: "rnk-tier rnk-tier-ouro",
  PRATA: "rnk-tier rnk-tier-prata",
  DESAFIO: "rnk-tier rnk-tier-desafio",
  BRONZE: "rnk-tier rnk-tier-bronze",
};

function tierCardClass(tier: string): string {
  return TIER_CARD_CLASS[tier] ?? TIER_CARD_CLASS.BRONZE;
}

function achievementIcon(tier: string) {
  if (tier === "DESAFIO") return Sparkles;
  if (tier === "OURO") return Crown;
  if (tier === "PRATA") return Star;
  return Flame;
}

/**
 * `achievementIcon` devolve o COMPONENTE (objeto lucide), não um elemento —
 * então ele precisa ser renderizado como `<TierIcon tier={...} size={...} />`
 * e nunca chamado como função (`achievementIcon(t)({...})` é inválido).
 */
function TierIcon({ tier, size = 12 }: { tier: string; size?: number }) {
  const Icon = achievementIcon(tier);
  return <Icon size={size} />;
}

const TIER_ORDER: Record<string, number> = { BRONZE: 0, PRATA: 1, OURO: 2, DESAFIO: 3 };

function bestAchievement(list: AchievementData[], onlyDesafio = false) {
  const unlocked = list.filter(
    (a) => a.unlocked && (onlyDesafio ? a.tier === "DESAFIO" : a.tier !== "DESAFIO")
  );
  if (unlocked.length === 0) return null;
  return unlocked.sort((a, b) => {
    const diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0);
    if (diff !== 0) return diff;
    return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
  })[0];
}

const PERIOD_LABEL: Record<string, string> = {
  dia: "Meta diária",
  semana: "Meta semanal",
  mes: "Meta mensal",
};

const PERIOD_LABEL_PLURAL: Record<string, string> = {
  dia: "Metas diárias",
  semana: "Metas semanais",
  mes: "Metas mensais",
};

// ------------------------------------------------------------
// Helpers de formatação
// ------------------------------------------------------------

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

/**
 * Curva de nível REAL (`xpRequiredForLevel` em `src/lib/gamification/xp.ts`):
 *   xpToNextLevel(level) = 100 + (level - 1) * 25
 *   xpRequiredForLevel(level) = soma da curva até `level - 1`
 * Espelhada aqui pelo mesmo motivo do streak: `xp.ts` importa o cliente do
 * banco. Nenhum número é inventado — os valores são derivados desta fórmula.
 */
function xpToNextLevelLocal(level: number): number {
  return 100 + (level - 1) * 25;
}

function xpRequiredForLevelLocal(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNextLevelLocal(l);
  return total;
}

// ------------------------------------------------------------
// Primitivas visuais (dark premium) — escopadas em `.rnk-*`
// ------------------------------------------------------------

type RnkBtnVariant = "primary" | "outline" | "ghost" | "success" | "soft";

function RnkBtn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  title,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: RnkBtnVariant;
  size?: "sm" | "md" | "xs";
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn("rnk-btn", `rnk-btn-${variant}`, `rnk-btn-${size}`, className)}
    >
      {children}
    </button>
  );
}

function RnkBar({
  value,
  tone = "brand",
  size = "md",
}: {
  value: number;
  tone?: "brand" | "green" | "amber" | "muted";
  size?: "xs" | "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("rnk-bar", `rnk-bar-${size}`)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={cn("rnk-bar-fill", `rnk-bar-${tone}`)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RnkRing({
  value,
  size = 148,
  stroke = 11,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;

  return (
    <div className="rnk-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="rnkRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F43F8E" />
            <stop offset="48%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.085)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#rnkRingGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      {label ? <div className="rnk-ring-label">{label}</div> : null}
    </div>
  );
}

function RnkAvatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const hue = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }, [name]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rnk-avatar"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="rnk-avatar rnk-avatar-fallback"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(140deg, hsl(${hue} 62% 42%) 0%, hsl(${(hue + 48) % 360} 58% 32%) 100%)`,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function RnkEmpty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rnk-empty">
      <span className="rnk-empty-ic" aria-hidden="true">
        <Icon size={20} />
      </span>
      <p className="rnk-empty-title">{title}</p>
      <p className="rnk-empty-text">{text}</p>
      {action ? <div className="rnk-empty-action">{action}</div> : null}
    </div>
  );
}

function RnkSectionHead({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="rnk-shead">
      <h3 className="rnk-h3">
        <span className="rnk-h3-ic" aria-hidden="true">
          <Icon size={15} />
        </span>
        {title}
      </h3>
      {hint ? <p className="rnk-hint">{hint}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------
// CSS escopado (dark premium) — injetado uma única vez
// ------------------------------------------------------------

const RANK_CSS = `
.rnk-wrap{
  --rnk-card:linear-gradient(158deg, rgba(255,255,255,.055) 0%, rgba(255,255,255,.016) 100%);
  --rnk-card-flat:rgba(255,255,255,.032);
  --rnk-border:rgba(255,255,255,.085);
  --rnk-border-strong:rgba(255,255,255,.15);
  --rnk-ink:#F3F5F9;
  --rnk-soft:#A8B0C0;
  --rnk-muted:#6F7889;
  --rnk-green:#34D399;
  --rnk-green-soft:rgba(52,211,153,.12);
  --rnk-amber:#FBBF24;
  --rnk-grad:linear-gradient(115deg,#F43F8E 0%,#A855F7 48%,#6366F1 100%);
  position:relative;
  isolation:isolate;
  overflow:hidden;
  border-radius:26px;
  padding:clamp(14px,2.2vw,26px);
  color:var(--rnk-ink);
  background:
    radial-gradient(940px 440px at 10% -8%, rgba(139,92,246,.22), transparent 62%),
    radial-gradient(760px 380px at 94% 2%, rgba(52,211,153,.10), transparent 64%),
    radial-gradient(700px 460px at 48% 112%, rgba(244,63,142,.11), transparent 62%),
    #0A0B10;
}
.rnk-wrap *{box-sizing:border-box}
.rnk-wrap::after{
  content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;
  background-image:linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px),
                   linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px);
  background-size:52px 52px;
  mask-image:radial-gradient(760px 520px at 50% 0%, #000 0%, transparent 78%);
  -webkit-mask-image:radial-gradient(760px 520px at 50% 0%, #000 0%, transparent 78%);
}
.rnk-stack{display:flex;flex-direction:column;gap:16px}
.rnk-grid-2{display:grid;gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}
.rnk-grid-3{display:grid;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr))}
.rnk-grid-4{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}
.rnk-card{
  position:relative;
  background:var(--rnk-card);
  border:1px solid var(--rnk-border);
  border-radius:20px;
  padding:clamp(14px,1.8vw,22px);
}
.rnk-card-tight{padding:clamp(12px,1.4vw,16px)}
.rnk-card-flush{padding:0;overflow:hidden}
.rnk-shead{display:flex;flex-direction:column;gap:4px}
.rnk-pagehead{display:flex;flex-direction:column;gap:6px}
.rnk-pagehead-title{
  display:flex;align-items:center;gap:11px;margin:0;
  font-family:var(--font-display,inherit);font-size:clamp(24px,3vw,30px);
  font-weight:800;letter-spacing:-.025em;color:#fff;
}
.rnk-pagehead-ic{
  width:38px;height:38px;border-radius:13px;display:grid;place-items:center;flex:none;
  background:var(--rnk-grad);color:#fff;box-shadow:0 10px 28px rgba(168,85,247,.3);
}
.rnk-pagehead-sub{font-size:13.5px;color:var(--rnk-soft);margin:0;line-height:1.6;max-width:76ch}
.rnk-h2{font-family:var(--font-display,inherit);font-size:clamp(18px,2.2vw,22px);font-weight:800;letter-spacing:-.02em;color:var(--rnk-ink);margin:0}
.rnk-h3{display:flex;align-items:center;gap:9px;font-family:var(--font-display,inherit);font-size:15px;font-weight:700;color:var(--rnk-ink);margin:0}
.rnk-h3-ic{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;flex:none;background:rgba(139,92,246,.16);color:#C4B5FD}
.rnk-hint{font-size:12.5px;color:var(--rnk-muted);margin:0;line-height:1.5}
.rnk-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:var(--rnk-muted)}
.rnk-num{font-family:var(--font-data,ui-monospace,monospace);font-variant-numeric:tabular-nums;letter-spacing:-.01em}

/* ---------- abas ---------- */
.rnk-tabs{display:flex;gap:6px;overflow-x:auto;padding:5px;border:1px solid var(--rnk-border);border-radius:16px;background:rgba(255,255,255,.022);scrollbar-width:none;-ms-overflow-style:none}
.rnk-tabs::-webkit-scrollbar{display:none}
.rnk-tab{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;
  padding:9px 15px;border-radius:12px;border:1px solid transparent;
  background:transparent;color:var(--rnk-soft);
  font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer;
  transition:background .18s ease,color .18s ease,border-color .18s ease;
}
.rnk-tab:hover{color:var(--rnk-ink);background:rgba(255,255,255,.05)}
.rnk-tab[aria-selected="true"]{
  color:#fff;background:var(--rnk-grad);
  border-color:rgba(255,255,255,.18);
  box-shadow:0 8px 26px rgba(168,85,247,.28);
}
.rnk-tab:focus-visible{outline:2px solid #C4B5FD;outline-offset:2px}

/* ---------- botões ---------- */
.rnk-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border-radius:12px;border:1px solid transparent;
  font-weight:700;cursor:pointer;white-space:nowrap;
  transition:transform .16s ease,background .18s ease,border-color .18s ease,opacity .18s ease;
}
.rnk-btn:active:not(:disabled){transform:translateY(1px)}
.rnk-btn:disabled{opacity:.45;cursor:not-allowed}
.rnk-btn:focus-visible{outline:2px solid #C4B5FD;outline-offset:2px}
.rnk-btn-xs{padding:5px 10px;font-size:11.5px;border-radius:10px}
.rnk-btn-sm{padding:7px 13px;font-size:12.5px}
.rnk-btn-md{padding:10px 17px;font-size:13.5px}
.rnk-btn-primary{background:var(--rnk-grad);color:#fff;box-shadow:0 8px 24px rgba(168,85,247,.26)}
.rnk-btn-primary:hover:not(:disabled){box-shadow:0 12px 30px rgba(168,85,247,.34)}
.rnk-btn-outline{background:rgba(255,255,255,.045);border-color:var(--rnk-border-strong);color:var(--rnk-ink)}
.rnk-btn-outline:hover:not(:disabled){background:rgba(255,255,255,.09)}
.rnk-btn-ghost{background:transparent;color:var(--rnk-soft)}
.rnk-btn-ghost:hover:not(:disabled){background:rgba(255,255,255,.06);color:var(--rnk-ink)}
.rnk-btn-success{background:var(--rnk-green-soft);border-color:rgba(52,211,153,.34);color:var(--rnk-green)}
.rnk-btn-success:hover:not(:disabled){background:rgba(52,211,153,.2)}
.rnk-btn-soft{background:rgba(255,255,255,.06);color:var(--rnk-soft);border-color:var(--rnk-border)}
.rnk-btn-soft:hover:not(:disabled){color:var(--rnk-ink)}

/* ---------- barra de progresso ---------- */
.rnk-bar{width:100%;border-radius:999px;background:rgba(255,255,255,.085);overflow:hidden}
.rnk-bar-xs{height:5px}
.rnk-bar-sm{height:7px}
.rnk-bar-md{height:10px}
.rnk-bar-fill{display:block;height:100%;border-radius:999px;transition:width .8s cubic-bezier(.22,1,.36,1)}
.rnk-bar-brand{background:var(--rnk-grad)}
.rnk-bar-green{background:linear-gradient(90deg,#10B981,#34D399)}
.rnk-bar-amber{background:linear-gradient(90deg,#F59E0B,#FBBF24)}
.rnk-bar-muted{background:rgba(255,255,255,.25)}

/* ---------- anel ---------- */
.rnk-ring{position:relative;flex:none}
.rnk-ring svg{display:block}
.rnk-ring-label{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:1px}
.rnk-ring-val{font-family:var(--font-data,ui-monospace,monospace);font-size:29px;font-weight:800;line-height:1;color:#fff}
.rnk-ring-cap{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--rnk-muted)}

/* ---------- avatar ---------- */
.rnk-avatar{border-radius:50%;object-fit:cover;flex:none;border:1px solid rgba(255,255,255,.14)}
.rnk-avatar-fallback{display:grid;place-items:center;font-weight:800;color:#fff}

/* ---------- chips ---------- */
.rnk-chip{
  display:inline-flex;align-items:center;gap:5px;
  padding:3px 9px;border-radius:999px;
  font-size:11px;font-weight:700;line-height:1.55;
  border:1px solid var(--rnk-border);background:rgba(255,255,255,.05);color:var(--rnk-soft);
}
.rnk-chip-green{background:var(--rnk-green-soft);border-color:rgba(52,211,153,.3);color:var(--rnk-green)}
.rnk-chip-amber{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.3);color:var(--rnk-amber)}
.rnk-chip-brand{background:rgba(139,92,246,.16);border-color:rgba(139,92,246,.32);color:#C4B5FD}
.rnk-chip-outline{background:transparent}
.rnk-you{background:var(--rnk-grad);color:#fff;border-color:transparent}
.rnk-tier{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800;border:1px solid transparent}
.rnk-tier-ouro{background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.32);color:#FBBF24}
.rnk-tier-prata{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);color:#C7CCD6}
.rnk-tier-desafio{background:rgba(139,92,246,.18);border-color:rgba(139,92,246,.34);color:#C4B5FD}
.rnk-tier-bronze{background:rgba(251,146,60,.14);border-color:rgba(251,146,60,.3);color:#FDBA74}

/* ---------- vazio ---------- */
.rnk-empty{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:14px 0}
.rnk-empty-ic{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.05);border:1px dashed var(--rnk-border-strong);color:var(--rnk-muted);margin-bottom:3px}
.rnk-empty-title{font-size:13.5px;font-weight:700;color:var(--rnk-soft);margin:0}
.rnk-empty-text{font-size:12.5px;color:var(--rnk-muted);margin:0;line-height:1.55;max-width:56ch}
.rnk-empty-action{margin-top:6px}
.rnk-dash{color:var(--rnk-muted);font-weight:600}

/* ---------- hero ---------- */
.rnk-hero{display:grid;gap:clamp(18px,2.6vw,34px);grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:center}
.rnk-hero-l{display:flex;align-items:center;gap:clamp(16px,2.2vw,26px);flex-wrap:wrap}
.rnk-hero-info{display:flex;flex-direction:column;gap:9px;min-width:0}
.rnk-hero-title{font-family:var(--font-display,inherit);font-size:clamp(15px,1.6vw,17px);font-weight:700;color:var(--rnk-ink);margin:0;line-height:1.35}
.rnk-hero-sub{font-size:12.5px;color:var(--rnk-muted);margin:0;line-height:1.55}
.rnk-hero-r{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
@media(min-width:1024px){.rnk-hero-r{align-items:flex-end;text-align:right}}
.rnk-pos{display:flex;align-items:baseline;gap:8px}
.rnk-pos-val{font-family:var(--font-data,ui-monospace,monospace);font-size:clamp(26px,3.4vw,34px);font-weight:800;color:#fff;line-height:1}
.rnk-pos-cap{font-size:12.5px;color:var(--rnk-muted)}
.rnk-divider{height:1px;background:var(--rnk-border);margin:2px 0}

/* ---------- próxima meta (horizontal) ---------- */
.rnk-next{
  display:grid;gap:16px;align-items:center;
  grid-template-columns:minmax(0,auto) minmax(0,1fr) minmax(0,auto);
  border-radius:20px;padding:clamp(14px,1.8vw,20px);
  background:linear-gradient(115deg, rgba(244,63,142,.13), rgba(168,85,247,.11) 48%, rgba(99,102,241,.13));
  border:1px solid rgba(168,85,247,.26);
}
.rnk-next-l{display:flex;align-items:center;gap:13px;min-width:0}
.rnk-next-ic{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;flex:none;background:var(--rnk-grad);color:#fff;box-shadow:0 10px 26px rgba(168,85,247,.3)}
.rnk-next-val{font-family:var(--font-display,inherit);font-size:clamp(17px,2vw,21px);font-weight:800;color:#fff;margin:0;line-height:1.2}
.rnk-next-sub{font-size:12.5px;color:var(--rnk-soft);margin:2px 0 0}
.rnk-next-mid{display:flex;flex-direction:column;gap:7px;min-width:0}
.rnk-next-meta{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--rnk-soft);font-weight:600}
.rnk-next-r{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
@media(min-width:900px){.rnk-next-r{align-items:flex-end}}
@media(max-width:899px){
  .rnk-next{grid-template-columns:1fr}
}

/* ---------- ranks próximos ---------- */
.rnk-ladder{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(168px,1fr))}
.rnk-lvl{
  position:relative;border-radius:17px;padding:14px;
  background:var(--rnk-card-flat);border:1px solid var(--rnk-border);
  display:flex;flex-direction:column;gap:9px;min-width:0;
  transition:border-color .2s ease,background .2s ease;
}
.rnk-lvl:hover{border-color:var(--rnk-border-strong)}
.rnk-lvl-now{
  background:linear-gradient(158deg, rgba(244,63,142,.16), rgba(139,92,246,.13) 55%, rgba(99,102,241,.16));
  border-color:rgba(168,85,247,.36);
}
.rnk-lvl-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.rnk-lvl-n{font-family:var(--font-data,ui-monospace,monospace);font-size:24px;font-weight:800;color:#fff;line-height:1}
.rnk-lvl-n-lg{font-size:28px}
.rnk-lvl-badge{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,.06);color:var(--rnk-soft);border:1px solid var(--rnk-border)}
.rnk-lvl-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--rnk-muted)}
.rnk-lvl-req{font-size:12px;color:var(--rnk-soft);margin:0;line-height:1.5}
.rnk-lvl-req b{color:var(--rnk-ink);font-family:var(--font-data,ui-monospace,monospace)}
.rnk-lvl-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}

/* ---------- destaques ---------- */
.rnk-hl{
  display:flex;gap:12px;align-items:flex-start;
  border-radius:17px;padding:14px;
  background:var(--rnk-card-flat);border:1px solid var(--rnk-border);min-width:0;
}
.rnk-hl-ic{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,.06);color:var(--rnk-soft);border:1px solid var(--rnk-border)}
.rnk-hl-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.rnk-hl-label{font-size:10.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--rnk-muted)}
.rnk-hl-val{font-family:var(--font-data,ui-monospace,monospace);font-size:22px;font-weight:800;color:#fff;line-height:1.15}
.rnk-hl-val-sm{font-family:var(--font-display,inherit);font-size:14px;font-weight:700;color:#fff;line-height:1.3;overflow-wrap:anywhere}
.rnk-hl-sub{font-size:11.5px;color:var(--rnk-muted)}

/* ---------- resumo social ---------- */
.rnk-strip{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.rnk-strip-item{border-radius:16px;padding:13px;background:var(--rnk-card-flat);border:1px solid var(--rnk-border);display:flex;flex-direction:column;gap:7px;min-width:0}
.rnk-strip-top{display:flex;align-items:center;gap:8px;min-width:0}
.rnk-strip-ic{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:none;background:rgba(139,92,246,.15);color:#C4B5FD}
.rnk-strip-ic-ok{background:var(--rnk-green-soft);color:var(--rnk-green)}
.rnk-strip-label{font-size:11.5px;font-weight:700;color:var(--rnk-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rnk-strip-val{font-family:var(--font-data,ui-monospace,monospace);font-size:19px;font-weight:800;color:#fff;line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rnk-strip-val-empty{color:var(--rnk-muted)}
.rnk-strip-hint{font-size:11px;color:var(--rnk-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---------- pódio ---------- */
.rnk-podium{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end}
.rnk-pod{
  border-radius:19px;padding:16px 14px;text-align:center;
  background:var(--rnk-card-flat);border:1px solid var(--rnk-border);
  display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;
  transition:transform .2s ease,border-color .2s ease;
}
.rnk-pod:hover{transform:translateY(-3px);border-color:var(--rnk-border-strong)}
.rnk-pod-1{
  background:linear-gradient(165deg, rgba(245,158,11,.17), rgba(255,255,255,.03) 62%);
  border-color:rgba(245,158,11,.34);
  padding:22px 14px;
}
.rnk-pod-me{border-color:rgba(168,85,247,.4);box-shadow:0 0 0 1px rgba(168,85,247,.18) inset}
.rnk-pod-crown{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,.07);color:var(--rnk-soft);border:1px solid var(--rnk-border)}
.rnk-pod-1 .rnk-pod-crown{background:rgba(245,158,11,.2);color:#FBBF24;border-color:rgba(245,158,11,.34)}
.rnk-pod-2 .rnk-pod-crown{background:rgba(255,255,255,.1);color:#D6DAE2}
.rnk-pod-3 .rnk-pod-crown{background:rgba(251,146,60,.16);color:#FDBA74;border-color:rgba(251,146,60,.3)}
.rnk-pod-name{font-family:var(--font-display,inherit);font-size:14px;font-weight:800;color:#fff;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}
.rnk-pod-meta{font-size:11.5px;color:var(--rnk-muted)}
.rnk-pod-xp{font-family:var(--font-data,ui-monospace,monospace);font-size:17px;font-weight:800;color:var(--rnk-green)}

/* ---------- linha do ranking ---------- */
.rnk-row{display:flex;align-items:center;gap:12px;padding:12px clamp(12px,1.6vw,20px);min-width:0}
.rnk-row-me{background:linear-gradient(90deg, rgba(244,63,142,.13), rgba(139,92,246,.1) 55%, transparent)}
.rnk-row-pos{font-family:var(--font-data,ui-monospace,monospace);font-size:14px;font-weight:800;color:var(--rnk-muted);width:26px;text-align:center;flex:none}
.rnk-row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.rnk-row-name{font-size:13.5px;font-weight:700;color:var(--rnk-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}
.rnk-row-meta{font-size:11.5px;color:var(--rnk-muted)}
.rnk-row-xp{font-family:var(--font-data,ui-monospace,monospace);font-size:14px;font-weight:800;color:var(--rnk-green);flex:none}
.rnk-rows{display:flex;flex-direction:column}
.rnk-rows > * + *{border-top:1px solid var(--rnk-border)}

/* ---------- metas ---------- */
.rnk-sum{display:grid;gap:11px;grid-template-columns:repeat(3,minmax(0,1fr))}
.rnk-sum-item{border-radius:17px;padding:14px;background:var(--rnk-card-flat);border:1px solid var(--rnk-border);display:flex;flex-direction:column;gap:7px;min-width:0}
.rnk-sum-label{font-size:10.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--rnk-muted)}
.rnk-sum-val{font-family:var(--font-display,inherit);font-size:16px;font-weight:800;color:#fff;line-height:1.25;overflow-wrap:anywhere}
.rnk-sum-val-sm{font-family:var(--font-data,ui-monospace,monospace);font-size:19px}
.rnk-sum-sub{font-size:11.5px;color:var(--rnk-muted);line-height:1.5;overflow-wrap:anywhere}
.rnk-mgrid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(228px,1fr))}
.rnk-meta{
  border-radius:17px;padding:14px;
  background:var(--rnk-card-flat);border:1px solid var(--rnk-border);
  display:flex;flex-direction:column;gap:10px;min-width:0;
}
.rnk-meta-done{background:linear-gradient(158deg, rgba(52,211,153,.14), rgba(255,255,255,.02) 62%);border-color:rgba(52,211,153,.3)}
.rnk-meta-off{opacity:.72}
.rnk-meta-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
.rnk-meta-title{font-family:var(--font-display,inherit);font-size:13.5px;font-weight:700;color:#fff;margin:0;line-height:1.3}
.rnk-meta-sub{font-size:11.5px;color:var(--rnk-muted);margin:2px 0 0}
.rnk-meta-nums{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap}
.rnk-meta-val{font-family:var(--font-data,ui-monospace,monospace);font-size:17px;font-weight:800;color:#fff;line-height:1.1;margin:0}
.rnk-meta-val span{font-size:12px;font-weight:700;color:var(--rnk-muted)}
.rnk-meta-xp{font-size:12px;font-weight:800;color:var(--rnk-green);display:inline-flex;align-items:center;gap:4px;flex:none}

/* ---------- sequência ---------- */
.rnk-streak{display:grid;gap:16px;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
.rnk-streak-num{font-family:var(--font-data,ui-monospace,monospace);font-size:clamp(30px,4.6vw,42px);font-weight:800;color:#fff;line-height:1}
.rnk-streak-num span{font-size:14px;font-weight:700;color:var(--rnk-muted)}
.rnk-miles{display:flex;flex-wrap:wrap;gap:7px}

/* ---------- evolução ---------- */
.rnk-chart-empty{height:200px;border-radius:16px;border:1px dashed var(--rnk-border-strong);background:rgba(255,255,255,.02);display:grid;place-items:center;padding:16px;text-align:center}

/* ---------- perfil público ---------- */
.rnk-pp{display:grid;gap:16px;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
.rnk-pp-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.rnk-pp-stats{display:grid;gap:11px;grid-template-columns:repeat(2,minmax(0,1fr))}
.rnk-pp-stat{border-radius:15px;padding:13px;background:var(--rnk-card-flat);border:1px solid var(--rnk-border);display:flex;flex-direction:column;gap:5px;min-width:0}
.rnk-pp-stat-label{font-size:11px;font-weight:700;color:var(--rnk-soft);display:flex;align-items:center;gap:6px}
.rnk-pp-stat-val{font-family:var(--font-data,ui-monospace,monospace);font-size:17px;font-weight:800;color:#fff;line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rnk-pp-stat-val-empty{color:var(--rnk-muted)}
.rnk-link{font-size:12px;color:var(--rnk-soft);overflow-wrap:anywhere;line-height:1.6;margin:0}

/* ---------- conquistas / histórico ---------- */
.rnk-ach{
  border-radius:17px;padding:15px;
  background:var(--rnk-card-flat);border:1px solid var(--rnk-border);
  display:flex;flex-direction:column;gap:11px;min-width:0;
}
.rnk-ach-on{background:linear-gradient(158deg, rgba(139,92,246,.15), rgba(255,255,255,.02) 60%);border-color:rgba(139,92,246,.32)}
.rnk-ach-ic{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,.06);color:var(--rnk-muted);border:1px solid var(--rnk-border)}
.rnk-ach-ic-on{background:var(--rnk-grad);color:#fff;border-color:transparent;box-shadow:0 8px 22px rgba(168,85,247,.26)}
.rnk-ach-title{font-family:var(--font-display,inherit);font-size:14px;font-weight:700;color:#fff;margin:0}
.rnk-ach-text{font-size:12px;color:var(--rnk-soft);margin:0;line-height:1.55}
.rnk-log{display:flex;align-items:center;gap:12px;padding:12px clamp(12px,1.6vw,20px);min-width:0}
.rnk-log-ic{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;flex:none;background:rgba(139,92,246,.16);color:#C4B5FD}
.rnk-log-xp{font-family:var(--font-data,ui-monospace,monospace);font-size:14px;font-weight:800;color:var(--rnk-green);flex:none}
.rnk-footnote{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--rnk-muted);margin:0;padding:0 2px;line-height:1.6}

/* ---------- modal (dark) ---------- */
.rnk-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
.rnk-backdrop{position:absolute;inset:0;background:rgba(3,4,8,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.rnk-dialog{
  position:relative;z-index:1;width:100%;max-width:520px;max-height:calc(100vh - 32px);
  overflow-y:auto;
  border-radius:22px;border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(158deg, #14161F 0%, #0C0E14 100%);
  box-shadow:0 30px 90px rgba(0,0,0,.6);
  padding:clamp(16px,2.4vw,24px);
  color:#F3F5F9;
  animation:rnk-pop .26s cubic-bezier(.22,1,.36,1);
}
@keyframes rnk-pop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.rnk-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}
.rnk-field{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
.rnk-label{font-size:12.5px;font-weight:700;color:#A8B0C0}
.rnk-input{
  width:100%;border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.045);
  padding:11px 14px;font-size:14px;color:#F3F5F9;outline:none;
  transition:border-color .18s ease,box-shadow .18s ease;
}
.rnk-input::placeholder{color:#6F7889}
.rnk-input:focus{border-color:rgba(168,85,247,.55);box-shadow:0 0 0 3px rgba(168,85,247,.14)}
.rnk-pills{display:flex;gap:8px;flex-wrap:wrap}
.rnk-pill{
  padding:7px 14px;border-radius:999px;cursor:pointer;
  border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);
  color:#A8B0C0;font-size:12.5px;font-weight:700;
  transition:background .18s ease,color .18s ease,border-color .18s ease;
}
.rnk-pill:hover{color:#F3F5F9;background:rgba(255,255,255,.08)}
.rnk-pill-on{background:rgba(139,92,246,.2);border-color:rgba(139,92,246,.45);color:#C4B5FD}
.rnk-dialog-foot{display:flex;align-items:center;justify-content:flex-end;gap:9px;margin-top:20px}
.rnk-grid-form{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}

/* ---------- responsivo ---------- */
@media(max-width:1023px){
  .rnk-hero{grid-template-columns:1fr}
  .rnk-grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rnk-grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rnk-streak{grid-template-columns:1fr}
  .rnk-pp{grid-template-columns:1fr}
}
@media(max-width:820px){
  .rnk-sum{grid-template-columns:1fr}
  .rnk-podium{grid-template-columns:1fr;align-items:stretch}
  .rnk-pod-1{padding:16px 14px}
  .rnk-grid-2{grid-template-columns:1fr}
}
@media(max-width:640px){
  .rnk-grid-form{grid-template-columns:1fr}
  .rnk-wrap{border-radius:20px;padding:13px}
  .rnk-grid-3,.rnk-grid-4{grid-template-columns:1fr}
  .rnk-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rnk-pp-stats{grid-template-columns:1fr}
  .rnk-tab{padding:8px 12px;font-size:12.5px}
  .rnk-hero-l{gap:14px}
  .rnk-mgrid{grid-template-columns:1fr}
  .rnk-ladder{grid-template-columns:1fr}
  .rnk-next{gap:13px}
}
@media(prefers-reduced-motion:reduce){
  .rnk-wrap *{transition:none !important;animation:none !important}
}
`;

// ------------------------------------------------------------
// Componente principal
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

  function applyPayload(full: RankInitialData) {
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
      if (reload.ok) applyPayload(full);
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
      applyPayload(full);
    } catch {
      // silencioso — UI já tem dados
    }
  }

  return (
    <div className="rnk-wrap">
      {/* dangerouslySetInnerHTML é OBRIGATÓRIO aqui: com children normais o
          React escaparia `>` (combinador filho) e `"` (content:"") do CSS,
          quebrando as regras. */}
      <style dangerouslySetInnerHTML={{ __html: RANK_CSS }} />

      <div className="rnk-stack">
        {/* Título da página — dentro da superfície dark para manter a
            hierarquia coesa (o h1 permanece semântico para acessibilidade). */}
        <div className="rnk-pagehead">
          <h1 className="rnk-pagehead-title">
            <span className="rnk-pagehead-ic" aria-hidden="true">
              <Trophy size={20} />
            </span>
            Rank
          </h1>
          <p className="rnk-pagehead-sub">
            Progressão por XP, metas estratégicas, conquistas e sua posição no ranking. Tudo
            derivado de ações reais — nunca inventado.
          </p>
        </div>

        {/* Hero — nível + posição */}
        <RankHero
          progress={progress}
          summary={summary}
          checking={checking}
          onCheck={checkAchievements}
        />

        {/* Abas */}
        <div className="rnk-tabs" role="tablist" aria-label="Seções do Rank">
          {[
            { id: "visao-geral", label: "Visão geral", icon: BarChart3 },
            { id: "perfil-publico", label: "Perfil público", icon: Globe },
            { id: "ranking", label: "Ranking", icon: Trophy },
            { id: "metas", label: "Metas", icon: Target },
            { id: "conquistas", label: "Conquistas", icon: Award },
            { id: "historico", label: "Histórico de XP", icon: History },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className="rnk-tab"
              onClick={() => setTab(t.id)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "visao-geral" && (
          <VisaoGeral
            progress={progress}
            evolution={evolution}
            unlockedCount={unlockedCount}
            visibleCount={visibleCount}
            totalCount={totalCount}
            achievements={achievements}
            social={social}
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

        {tab === "ranking" && <RankingView entries={ranking} me={summary} />}

        {tab === "metas" && (
          <MetasView
            goals={goals}
            momentum={momentum}
            achievements={achievements}
            unlockedCount={unlockedCount}
            visibleCount={visibleCount}
            onChanged={reloadAll}
            toast={toast}
            onOpenCreate={() => setGoalModalOpen(true)}
            onGoToAchievements={() => setTab("conquistas")}
          />
        )}

        {tab === "conquistas" && (
          <ConquistasView
            achievements={achievements}
            onlyVisible={onlyVisible}
            onToggleVisible={() => setOnlyVisible((v) => !v)}
            unlockedCount={unlockedCount}
            visibleCount={visibleCount}
            totalCount={totalCount}
            unlockedPct={unlockedPct}
            onCheck={checkAchievements}
            checking={checking}
          />
        )}

        {tab === "historico" && <HistoricoView xpLogs={xpLogs} />}
      </div>

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
// Hero
// ------------------------------------------------------------

function RankHero({
  progress,
  summary,
  checking,
  onCheck,
}: {
  progress: ProgressData;
  summary: SummaryData;
  checking: boolean;
  onCheck: () => void;
}) {
  const pct = Math.round(progress.progressToNext);
  const remaining = Math.max(0, progress.xpNeededForNext - progress.xpInLevel);

  return (
    <div className="rnk-card rnk-hero">
      <div className="rnk-hero-l">
        <RnkRing
          value={progress.progressToNext}
          label={
            <>
              <span className="rnk-ring-val">{pct}%</span>
              <span className="rnk-ring-cap">do nível</span>
            </>
          }
        />
        <div className="rnk-hero-info">
          <span className="rnk-eyebrow">Seu progresso</span>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className="rnk-chip rnk-chip-brand">
              <Star size={11} /> Nível {progress.level}
            </span>
            <span className="rnk-chip">{formatXp(progress.xp)} XP totais</span>
            <span className="rnk-chip rnk-chip-green">
              <Zap size={11} /> {formatXp(progress.totalXpEarned)} XP acumulados
            </span>
          </div>
          <h2 className="rnk-hero-title">
            {formatXp(progress.xpInLevel)} de {formatXp(progress.xpNeededForNext)} XP para o nível{" "}
            {progress.level + 1}
          </h2>
          <p className="rnk-hero-sub">
            {remaining > 0
              ? `Faltam ${formatXp(remaining)} XP. Cada ação real no app concede XP uma única vez.`
              : "Você está a um passo do próximo nível. Continue as ações recomendadas."}
          </p>
        </div>
      </div>

      <div className="rnk-hero-r">
        <span className="rnk-eyebrow">Posição no ranking</span>
        <div className="rnk-pos">
          <Medal size={22} style={{ color: "#C4B5FD" }} />
          <span className="rnk-pos-val">
            {summary.position !== null ? `#${summary.position}` : "—"}
          </span>
          <span className="rnk-pos-cap">
            de {summary.totalUsers} {summary.totalUsers === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        <p className="rnk-hero-sub">
          O ranking é calculado pelo XP acumulado em ações reais registradas.
        </p>
        <RnkBtn variant="outline" size="sm" onClick={onCheck} disabled={checking}>
          {checking ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {checking ? "Verificando..." : "Verificar conquistas"}
        </RnkBtn>
      </div>
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
  totalCount,
  achievements,
  social,
  displayName,
  onDisplayNameChange,
  toast,
}: {
  progress: ProgressData;
  evolution: EvolutionPoint[];
  unlockedCount: number;
  visibleCount: number;
  totalCount: number;
  achievements: AchievementData[];
  social: RankSocialData | null;
  displayName: DisplayNameData | null;
  onDisplayNameChange: (info: DisplayNameData) => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
}) {
  return (
    <div className="rnk-stack">
      <SocialSummaryStrip
        social={social}
        unlockedCount={unlockedCount}
        visibleCount={visibleCount}
      />

      <ProximaMeta progress={progress} />

      <RanksProximos progress={progress} />

      <MeusDestaques
        progress={progress}
        achievements={achievements}
        unlockedCount={unlockedCount}
        totalCount={totalCount}
      />

      <div className="rnk-card">
        <RnkSectionHead
          icon={TrendingUp}
          title="Evolução do seu XP"
          hint="Acúmulo de XP ao longo do tempo. Cada ponto é uma ação real registrada."
        />
        <div style={{ marginTop: 16 }}>
          {evolution.length === 0 ? (
            <div className="rnk-chart-empty">
              <p className="rnk-empty-text" style={{ margin: 0 }}>
                Ainda não há XP registrado — faça ações no app para começar a acumular.
              </p>
            </div>
          ) : (
            <EvolutionSvg points={evolution} />
          )}
        </div>
      </div>

      <DisplayNameCard
        displayName={displayName}
        onDisplayNameChange={onDisplayNameChange}
        toast={toast}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Próxima meta — card horizontal
// ------------------------------------------------------------

function ProximaMeta({ progress }: { progress: ProgressData }) {
  const pct = Math.round(progress.progressToNext);
  const remaining = Math.max(0, progress.xpNeededForNext - progress.xpInLevel);
  const nextLevelTotal = xpRequiredForLevelLocal(progress.level + 1);

  return (
    <div className="rnk-next">
      <div className="rnk-next-l">
        <span className="rnk-next-ic" aria-hidden="true">
          <Target size={20} />
        </span>
        <div>
          <span className="rnk-eyebrow">Próxima meta</span>
          <p className="rnk-next-val">
            {remaining > 0 ? `Faltam ${formatXp(remaining)} XP` : "Nível alcançado"}
          </p>
          <p className="rnk-next-sub">
            Para chegar ao <b style={{ color: "#F3F5F9" }}>Nível {progress.level + 1}</b>
          </p>
        </div>
      </div>

      <div className="rnk-next-mid">
        <div className="rnk-next-meta">
          <span>
            {formatXp(progress.xpInLevel)} / {formatXp(progress.xpNeededForNext)} XP
          </span>
          <span className="rnk-num">{pct}%</span>
        </div>
        <RnkBar value={progress.progressToNext} tone="brand" />
      </div>

      <div className="rnk-next-r">
        <span className="rnk-chip rnk-chip-outline">
          <Flag size={11} /> Exigido: {formatXp(nextLevelTotal)} XP
        </span>
        <span className="rnk-chip rnk-chip-green">
          <Trophy size={11} /> Recompensa: Nível {progress.level + 1}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Ranks próximos — escada de níveis (dados reais da curva de XP)
// ------------------------------------------------------------

const LADDER_AHEAD = 4;

function RanksProximos({ progress }: { progress: ProgressData }) {
  // Nível atual + os próximos. Os alvos são derivados da curva real
  // (`xpToNextLevel(level) = 100 + (level - 1) * 25`) — nada é inventado.
  const levels = React.useMemo(() => {
    const list: {
      level: number;
      isNow: boolean;
      requiredToReach: number;
      remaining: number;
      stepXp: number;
    }[] = [];
    for (let i = 0; i <= LADDER_AHEAD; i++) {
      const level = progress.level + i;
      const requiredToReach = xpRequiredForLevelLocal(level);
      list.push({
        level,
        isNow: i === 0,
        requiredToReach,
        remaining: Math.max(0, requiredToReach - progress.xp),
        stepXp: xpToNextLevelLocal(level),
      });
    }
    return list;
  }, [progress.level, progress.xp]);

  const totalReach = levels[levels.length - 1]?.remaining ?? 0;

  return (
    <div className="rnk-card">
      <RnkSectionHead
        icon={Trophy}
        title="Ranks próximos"
        hint={
          totalReach > 0
            ? `Faltam ${formatXp(totalReach)} XP para alcançar o Nível ${levels[levels.length - 1]?.level}.`
            : "Você já alcançou os próximos níveis desta faixa."
        }
      />
      <div className="rnk-ladder" style={{ marginTop: 14 }}>
        {levels.map((l) => {
          if (l.isNow) {
            return (
              <div key={l.level} className="rnk-lvl rnk-lvl-now">
                <div className="rnk-lvl-top">
                  <span className="rnk-lvl-n rnk-lvl-n-lg">{l.level}</span>
                  <span className="rnk-lvl-badge" aria-hidden="true">
                    <Star size={15} />
                  </span>
                </div>
                <span className="rnk-lvl-label">Nível atual</span>
                <p className="rnk-lvl-req">
                  <b>
                    {formatXp(progress.xpInLevel)} / {formatXp(progress.xpNeededForNext)}
                  </b>{" "}
                  XP no nível
                </p>
                <div className="rnk-lvl-foot">
                  <span className="rnk-chip rnk-chip-brand">Atual</span>
                  <span className="rnk-chip rnk-chip-green rnk-num">
                    {Math.round(progress.progressToNext)}%
                  </span>
                </div>
                <RnkBar value={progress.progressToNext} tone="brand" size="sm" />
              </div>
            );
          }
          return (
            <div key={l.level} className="rnk-lvl">
              <div className="rnk-lvl-top">
                <span className="rnk-lvl-n">{l.level}</span>
                <span className="rnk-lvl-badge" aria-hidden="true">
                  {l.level === levels[levels.length - 1].level ? (
                    <Crown size={15} />
                  ) : (
                    <Medal size={15} />
                  )}
                </span>
              </div>
              <span className="rnk-lvl-label">Nível {l.level}</span>
              <p className="rnk-lvl-req">
                XP exigido: <b>{formatXp(l.requiredToReach)}</b>
              </p>
              <div className="rnk-lvl-foot">
                <span className="rnk-chip rnk-chip-outline">
                  <Minus size={11} /> Faltam {formatXp(l.remaining)} XP
                </span>
              </div>
              <RnkBar value={Math.min(100, (progress.xp / Math.max(1, l.requiredToReach)) * 100)} tone="muted" size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Meus destaques
// ------------------------------------------------------------

function MeusDestaques({
  progress,
  achievements,
  unlockedCount,
  totalCount,
}: {
  progress: ProgressData;
  achievements: AchievementData[];
  unlockedCount: number;
  totalCount: number;
}) {
  const badge = bestAchievement(achievements, false);
  const trophy = bestAchievement(achievements, true);

  const valorVazio = <span className="rnk-dash">—</span>;

  return (
    <div className="rnk-card">
      <RnkSectionHead
        icon={Sparkles}
        title="Meus destaques"
        hint="Suas honrarias e números reais de evolução."
      />
      <div className="rnk-grid-4" style={{ marginTop: 14 }}>
        {/* Melhor badge */}
        <div className="rnk-hl">
          <span className="rnk-hl-ic" aria-hidden="true">
            <Crown size={16} />
          </span>
          <div className="rnk-hl-body">
            <span className="rnk-hl-label">Melhor badge</span>
            {badge ? (
              <>
                <span className="rnk-hl-val-sm">{badge.title}</span>
                <span className={tierCardClass(badge.tier)}>
                  <TierIcon tier={badge.tier} size={11} />
                  {TIER_LABEL[badge.tier] ?? badge.tier}
                </span>
              </>
            ) : (
              <>
                <span className="rnk-hl-val">{valorVazio}</span>
                <span className="rnk-hl-sub">Nenhuma ainda</span>
              </>
            )}
          </div>
        </div>

        {/* Melhor troféu */}
        <div className="rnk-hl">
          <span className="rnk-hl-ic" aria-hidden="true">
            <Trophy size={16} />
          </span>
          <div className="rnk-hl-body">
            <span className="rnk-hl-label">Melhor troféu</span>
            {trophy ? (
              <>
                <span className="rnk-hl-val-sm">{trophy.title}</span>
                <span className={tierCardClass(trophy.tier)}>
                  <TierIcon tier={trophy.tier} size={11} />
                  {TIER_LABEL[trophy.tier] ?? trophy.tier}
                </span>
              </>
            ) : (
              <>
                <span className="rnk-hl-val">{valorVazio}</span>
                <span className="rnk-hl-sub">Nenhuma ainda</span>
              </>
            )}
          </div>
        </div>

        {/* XP total */}
        <div className="rnk-hl">
          <span className="rnk-hl-ic" aria-hidden="true">
            <Zap size={16} />
          </span>
          <div className="rnk-hl-body">
            <span className="rnk-hl-label">XP total</span>
            <span className="rnk-hl-val">{formatXp(progress.xp)}</span>
            <span className="rnk-hl-sub">
              Nível {progress.level} · {formatXp(progress.totalXpEarned)} acumulados
            </span>
          </div>
        </div>

        {/* Conquistas desbloqueadas */}
        <div className="rnk-hl">
          <span className="rnk-hl-ic" aria-hidden="true">
            <Award size={16} />
          </span>
          <div className="rnk-hl-body">
            <span className="rnk-hl-label">Conquistas</span>
            {unlockedCount > 0 ? (
              <span className="rnk-hl-val">{unlockedCount}</span>
            ) : (
              <span className="rnk-hl-val">{valorVazio}</span>
            )}
            <span className="rnk-hl-sub">
              {unlockedCount > 0
                ? `de ${totalCount} disponíveis`
                : "Nenhuma ainda"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Resumo social no topo — 4 métricas reais
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
  const followers = social?.followers != null ? formatCount(social.followers) : null;
  const growth = social?.growth30d != null ? formatSigned(social.growth30d) : null;
  const instagram = social?.instagramConnected
    ? social.instagramUsername
      ? `@${social.instagramUsername}`
      : "Conectado"
    : null;

  const items: { label: string; value: string | null; hint: string; icon: LucideIcon; ok: boolean }[] = [
    {
      label: "Seguidores",
      value: followers,
      hint: "Instagram · mais recente",
      icon: Users,
      ok: followers !== null,
    },
    {
      label: "Crescimento",
      value: growth,
      hint: "nos últimos 30 dias",
      icon: TrendingUp,
      ok: growth !== null,
    },
    {
      label: "Instagram",
      value: instagram,
      hint: social?.instagramConnected ? "conta conectada" : "conecte sua conta para exibir",
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
    <div className="rnk-strip">
      {items.map((it) => (
        <div key={it.label} className="rnk-strip-item">
          <div className="rnk-strip-top">
            <span className={cn("rnk-strip-ic", it.ok && "rnk-strip-ic-ok")} aria-hidden="true">
              <it.icon size={14} />
            </span>
            <span className="rnk-strip-label">{it.label}</span>
          </div>
          <p className={cn("rnk-strip-val", it.value === null && "rnk-strip-val-empty")}>
            {it.value ?? "—"}
          </p>
          <p className="rnk-strip-hint">{it.hint}</p>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Nome exibido
// ------------------------------------------------------------

function DisplayNameCard({
  displayName,
  onDisplayNameChange,
  toast,
}: {
  displayName: DisplayNameData | null;
  onDisplayNameChange: (info: DisplayNameData) => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
}) {
  const [savingName, setSavingName] = React.useState(false);

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
    <div className="rnk-card">
      <RnkSectionHead
        icon={UserCog}
        title="Como você aparece no Rank"
        hint="Escolha qual nome é exibido publicamente no ranking e no seu perfil público."
      />
      <div className="rnk-grid-2" style={{ marginTop: 14 }}>
        <div>
          <p className="rnk-eyebrow" style={{ marginBottom: 6 }}>
            Nome exibido
          </p>
          <p style={{ fontFamily: "var(--font-display,inherit)", fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>
            {displayName?.value ?? "Usuário"}
          </p>
          {displayName?.source === "instagram" && displayName?.storedSource === "instagram" ? (
            <p className="rnk-hint" style={{ marginTop: 6 }}>
              Usando o nome da conta Instagram conectada.
            </p>
          ) : displayName?.storedSource === "instagram" && !displayName?.hasInstagram ? (
            <p className="rnk-hint" style={{ marginTop: 6 }}>
              Conta Instagram indisponível — mostrando o nome do perfil.
            </p>
          ) : (
            <p className="rnk-hint" style={{ marginTop: 6 }}>
              Usando o nome do perfil do Inst Acessor.
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={() => changeSource("profile")}
            disabled={savingName}
            className={cn("rnk-btn rnk-btn-md", displayName?.storedSource === "profile" ? "rnk-btn-success" : "rnk-btn-outline")}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                border: "2px solid currentColor",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}
            >
              {displayName?.source === "profile" && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
              )}
            </span>
            Nome do perfil
          </button>

          <button
            type="button"
            onClick={() => changeSource("instagram")}
            disabled={savingName || !displayName?.hasInstagram}
            title={!displayName?.hasInstagram ? "Conecte uma conta Instagram para usar esta opção" : undefined}
            className={cn("rnk-btn rnk-btn-md", displayName?.storedSource === "instagram" ? "rnk-btn-success" : "rnk-btn-outline")}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                border: "2px solid currentColor",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}
            >
              {displayName?.source === "instagram" && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
              )}
            </span>
            Nome da conta Instagram
            {!displayName?.hasInstagram && (
              <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.75 }}>sem conta</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Perfil Público
// ------------------------------------------------------------

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

  const stats: { label: string; value: string | null; icon: LucideIcon }[] = [
    {
      label: "Seguidores",
      value: social?.followers != null ? formatCount(social.followers) : null,
      icon: Users,
    },
    {
      label: "Crescimento (30d)",
      value: social?.growth30d != null ? formatSigned(social.growth30d) : null,
      icon: TrendingUp,
    },
    {
      label: "Instagram",
      value: ig ? `@${ig}` : null,
      icon: Instagram,
    },
    {
      label: "Conquistas",
      value: unlockedCount > 0 ? `${unlockedCount}/${totalCount}` : null,
      icon: Award,
    },
  ];

  return (
    <div className="rnk-pp">
      {/* Card principal — como o perfil aparece publicamente */}
      <div className="rnk-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="rnk-pp-head">
          <RnkAvatar name={name} src={profilePublic?.image ?? null} size={58} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <h3 className="rnk-h2" style={{ fontSize: 19 }}>
              {name}
            </h3>
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: ig ? "#C4B5FD" : "#6F7889",
                margin: 0,
              }}
            >
              {ig ? (
                <>
                  <Instagram size={13} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>@{ig}</span>
                </>
              ) : (
                "Instagram não conectado"
              )}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              <span className="rnk-chip rnk-chip-brand">
                <Star size={11} /> Nível {progress.level}
              </span>
              <span className="rnk-chip">{formatXp(progress.xp)} XP</span>
              <span className="rnk-chip">
                <Trophy size={11} /> Rank {pos}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "rgba(255,255,255,.032)",
            border: "1px solid rgba(255,255,255,.085)",
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <span className="rnk-eyebrow">Progresso para o nível {progress.level + 1}</span>
          <RnkBar value={progress.progressToNext} tone="brand" />
          <p className="rnk-hint" style={{ margin: 0 }}>
            {formatXp(progress.xpInLevel)} / {formatXp(progress.xpNeededForNext)} XP ·{" "}
            {Math.round(progress.progressToNext)}%
          </p>
        </div>

        <div className="rnk-pp-stats">
          {stats.map((s) => (
            <div key={s.label} className="rnk-pp-stat">
              <span className="rnk-pp-stat-label">
                <s.icon size={13} style={{ color: "#C4B5FD" }} />
                {s.label}
              </span>
              <p className={cn("rnk-pp-stat-val", s.value === null && "rnk-pp-stat-val-empty")}>
                {s.value ?? "—"}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <RnkBtn
            size="sm"
            disabled={!publicProfileUrl}
            onClick={() => publicProfileUrl && onCopyLink(publicProfileUrl)}
          >
            <CopyIcon size={15} /> Copiar link do perfil
          </RnkBtn>
          <RnkBtn variant="outline" size="sm" onClick={onShare}>
            <Share2 size={15} /> Compartilhar evolução
          </RnkBtn>
        </div>
        {!publicProfileUrl && (
          <p className="rnk-hint" style={{ margin: 0 }}>
            Defina um nome de usuário no Perfil para gerar o link público.
          </p>
        )}
      </div>

      {/* Honrarias reais */}
      <div className="rnk-stack" style={{ gap: 16 }}>
        <div className="rnk-card">
          <RnkSectionHead icon={Crown} title="Melhor badge" />
          <div style={{ marginTop: 12 }}>
            {badge ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={cn("rnk-ach-ic rnk-ach-ic-on")} aria-hidden="true">
                  <TierIcon tier={badge.tier} size={17} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>{badge.title}</span>
                  <span className={tierCardClass(badge.tier)}>
                    <TierIcon tier={badge.tier} size={11} />
                    {TIER_LABEL[badge.tier] ?? badge.tier}
                  </span>
                </div>
              </div>
            ) : (
              <p className="rnk-empty-title" style={{ margin: 0 }}>
                <span className="rnk-dash">—</span> Nenhuma ainda
              </p>
            )}
          </div>
        </div>

        <div className="rnk-card">
          <RnkSectionHead icon={Sparkles} title="Melhor troféu" />
          <div style={{ marginTop: 12 }}>
            {trophy ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={cn("rnk-ach-ic rnk-ach-ic-on")} aria-hidden="true">
                  <TierIcon tier={trophy.tier} size={17} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>{trophy.title}</span>
                  <span className={tierCardClass(trophy.tier)}>
                    <TierIcon tier={trophy.tier} size={11} />
                    {TIER_LABEL[trophy.tier] ?? trophy.tier}
                  </span>
                </div>
              </div>
            ) : (
              <p className="rnk-empty-title" style={{ margin: 0 }}>
                <span className="rnk-dash">—</span> Nenhuma ainda
              </p>
            )}
          </div>
        </div>

        <div className="rnk-card">
          <RnkSectionHead icon={Globe} title="Link público" />
          <div style={{ marginTop: 10 }}>
            {publicProfileUrl ? (
              <p className="rnk-link">{publicProfileUrl}</p>
            ) : (
              <p className="rnk-hint" style={{ margin: 0 }}>
                Seu perfil público fica em{" "}
                <span style={{ fontWeight: 700, color: "#A8B0C0" }}>/p/[usuário]</span>. Conecte o
                Instagram ou defina um nome de usuário para ativar.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Gráfico de evolução (SVG)
// ------------------------------------------------------------

function EvolutionSvg({ points }: { points: EvolutionPoint[] }) {
  const values = points.map((p) => p.xp);
  const W = 720;
  const H = 210;
  const PAD = { top: 18, right: 16, bottom: 26, left: 46 };

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
  const areaPath =
    values.length === 1
      ? `${linePath} L${x(0).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`
      : `${linePath} L${x(values.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolução do XP">
      <defs>
        <linearGradient id="xpArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="xpLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F43F8E" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => {
        const gy = y(tick);
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={gy}
              y2={gy}
              stroke="rgba(255,255,255,.075)"
              strokeDasharray="4 4"
            />
            <text x={PAD.left - 8} y={gy + 3} textAnchor="end" fontSize="10.5" fill="#6F7889">
              {tick === 0 ? "0" : formatXp(tick)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#xpArea)" />
      <path
        d={linePath}
        fill="none"
        stroke="url(#xpLine)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {values.length === 1 ? (
        <circle cx={x(0)} cy={y(values[0])} r="5" fill="#F43F8E" stroke="#0A0B10" strokeWidth="2" />
      ) : (
        <>
          <circle cx={x(0)} cy={y(values[0])} r="4" fill="#0A0B10" stroke="#A855F7" strokeWidth="2" />
          <circle
            cx={x(values.length - 1)}
            cy={y(values[values.length - 1])}
            r="4.5"
            fill="#F43F8E"
            stroke="#0A0B10"
            strokeWidth="2"
          />
        </>
      )}

      {values.length === 1 ? (
        <text x={x(0)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#6F7889">
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
            fill="#6F7889"
          >
            {shortDate(points[i]?.label)}
          </text>
        ))
      )}
    </svg>
  );
}

// ------------------------------------------------------------
// Ranking
// ------------------------------------------------------------

function RankingView({ entries, me }: { entries: RankingEntry[]; me: SummaryData }) {
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="rnk-stack">
      {podium.length > 0 && (
        <div className="rnk-card">
          <RnkSectionHead
            icon={Crown}
            title={entries.length === 1 ? "Ranking" : "Pódio"}
            hint={
              entries.length === 1
                ? "Ainda não há outros usuários ranqueados — por isso você é o único listado."
                : "Os três maiores acumuladores de XP em ações reais."
            }
          />
          <div className="rnk-podium" style={{ marginTop: 16 }}>
            {[podium[1], podium[0], podium[2]]
              .filter((e): e is RankingEntry => Boolean(e))
              .map((e) => (
                <div
                  key={e.userId}
                  className={cn(
                    "rnk-pod",
                    e.position === 1 && "rnk-pod-1",
                    e.position === 2 && "rnk-pod-2",
                    e.position === 3 && "rnk-pod-3",
                    e.isMe && "rnk-pod-me"
                  )}
                >
                  <span className="rnk-pod-crown" aria-hidden="true">
                    {e.position === 1 ? <Crown size={18} /> : <Medal size={18} />}
                  </span>
                  <RnkAvatar name={e.name ?? "Usuário"} size={e.position === 1 ? 54 : 46} />
                  <p className="rnk-pod-name">{e.name ?? "Usuário"}</p>
                  <span className="rnk-chip rnk-chip-outline rnk-num">#{e.position}</span>
                  <span className="rnk-pod-xp">{formatXp(e.xp)} XP</span>
                  <span className="rnk-pod-meta">Nível {e.level}</span>
                  {e.isMe && <span className="rnk-chip rnk-you">Você</span>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Lista completa */}
      <div className="rnk-card rnk-card-flush">
        {entries.length === 0 ? (
          <div style={{ padding: "clamp(14px,2vw,22px)" }}>
            <RnkEmpty
              icon={Trophy}
              title="Ranking vazio"
              text="Quando outros usuários acumularem XP, o ranking aparece aqui."
            />
          </div>
        ) : (
          <div className="rnk-rows">
            {entries.map((e) => (
              <div key={e.userId} className={cn("rnk-row", e.isMe && "rnk-row-me")}>
                <span className="rnk-row-pos">{e.position}</span>
                <RnkAvatar name={e.name ?? "Usuário"} size={34} />
                <div className="rnk-row-body">
                  <p className="rnk-row-name">{e.name ?? "Usuário"}</p>
                  <span className="rnk-row-meta">Nível {e.level}</span>
                </div>
                <span className="rnk-row-xp">{formatXp(e.xp)} XP</span>
                {e.isMe && <span className="rnk-chip rnk-you">Você</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="rnk-footnote">
        <Trophy size={14} style={{ flex: "none", marginTop: 2, color: "#C4B5FD" }} />
        Posição atual:{" "}
        <b style={{ color: "#A8B0C0" }}>
          {me.position !== null ? `#${me.position}` : "fora do ranking"}
        </b>{" "}
        de {me.totalUsers} {me.totalUsers === 1 ? "usuário" : "usuários"}. O ranking é calculado
        pelo XP acumulado em ações reais.
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// Metas
// ------------------------------------------------------------

function MetasView({
  goals,
  momentum,
  achievements,
  unlockedCount,
  visibleCount,
  onChanged,
  toast,
  onOpenCreate,
  onGoToAchievements,
}: {
  goals: GoalData[];
  momentum: MomentumData | null;
  achievements: AchievementData[];
  unlockedCount: number;
  visibleCount: number;
  onChanged: () => void;
  toast: (m: string, t?: "success" | "error" | "warning" | "info") => void;
  onOpenCreate: () => void;
  onGoToAchievements: () => void;
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
    <div className="rnk-stack">
      {/* Cabeçalho */}
      <div className="rnk-card" style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div className="rnk-shead">
          <h2 className="rnk-h2">Metas</h2>
          <p className="rnk-hint">Metas diárias, semanais e mensais para evoluir.</p>
        </div>
        <RnkBtn onClick={onOpenCreate}>
          <Plus size={16} /> Nova meta
        </RnkBtn>
      </div>

      {/* Resumo: meta atual / próxima recompensa / tempo restante */}
      <ResumoMetas momentum={momentum} />

      {/* Containers por período */}
      {momentum ? (
        <GruposPorPeriodo momentum={momentum} />
      ) : (
        <div className="rnk-card">
          <RnkEmpty
            icon={Target}
            title="Metas prontas indisponíveis"
            text="Conecte suas redes para o Inst Acessor acompanhar as metas diárias, semanais e mensais com dados reais."
          />
        </div>
      )}

      {/* Sequência de metas */}
      {momentum && <SequenciaMetas momentum={momentum} />}

      {/* Metas estratégicas (criadas por você) */}
      <MetasEstrategicas
        active={active}
        done={done}
        cancelled={cancelled}
        total={goals.length}
        onOpenCreate={onOpenCreate}
        onUpdateStatus={updateStatus}
        onRemove={remove}
      />

      {/* Conquistas integradas */}
      <ConquistasResumo
        achievements={achievements}
        unlockedCount={unlockedCount}
        visibleCount={visibleCount}
        onGoToAchievements={onGoToAchievements}
      />
    </div>
  );
}

// ---------- resumo (3 cartões) ----------

function ResumoMetas({ momentum }: { momentum: MomentumData | null }) {
  const disponiveis = momentum ? momentum.cards.filter((c) => c.available) : [];
  const pendentes = disponiveis.filter((c) => c.status === "pendente");

  // META ATUAL = meta pendente mais próxima de concluir (dado real do motor).
  const metaAtual = React.useMemo(() => {
    if (pendentes.length === 0) return null;
    return [...pendentes].sort((a, b) => b.progressPercent - a.progressPercent)[0];
  }, [pendentes]);

  // PRÓXIMA RECOMPENSA = próximo marco de sequência real (3/7/15/30 → XP).
  const proximoMarco = React.useMemo(() => {
    if (!momentum) return null;
    return STREAK_MILESTONES.find((m) => m.day > momentum.streakDays) ?? null;
  }, [momentum]);

  // TEMPO RESTANTE = rótulo real calculado pelo motor (`remainingLabel`).
  const tempoRestante = metaAtual?.remainingLabel ?? pendentes[0]?.remainingLabel ?? null;

  const metaValor = metaAtual
    ? metaAtual.isPercent
      ? `${metaAtual.current}% / +${metaAtual.target}%`
      : `${metaAtual.current} / ${metaAtual.target} ${metaAtual.unit}`
    : null;

  return (
    <div className="rnk-sum">
      <div className="rnk-sum-item">
        <span className="rnk-sum-label">Meta atual</span>
        {metaAtual ? (
          <>
            <span className="rnk-sum-val">{metaAtual.title}</span>
            <span className="rnk-sum-sub">
              {metaValor} · {Math.round(metaAtual.progressPercent)}% concluído
            </span>
          </>
        ) : (
          <>
            <span className="rnk-sum-val rnk-dash">—</span>
            <span className="rnk-sum-sub">
              {disponiveis.length === 0
                ? "Sem dados disponíveis para montar a meta atual."
                : "Todas as metas disponíveis já foram batidas."}
            </span>
          </>
        )}
      </div>

      <div className="rnk-sum-item">
        <span className="rnk-sum-label">Próxima recompensa</span>
        {proximoMarco ? (
          <>
            <span className="rnk-sum-val rnk-sum-val-sm" style={{ color: "#34D399" }}>
              +{proximoMarco.xp} XP
            </span>
            <span className="rnk-sum-sub">
              ao completar {proximoMarco.day} dias de sequência ·{" "}
              {momentum ? `${momentum.streakDays} ${momentum.streakDays === 1 ? "dia" : "dias"} hoje` : "—"}
            </span>
          </>
        ) : (
          <>
            <span className="rnk-sum-val rnk-sum-val-sm" style={{ color: "#34D399" }}>
              Sequência máxima
            </span>
            <span className="rnk-sum-sub">
              Você concluiu todos os marcos do ciclo. Mantenha o ritmo para não perder a sequência.
            </span>
          </>
        )}
      </div>

      <div className="rnk-sum-item">
        <span className="rnk-sum-label">Tempo restante</span>
        {tempoRestante ? (
          <>
            <span className="rnk-sum-val rnk-sum-val-sm" style={{ color: "#FBBF24" }}>
              {tempoRestante}
            </span>
            <span className="rnk-sum-sub">
              janela da meta {metaAtual ? PERIOD_LABEL[metaAtual.period].toLowerCase() : "em andamento"}
            </span>
          </>
        ) : (
          <>
            <span className="rnk-sum-val rnk-dash">—</span>
            <span className="rnk-sum-sub">Nenhuma janela de meta em andamento.</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- grupos por período ----------

function GruposPorPeriodo({ momentum }: { momentum: MomentumData }) {
  const grouped = React.useMemo(() => {
    const g: Record<string, RitmoCardData[]> = { dia: [], semana: [], mes: [] };
    for (const c of momentum.cards) {
      if (g[c.period]) g[c.period].push(c);
    }
    return g;
  }, [momentum.cards]);

  const periodos: ("dia" | "semana" | "mes")[] = ["dia", "semana", "mes"];

  return (
    <>
      {periodos.map((period) => {
        const cards = grouped[period];
        if (!cards || cards.length === 0) return null;
        const concluidas = cards.filter((c) => c.status === "concluida").length;
        const totalXp = cards.reduce((s, c) => s + (c.granted ? 0 : c.xpReward), 0);
        const allDone = concluidas === cards.length;

        return (
          <div key={period} className="rnk-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <RnkSectionHead
                icon={Target}
                title={PERIOD_LABEL[period]}
                hint={`${PERIOD_LABEL_PLURAL[period]} acompanhadas com dados reais das suas redes.`}
              />
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <span className={cn("rnk-chip", allDone && "rnk-chip-green")}>
                  {allDone && <Check size={11} />}
                  {concluidas}/{cards.length} concluídas
                </span>
                {totalXp > 0 && (
                  <span className="rnk-chip rnk-chip-outline">
                    <Zap size={11} /> até +{totalXp} XP
                  </span>
                )}
              </div>
            </div>

            <div className="rnk-mgrid" style={{ marginTop: 14 }}>
              {cards.map((c) => (
                <MetaRitmoCard key={c.id} card={c} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MetaRitmoCard({ card }: { card: RitmoCardData }) {
  const done = card.status === "concluida";
  const noData = card.status === "sem-dados";

  return (
    <div className={cn("rnk-meta", done && "rnk-meta-done", noData && "rnk-meta-off")}>
      <div className="rnk-meta-top">
        <div style={{ minWidth: 0 }}>
          <p className="rnk-meta-title">{card.title}</p>
          <p className="rnk-meta-sub">{card.subtitle}</p>
        </div>
        <span
          className={cn(
            "rnk-chip",
            done ? "rnk-chip-green" : noData ? "" : "rnk-chip-amber"
          )}
          style={{ flex: "none" }}
        >
          {done ? "Concluída" : noData ? "Sem dados" : "Em andamento"}
        </span>
      </div>

      <div className="rnk-meta-nums">
        <p className="rnk-meta-val">
          {card.available ? (
            card.isPercent ? (
              <>
                {card.current}%<span> / +{card.target}%</span>
              </>
            ) : (
              <>
                {card.current}
                <span>
                  {" "}
                  / {card.target} {card.unit}
                </span>
              </>
            )
          ) : (
            <span className="rnk-dash">—</span>
          )}
        </p>
        <span className="rnk-meta-xp">
          <Zap size={13} /> +{card.xpReward} XP
        </span>
      </div>

      <p className="rnk-hint" style={{ margin: 0 }}>
        {card.remainingLabel}
      </p>

      <RnkBar value={card.progressPercent} tone={done ? "green" : "brand"} size="sm" />
    </div>
  );
}

// ---------- sequência de metas ----------

function SequenciaMetas({ momentum }: { momentum: MomentumData }) {
  const next = STREAK_MILESTONES.find((m) => m.day > momentum.streakDays) ?? null;
  const target = next?.day ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1].day;
  const pct = Math.min(100, Math.round((momentum.streakDays / Math.max(1, target)) * 100));

  return (
    <div className="rnk-card">
      <RnkSectionHead
        icon={Flame}
        title="Sequência de metas"
        hint="Dias consecutivos batendo pelo menos uma meta diária. Marcos rendem XP extra."
      />

      <div className="rnk-streak" style={{ marginTop: 16 }}>
        <div>
          <p className="rnk-streak-num">
            {momentum.streakDays} <span>{momentum.streakDays === 1 ? "dia" : "dias"}</span>
          </p>
          <p className="rnk-hint" style={{ marginTop: 7 }}>
            {next
              ? `Faltam ${next.day - momentum.streakDays} ${
                  next.day - momentum.streakDays === 1 ? "dia" : "dias"
                } para o marco de ${next.day} dias (+${next.xp} XP).`
              : "Todos os marcos do ciclo foram concluídos — mantenha a sequência viva."}
          </p>
          <div style={{ marginTop: 10 }}>
            <RnkBar value={pct} tone="amber" />
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
            <span className="rnk-chip">
              Hoje: {momentum.todayXp} XP
            </span>
            {momentum.activeWeekStreak > 0 && (
              <span className="rnk-chip rnk-chip-brand">
                {momentum.activeWeekStreak}{" "}
                {momentum.activeWeekStreak === 1 ? "semana ativa" : "semanas ativas"}
              </span>
            )}
            {momentum.bonusXpGranted > 0 && (
              <span className="rnk-chip rnk-chip-green">
                <Check size={11} /> +{momentum.bonusXpGranted} XP em bônus
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="rnk-eyebrow">Marcos de sequência</span>
          <div className="rnk-miles" style={{ marginTop: 9 }}>
            {STREAK_MILESTONES.map((m) => {
              const reached = momentum.streakDays >= m.day;
              return (
                <span
                  key={m.day}
                  className={cn("rnk-chip", reached ? "rnk-chip-green" : "rnk-chip-outline")}
                >
                  {reached ? <Check size={11} /> : <Lock size={11} />}
                  {m.day}d · +{m.xp} XP
                </span>
              );
            })}
          </div>
          <p className="rnk-hint" style={{ marginTop: 11 }}>
            {momentum.completedNow.length > 0
              ? `${momentum.completedNow.length} meta(s) batida(s) nesta sessão.`
              : "O XP de cada meta é concedido uma única vez, no momento em que ela é batida."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- metas estratégicas (criadas pelo usuário) ----------

function MetasEstrategicas({
  active,
  done,
  cancelled,
  total,
  onOpenCreate,
  onUpdateStatus,
  onRemove,
}: {
  active: GoalData[];
  done: GoalData[];
  cancelled: GoalData[];
  total: number;
  onOpenCreate: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rnk-card">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <RnkSectionHead
          icon={Flag}
          title="Metas estratégicas"
          hint="Crescimento, engajamento e consistência — com progresso calculado a partir dos seus dados."
        />
        <RnkBtn variant="outline" size="sm" onClick={onOpenCreate}>
          <Plus size={14} /> Nova meta
        </RnkBtn>
      </div>

      <div style={{ marginTop: 14 }}>
        {total === 0 ? (
          <RnkEmpty
            icon={Target}
            title="Nenhuma meta ainda"
            text="Crie sua primeira meta estratégica para acompanhar crescimento, engajamento ou consistência com dados reais."
            action={
              <RnkBtn size="sm" onClick={onOpenCreate}>
                <Plus size={14} /> Criar meta
              </RnkBtn>
            }
          />
        ) : (
          <div className="rnk-stack" style={{ gap: 12 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <span className="rnk-chip rnk-chip-brand">{active.length} ativa(s)</span>
              <span className="rnk-chip rnk-chip-green">{done.length} concluída(s)</span>
              {cancelled.length > 0 && (
                <span className="rnk-chip">{cancelled.length} cancelada(s)</span>
              )}
            </div>

            {[...active, ...done, ...cancelled].map((g) => {
              const concluida = g.status === "CONCLUIDA";
              const cancelada = g.status === "CANCELADA";
              return (
                <div
                  key={g.id}
                  className={cn("rnk-meta", concluida && "rnk-meta-done", cancelada && "rnk-meta-off")}
                >
                  <div className="rnk-meta-top">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
                        <span className="rnk-chip rnk-chip-outline">
                          {GOAL_CATEGORY_LABEL[g.category] ?? g.category}
                        </span>
                        <span
                          className={cn(
                            "rnk-chip",
                            concluida ? "rnk-chip-green" : cancelada ? "" : "rnk-chip-brand"
                          )}
                        >
                          {concluida ? "Concluída" : cancelada ? "Cancelada" : "Ativa"}
                        </span>
                        {g.platform && <span className="rnk-chip">{g.platform}</span>}
                      </div>
                      <p className="rnk-meta-title">{g.title}</p>
                      {g.description && <p className="rnk-meta-sub">{g.description}</p>}
                    </div>

                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flex: "none" }}>
                      {g.status === "ATIVA" && (
                        <RnkBtn
                          variant="success"
                          size="xs"
                          onClick={() => onUpdateStatus(g.id, "CONCLUIDA")}
                        >
                          <CheckCircle2 size={13} /> Concluir
                        </RnkBtn>
                      )}
                      {g.status === "ATIVA" && (
                        <RnkBtn variant="outline" size="xs" onClick={() => onUpdateStatus(g.id, "CANCELADA")}>
                          Cancelar
                        </RnkBtn>
                      )}
                      {g.status === "CONCLUIDA" && (
                        <RnkBtn variant="outline" size="xs" onClick={() => onUpdateStatus(g.id, "ATIVA")}>
                          Reabrir
                        </RnkBtn>
                      )}
                      <RnkBtn
                        variant="ghost"
                        size="xs"
                        onClick={() => onRemove(g.id)}
                        ariaLabel="Excluir meta"
                      >
                        <Trash2 size={14} />
                      </RnkBtn>
                    </div>
                  </div>

                  <div>
                    <div className="rnk-next-meta" style={{ marginBottom: 7 }}>
                      <span>
                        {g.currentValue ?? 0} {g.unit}
                        {g.targetValue ? ` de ${g.targetValue} ${g.unit}` : ""}
                      </span>
                      <span className="rnk-num">{g.progressPercent}%</span>
                    </div>
                    <RnkBar
                      value={g.progressPercent}
                      tone={concluida ? "green" : "brand"}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- conquistas integradas ----------

function ConquistasResumo({
  achievements,
  unlockedCount,
  visibleCount,
  onGoToAchievements,
}: {
  achievements: AchievementData[];
  unlockedCount: number;
  visibleCount: number;
  onGoToAchievements: () => void;
}) {
  const desbloqueadas = React.useMemo(
    () =>
      achievements
        .filter((a) => a.unlocked)
        .sort((a, b) => {
          const diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0);
          if (diff !== 0) return diff;
          return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
        })
        .slice(0, 6),
    [achievements]
  );

  const pct = visibleCount > 0 ? Math.round((unlockedCount / visibleCount) * 100) : 0;

  return (
    <div className="rnk-card">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <RnkSectionHead
          icon={Award}
          title="Conquistas"
          hint={`${unlockedCount} de ${visibleCount} conquistas visíveis desbloqueadas (${pct}%).`}
        />
        <RnkBtn variant="outline" size="sm" onClick={onGoToAchievements}>
          Ver todas <ChevronRight size={14} />
        </RnkBtn>
      </div>

      <div style={{ marginTop: 12 }}>
        <RnkBar value={pct} tone="green" size="sm" />
      </div>

      <div style={{ marginTop: 14 }}>
        {desbloqueadas.length === 0 ? (
          <RnkEmpty
            icon={Award}
            title="Nenhuma conquista ainda"
            text="Conquistas são desbloqueadas por ações reais: criar copies, ideias, rascunhos, rodar análises e completar experimentos."
          />
        ) : (
          <div className="rnk-mgrid">
            {desbloqueadas.map((a) => (
              <div key={a.slug} className="rnk-ach rnk-ach-on">
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span className="rnk-ach-ic rnk-ach-ic-on" aria-hidden="true">
                    <TierIcon tier={a.tier} size={17} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="rnk-ach-title">{a.title}</p>
                    <span className={tierCardClass(a.tier)}>
                      <TierIcon tier={a.tier} size={11} />
                      {TIER_LABEL[a.tier] ?? a.tier}
                    </span>
                  </div>
                </div>
                <p className="rnk-ach-text">{a.description}</p>
                <span className="rnk-meta-xp">
                  <Zap size={13} /> +{a.xpReward} XP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Modal criar meta
// ------------------------------------------------------------

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
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

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
      setTitle("");
      setDescription("");
      setTargetValue("");
      setUnit("");
      onCreated();
    } catch {
      toast("Erro ao criar meta.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="rnk-overlay" role="dialog" aria-modal="true" aria-label="Nova meta">
      <div className="rnk-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="rnk-dialog">
        <div className="rnk-dialog-head">
          <div className="rnk-shead">
            <h2 className="rnk-h2">Nova meta</h2>
            <p className="rnk-hint">Defina uma meta estratégica com dados reais.</p>
          </div>
          <RnkBtn variant="ghost" size="xs" onClick={onClose} ariaLabel="Fechar">
            <X size={15} />
          </RnkBtn>
        </div>

        <div className="rnk-field">
          <span className="rnk-label">Categoria</span>
          <div className="rnk-pills">
            {["crescimento", "engajamento", "consistencia"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn("rnk-pill", category === c && "rnk-pill-on")}
              >
                {GOAL_CATEGORY_LABEL[c] ?? c}
              </button>
            ))}
          </div>
        </div>

        <div className="rnk-field">
          <label className="rnk-label" htmlFor="rnk-goal-title">
            Título
          </label>
          <input
            id="rnk-goal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Alcançar 500 seguidores"
            className="rnk-input"
          />
        </div>

        <div className="rnk-field">
          <label className="rnk-label" htmlFor="rnk-goal-desc">
            Descrição (opcional)
          </label>
          <input
            id="rnk-goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Meta para o próximo mês"
            className="rnk-input"
          />
        </div>

        <div className="rnk-grid-form">
          <div className="rnk-field">
            <label className="rnk-label" htmlFor="rnk-goal-target">
              Meta (valor)
            </label>
            <input
              id="rnk-goal-target"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              inputMode="numeric"
              placeholder="Ex.: 500"
              className="rnk-input"
            />
          </div>
          <div className="rnk-field">
            <label className="rnk-label" htmlFor="rnk-goal-unit">
              Unidade
            </label>
            <input
              id="rnk-goal-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ex.: seguidores"
              className="rnk-input"
            />
          </div>
        </div>

        <div className="rnk-field">
          <span className="rnk-label">Plataforma</span>
          <div className="rnk-pills">
            {["instagram", "tiktok"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={cn("rnk-pill", platform === p && "rnk-pill-on")}
              >
                {p === "instagram" ? "Instagram" : "TikTok"}
              </button>
            ))}
          </div>
        </div>

        <div className="rnk-dialog-foot">
          <RnkBtn variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </RnkBtn>
          <RnkBtn onClick={submit} disabled={saving} size="sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Target size={15} />}
            {saving ? "Salvando..." : "Criar meta"}
          </RnkBtn>
        </div>
      </div>
    </div>,
    document.body
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
  totalCount,
  unlockedPct,
  onCheck,
  checking,
}: {
  achievements: AchievementData[];
  onlyVisible: boolean;
  onToggleVisible: () => void;
  unlockedCount: number;
  visibleCount: number;
  totalCount: number;
  unlockedPct: number;
  onCheck: () => void;
  checking: boolean;
}) {
  const list = onlyVisible ? achievements.filter((a) => !a.hidden) : achievements;
  const hiddenCount = totalCount - visibleCount;

  return (
    <div className="rnk-stack">
      <div className="rnk-card">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <RnkSectionHead
            icon={Award}
            title="Conquistas"
            hint={`${unlockedCount} de ${visibleCount} conquistas visíveis desbloqueadas (${unlockedPct}%). A partir de ~70%, desafios mais difíceis aparecem.`}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RnkBtn variant="outline" size="sm" onClick={onToggleVisible}>
              {onlyVisible ? <Sparkles size={14} /> : <Award size={14} />}
              {onlyVisible ? "Mostrar todas" : "Mostrar visíveis"}
            </RnkBtn>
            <RnkBtn size="sm" onClick={onCheck} disabled={checking}>
              {checking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {checking ? "Verificando..." : "Verificar conquistas"}
            </RnkBtn>
          </div>
        </div>
        <div style={{ marginTop: 13 }}>
          <RnkBar value={unlockedPct} tone="green" size="sm" />
        </div>
        {hiddenCount > 0 && (
          <p className="rnk-hint" style={{ marginTop: 9 }}>
            {hiddenCount} conquista(s) oculta(s) ainda não revelada(s). Continue evoluindo para
            descobri-las.
          </p>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rnk-card">
          <RnkEmpty
            icon={Award}
            title="Nenhuma conquista"
            text="Conquistas são desbloqueadas por ações reais: criar copies, ideias, rascunhos, rodar análises, completar experimentos e mais."
          />
        </div>
      ) : (
        <div className="rnk-mgrid">
          {list.map((a) => {
            const Icon = achievementIcon(a.tier);
            const pct =
              a.threshold > 0 ? Math.min(100, Math.round((a.progress / a.threshold) * 100)) : 0;
            return (
              <div key={a.slug} className={cn("rnk-ach", a.unlocked && "rnk-ach-on")}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <span className={cn("rnk-ach-ic", a.unlocked && "rnk-ach-ic-on")} aria-hidden="true">
                    {a.unlocked ? <Icon size={17} /> : <Lock size={16} />}
                  </span>
                  <span className={cn("rnk-chip", a.unlocked && "rnk-chip-green")} style={{ flex: "none" }}>
                    {a.unlocked ? "Desbloqueada" : "Bloqueada"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <p className="rnk-ach-title">{a.title}</p>
                  <p className="rnk-ach-text">{a.description}</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span className={tierCardClass(a.tier)}>
                    <TierIcon tier={a.tier} size={11} />
                    {TIER_LABEL[a.tier] ?? a.tier}
                  </span>
                  <span style={{ fontSize: 11.5, color: "#6F7889" }}>
                    {a.progress} / {a.threshold} {a.unit}
                  </span>
                </div>

                <RnkBar value={pct} tone={a.unlocked ? "green" : "brand"} size="xs" />

                <span className="rnk-meta-xp">
                  <Zap size={13} /> +{a.xpReward} XP ao desbloquear
                </span>
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
  const totalPeriodo = React.useMemo(
    () => xpLogs.reduce((s, l) => s + l.amount, 0),
    [xpLogs]
  );

  return (
    <div className="rnk-stack">
      <div className="rnk-card">
        <RnkSectionHead
          icon={History}
          title="Histórico de XP"
          hint={`Auditoria completa das concessões de XP. Cada ação real é registrada uma única vez — a mesma ação nunca concede XP duas vezes.${
            xpLogs.length > 0
              ? ` ${xpLogs.length} registro(s) · ${formatXp(totalPeriodo)} XP no período listado.`
              : ""
          }`}
        />
      </div>

      {xpLogs.length === 0 ? (
        <div className="rnk-card">
          <RnkEmpty
            icon={History}
            title="Sem XP ainda"
            text="Faça ações no app (criar copy, salvar ideia, rodar análise, completar experimento...) para começar a acumular XP."
          />
        </div>
      ) : (
        <div className="rnk-card rnk-card-flush">
          <div className="rnk-rows">
            {xpLogs.map((l) => (
              <div key={`${l.source}-${l.refId}-${l.createdAt}`} className="rnk-log">
                <span className="rnk-log-ic" aria-hidden="true">
                  <Zap size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="rnk-row-name">{SOURCE_LABEL[l.source] ?? l.source}</p>
                  <span className="rnk-row-meta">
                    {new Date(l.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <span className="rnk-log-xp">+{l.amount} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="rnk-footnote">
        <BarChart3 size={14} style={{ flex: "none", marginTop: 2, color: "#C4B5FD" }} />
        A progressão recompensa comportamentos que contribuem para crescimento: consistência,
        executar recomendações, testar conteúdos e acompanhar resultados.
      </p>
    </div>
  );
}
