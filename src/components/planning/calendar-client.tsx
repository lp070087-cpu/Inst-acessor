"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Eye,
  Unlink,
  Sparkles,
  Lightbulb,
  PenSquare,
  Target,
  FlaskConical,
  CheckCircle2,
  Clock,
  Loader2,
  Save,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------
// Tipos (espelham o payload do servidor)
// ------------------------------------------------------------

interface ContentItem {
  id: string;
  platform: string;
  format: string;
  title: string;
  theme: string;
  objective: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  notes: string;
  hypothesis: string;
  ideaId: string | null;
  copyId: string | null;
  draftId: string | null;
  goalId: string | null;
  experimentIds: string[];
  copyVersionCount: number;
  ideaTitle: string;
  copyContent: string;
  draftCaption: string;
  goalTitle: string;
  experimentTitles: string[];
  createdAt: string;
}

interface WeeklySuggestion {
  title: string;
  platform: string;
  format: string;
  objective: string;
  basedOn: string;
}

interface WeeklyData {
  rationale: string;
  suggestions: WeeklySuggestion[];
  goals: { id: string; title: string; category: string }[];
  experiments: { id: string; hypothesis: string; status: string }[];
  contextAvailable: {
    profile: boolean;
    aiProfile: boolean;
    instagramConnected: boolean;
    tiktokConnected: boolean;
    hasSnapshots: boolean;
    hasActiveGoals: boolean;
    hasActiveExperiments: boolean;
    hasPlannedContent: boolean;
  };
}

interface IdeaData {
  id: string;
  category: string;
  title: string;
  format: string;
  objective: string;
  context: string;
  rationale: string;
  status: string;
  platform: string;
  createdAt: string;
}

interface CopyData {
  id: string;
  platform: string;
  format: string;
  content: string;
  isFavorite: boolean;
  createdAt: string;
}

interface DraftData {
  id: string;
  platform: string;
  mediaType: string;
  mediaUrl: string;
  caption: string;
  hashtags: string;
  format: string;
  updatedAt: string;
}

interface ExperimentData {
  id: string;
  hypothesis: string;
  variable: string;
  status: string;
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

interface CopyVersion {
  id: string;
  contentId: string;
  version: number;
  content: string;
  note: string | null;
  createdAt: string;
}

interface CalendarInitialData {
  contents: ContentItem[];
  weekly: WeeklyData;
  ideas: IdeaData[];
  copies: CopyData[];
  drafts: DraftData[];
  experiments: ExperimentData[];
  goals: GoalData[];
}

interface CalendarClientProps {
  initial: CalendarInitialData;
}

// ------------------------------------------------------------
// Rótulos / cores
// ------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  IDEIA: "Ideia",
  EM_PRODUCAO: "Em produção",
  PRONTO: "Pronto",
  AGENDADO: "Agendado",
  PROCESSANDO: "Processando",
  PUBLICADO: "Publicado",
  CANCELADO: "Cancelado",
  FALHOU: "Falhou",
};

const STATUS_TONE: Record<string, string> = {
  RASCUNHO: "bg-surface text-ink-soft border border-border-soft",
  IDEIA: "bg-info-soft text-info border border-info/20",
  EM_PRODUCAO: "bg-warn-soft text-warn border border-warn/20",
  PRONTO: "bg-ai-soft text-purple border border-purple/20",
  AGENDADO: "bg-ai-soft text-purple border border-purple/20",
  PROCESSANDO: "bg-warn-soft text-warn border border-warn/20",
  PUBLICADO: "bg-success-soft text-success border border-success/20",
  CANCELADO: "bg-danger-soft text-danger border border-danger/20",
  FALHOU: "bg-danger-soft text-danger border border-danger/20",
};

const PIPELINE_ORDER = ["IDEIA", "EM_PRODUCAO", "PRONTO", "AGENDADO", "PUBLICADO"];

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

const FORMAT_LABEL: Record<string, string> = {
  reel: "Reel",
  story: "Story",
  carrossel: "Carrossel",
  post: "Post",
  video: "Vídeo",
};

/** Normaliza um formato livre (ex.: vindo de uma ideia) para o enum oficial. */
function normalizeFormat(format: string): string {
  const f = format.toLowerCase().trim();
  if (f.startsWith("car")) return "carrossel";
  if (f.startsWith("sto") || f.startsWith("stor")) return "story";
  if (f.startsWith("vid") || f.startsWith("reel") || f.startsWith("tik")) return "reel";
  if (f.startsWith("post") || f.startsWith("imag")) return "post";
  return "reel";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------

export function CalendarClient({ initial }: CalendarClientProps) {
  const { toast } = useToast();
  const [contents, setContents] = React.useState<ContentItem[]>(initial.contents);
  const [view, setView] = React.useState<"month" | "week" | "list">("month");
  const [anchor, setAnchor] = React.useState<Date>(new Date());
  const [loading, setLoading] = React.useState(false);

  // Filtros
  const [fPlatform, setFPlatform] = React.useState("");
  const [fFormat, setFFormat] = React.useState("");
  const [fStatus, setFStatus] = React.useState("");
  const [fGoal, setFGoal] = React.useState("");
  const [fObjective, setFObjective] = React.useState("");
  const [fExperiment, setFExperiment] = React.useState("");
  const [fPeriod, setFPeriod] = React.useState("");

  // Modais
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  // Dados auxiliares
  const [ideas, setIdeas] = React.useState<IdeaData[]>(initial.ideas);
  const [copies] = React.useState<CopyData[]>(initial.copies);
  const [drafts, setDrafts] = React.useState<DraftData[]>(initial.drafts);
  const [experiments] = React.useState<ExperimentData[]>(initial.experiments);
  const [goals, setGoals] = React.useState<GoalData[]>(initial.goals);
  const [weekly, setWeekly] = React.useState<WeeklyData>(initial.weekly);

  const detail = contents.find((c) => c.id === detailId) ?? null;

  // Deep-link "planejar": vindo da Central de Ideias (ideia → PLANEJAR).
  // Abre o modal de criação já com a ideia selecionada (racional preservado).
  const [preselectIdeaId, setPreselectIdeaId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ideaId = params.get("planejar");
    if (ideaId) {
      setPreselectIdeaId(ideaId);
      setCreateOpen(true);
      // Limpa a URL para não reabrir o modal em recargas.
      window.history.replaceState({}, "", "/calendario");
    }
  }, []);

  // Filtragem client-side
  const filtered = React.useMemo(() => {
    return contents.filter((c) => {
      if (fPlatform && c.platform !== fPlatform) return false;
      if (fFormat && c.format !== fFormat) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fGoal && c.goalId !== fGoal) return false;
      if (fObjective && c.objective !== fObjective) return false;
      if (fExperiment && !c.experimentIds.includes(fExperiment)) return false;
      if (fPeriod) {
        if (!c.scheduledAt) return false;
        const d = new Date(c.scheduledAt).getTime();
        const now = Date.now();
        if (fPeriod === "week") {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          start.setDate(start.getDate() - start.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          if (d < start.getTime() || d >= end.getTime()) return false;
        } else if (fPeriod === "month") {
          const y = new Date().getFullYear();
          const m = new Date().getMonth();
          const start = new Date(y, m, 1).getTime();
          const end = new Date(y, m + 1, 1).getTime();
          if (d < start || d >= end) return false;
        } else if (fPeriod === "next30") {
          if (d < now || d > now + 30 * 24 * 60 * 60 * 1000) return false;
        }
      }
      return true;
    });
  }, [contents, fPlatform, fFormat, fStatus, fGoal, fObjective, fExperiment, fPeriod]);

  // Pipeline counts
  const counts = React.useMemo(() => {
    const c: Record<string, number> = {
      RASCUNHO: 0, IDEIA: 0, EM_PRODUCAO: 0, PRONTO: 0, AGENDADO: 0,
      PUBLICADO: 0, CANCELADO: 0, FALHOU: 0,
    };
    for (const item of contents) c[item.status] = (c[item.status] ?? 0) + 1;
    return c;
  }, [contents]);

  async function refresh() {
    try {
      const res = await fetch("/api/calendar");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContents(data);
    } catch {
      toast("Não foi possível atualizar o calendário.", "error");
    }
  }

  async function handleCreate(payload: Record<string, unknown>) {
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao criar.", "error");
        return false;
      }
      toast("Conteúdo criado no planejamento.");
      setCreateOpen(false);
      await refresh();
      return true;
    } catch {
      toast("Não foi possível criar.", "error");
      return false;
    }
  }

  async function handleUpdate(id: string, payload: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/calendar?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao atualizar.", "error");
        return false;
      }
      toast("Conteúdo atualizado.");
      await refresh();
      return true;
    } catch {
      toast("Não foi possível atualizar.", "error");
      return false;
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este conteúdo do planejamento?")) return;
    try {
      const res = await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Erro ao excluir.", "error");
        return;
      }
      toast("Conteúdo excluído.");
      setDetailId(null);
      await refresh();
    } catch {
      toast("Não foi possível excluir.", "error");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/calendar/duplicate?id=${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao duplicar.", "error");
        return;
      }
      toast("Conteúdo duplicado.");
      await refresh();
    } catch {
      toast("Não foi possível duplicar.", "error");
    }
  }

  async function handleStatus(id: string, status: string) {
    const ok = await handleUpdate(id, { status });
    if (ok) setDetailId(null);
  }

  // Navegação do calendário
  function moveAnchor(dir: 1 | -1) {
    const next = new Date(anchor);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    else if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  const anchorLabel =
    view === "week"
      ? anchor.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Agrupa por dia
  const byDay = React.useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const c of filtered) {
      if (!c.scheduledAt) continue;
      const d = new Date(c.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  const unscheduled = filtered.filter((c) => !c.scheduledAt);

  // Grade do mês
  const monthGrid = React.useMemo(() => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const last = new Date(year, month + 1, 0);
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startPad; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() - (startPad - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const lastCell = cells[cells.length - 1].date;
      const d = new Date(lastCell);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    return cells;
  }, [anchor]);

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Semana (7 dias a partir de domingo)
  const weekDays = React.useMemo(() => {
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  return (
    <div className="flex flex-col gap-5">
      {/* Pipeline overview */}
      <SectionCard
        title="Pipeline de conteúdo"
        description="Ideia → Em produção → Pronto → Agendado → Publicado. Rascunho, cancelado e falhou ficam fora do fluxo principal."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Novo conteúdo
          </Button>
        }
      >
        <div className="flex flex-wrap gap-3">
          {PIPELINE_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => setFStatus(fStatus === s ? "" : s)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-pill border transition-all duration-300 cursor-pointer hover:-translate-y-0.5",
                  fStatus === s ? "ring-2 ring-purple/30" : ""
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", STATUS_TONE[s].split(" ")[0])} />
                <span className="text-[13.5px] font-semibold text-ink">{STATUS_LABEL[s]}</span>
                <span className="text-[12.5px] font-bold text-ink-soft bg-surface rounded-full px-2 py-0.5">
                  {counts[s] ?? 0}
                </span>
              </button>
              {i < PIPELINE_ORDER.length - 1 && (
                <ChevronRight size={16} className="text-ink-muted self-center" />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {["RASCUNHO", "CANCELADO", "FALHOU"].map((s) => (
            <button
              key={s}
              onClick={() => setFStatus(fStatus === s ? "" : s)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-pill border border-border-soft transition-all duration-300 cursor-pointer",
                fStatus === s ? "ring-2 ring-purple/30" : ""
              )}
            >
              <span className="text-[12.5px] font-semibold text-ink-soft">{STATUS_LABEL[s]}</span>
              <span className="text-[12px] font-bold text-ink-soft">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "month", label: "Mês" },
            { id: "week", label: "Semana" },
            { id: "list", label: "Lista" },
          ]}
          activeId={view}
          onChange={(v) => setView(v as "month" | "week" | "list")}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => moveAnchor(-1)}
            className="w-9 h-9 grid place-items-center rounded-pill bg-card border border-border-soft text-ink-soft hover:text-ink transition-colors cursor-pointer"
            aria-label="Anterior"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="px-4 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink hover:text-purple transition-colors cursor-pointer"
          >
            Hoje
          </button>
          <button
            onClick={() => moveAnchor(1)}
            className="w-9 h-9 grid place-items-center rounded-pill bg-card border border-border-soft text-ink-soft hover:text-ink transition-colors cursor-pointer"
            aria-label="Próximo"
          >
            <ChevronRight size={17} />
          </button>
          <span className="text-[14px] font-display font-bold text-ink capitalize ml-2 w-36 text-right">
            {anchorLabel}
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={fPlatform}
          onChange={(e) => setFPlatform(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todas plataformas</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select
          value={fFormat}
          onChange={(e) => setFFormat(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todos formatos</option>
          {Object.entries(FORMAT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todos status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={fGoal}
          onChange={(e) => setFGoal(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todas metas</option>
          {goals.filter((g) => g.status === "ATIVA").map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        <select
          value={fObjective}
          onChange={(e) => setFObjective(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todos objetivos</option>
          {[...new Set(contents.map((c) => c.objective).filter(Boolean))].slice(0, 20).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select
          value={fExperiment}
          onChange={(e) => setFExperiment(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todos experimentos</option>
          {experiments.map((e) => (
            <option key={e.id} value={e.id}>{e.hypothesis}</option>
          ))}
        </select>
        <select
          value={fPeriod}
          onChange={(e) => setFPeriod(e.target.value)}
          className="px-3 py-2 rounded-pill bg-card border border-border-soft text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
        >
          <option value="">Todos períodos</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mês</option>
          <option value="next30">Próximos 30 dias</option>
        </select>
        {(fPlatform || fFormat || fStatus || fGoal || fObjective || fExperiment || fPeriod) && (
          <button
            onClick={() => {
              setFPlatform(""); setFFormat(""); setFStatus(""); setFGoal("");
              setFObjective(""); setFExperiment(""); setFPeriod("");
            }}
            className="text-[13px] font-semibold text-danger hover:opacity-80 transition-opacity cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Corpo do calendário */}
      {filtered.length === 0 && unscheduled.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum conteúdo planejado"
          description="Crie o primeiro conteúdo, planeje uma ideia ou aceite uma sugestão do plano semanal. Nada é publicado automaticamente."
          action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={16} /> Novo conteúdo</Button>}
        />
      ) : (
        <>
          {view === "month" && (
            // O mês é uma grade de 7 colunas — ela não pode "encolher" até
            // virar 35px por célula no celular. Abaixo de ~560px de viewport a
            // grade ganha uma largura mínima legível e ROLA dentro do próprio
            // card (padrão de calendário em mobile), em vez de espremer as
            // células ou empurrar a página inteira para os lados.
            <div className="overflow-x-auto -mx-1 px-1">
            <div className="grid grid-cols-7 gap-1.5 bg-card border border-border-soft rounded-lg shadow-xs p-2 sm:p-3 min-w-[520px]">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <div key={i} className="text-center text-[11px] font-bold uppercase tracking-wider text-ink-muted py-1">
                  {d}
                </div>
              ))}
              {monthGrid.map((cell, i) => {
                const key = dayKey(cell.date);
                const items = byDay.get(key) ?? [];
                const today = key === dayKey(new Date());
                return (
                  <div
                    key={i}
                    className={cn(
                      // `min-w-0 overflow-hidden`: as colunas da grade são
                      // `minmax(0,1fr)` e encolhem, mas o item de grade tem
                      // `min-width:auto` por padrão — um título longo vazava da
                      // célula em vez de ser truncado, empurrando a página.
                      "min-h-[86px] min-w-0 overflow-hidden rounded-md border p-1.5 flex flex-col gap-1",
                      cell.inMonth ? "bg-bg" : "bg-transparent opacity-40",
                      today && "ring-2 ring-purple/40"
                    )}
                  >
                    <span className="text-[11px] font-semibold text-ink-soft">{cell.date.getDate()}</span>
                    {items.slice(0, 3).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setDetailId(c.id)}
                        className={cn(
                          "text-left text-[10.5px] leading-tight px-1.5 py-0.5 rounded-[6px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity",
                          STATUS_TONE[c.status]
                        )}
                        title={c.title}
                      >
                        {c.title}
                      </button>
                    ))}
                    {items.length > 3 && (
                      <span className="text-[10px] text-ink-muted font-semibold px-1">+{items.length - 3}</span>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          )}

          {view === "week" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {weekDays.map((d) => {
                const key = dayKey(d);
                const items = byDay.get(key) ?? [];
                const today = key === dayKey(new Date());
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-lg border bg-card shadow-xs p-2.5 flex flex-col gap-1.5",
                      today && "ring-2 ring-purple/40"
                    )}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                      {d.toLocaleDateString("pt-BR", { weekday: "short" })}
                      <span className="ml-1.5 font-semibold">{d.getDate()}</span>
                    </div>
                    {items.length === 0 ? (
                      <span className="text-[11px] text-ink-muted">—</span>
                    ) : (
                      items.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setDetailId(c.id)}
                          className={cn(
                            "text-left text-[11px] leading-snug px-2 py-1 rounded-[6px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                            STATUS_TONE[c.status]
                          )}
                        >
                          {c.title}
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view === "list" && (
            <div className="flex flex-col gap-2">
              {[...byDay.entries()]
                .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                .map(([key, items]) => (
                  <div key={key} className="rounded-lg bg-card border border-border-soft shadow-xs p-4">
                    <div className="text-[12px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                      {new Date(key + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {items.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setDetailId(c.id)}
                          className="flex items-center gap-3 text-left px-3 py-2 rounded-md hover:bg-bg transition-colors cursor-pointer"
                        >
                          <span className={cn("w-2 h-2 rounded-full flex-none", STATUS_TONE[c.status].split(" ")[0])} />
                          <span className="text-[13.5px] font-semibold text-ink flex-1 truncate">{c.title}</span>
                          <Badge size="xs" tone="neutral">{PLATFORM_LABEL[c.platform] ?? c.platform}</Badge>
                          <Badge size="xs" tone="neutral">{FORMAT_LABEL[c.format] ?? c.format}</Badge>
                          <span className="text-[12px] text-ink-soft flex-none w-20 text-right">{fmtDateTime(c.scheduledAt)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              {unscheduled.length > 0 && (
                <div className="rounded-lg bg-card border border-dashed border-border-soft shadow-xs p-4">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-ink-muted mb-2">Sem data agendada</div>
                  <div className="flex flex-col gap-1.5">
                    {unscheduled.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setDetailId(c.id)}
                        className="flex items-center gap-3 text-left px-3 py-2 rounded-md hover:bg-bg transition-colors cursor-pointer"
                      >
                        <span className={cn("w-2 h-2 rounded-full flex-none", STATUS_TONE[c.status].split(" ")[0])} />
                        <span className="text-[13.5px] font-semibold text-ink flex-1 truncate">{c.title}</span>
                        <Badge size="xs" tone="neutral">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Plano semanal */}
      <WeeklyPlanCard weekly={weekly} />

      {/* Modal de criação */}
      <CreateContentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        ideas={ideas}
        goals={goals}
        experiments={experiments}
        copies={copies}
        preselectIdeaId={preselectIdeaId}
        onConsumedPreselect={() => setPreselectIdeaId(null)}
      />

      {/* Modal de detalhe */}
      {detail && (
      <ContentDetailModal
        content={detail}
        onClose={() => setDetailId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onStatus={handleStatus}
        ideas={ideas}
        copies={copies}
        drafts={drafts}
        experiments={experiments}
        goals={goals}
        setDrafts={setDrafts}
      />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Plano semanal
// ------------------------------------------------------------

function WeeklyPlanCard({ weekly }: { weekly: WeeklyData }) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"padrao" | "ai">("padrao");
  const [data, setData] = React.useState<WeeklyData>(weekly);
  const [loading, setLoading] = React.useState(false);

  const ctx = data.contextAvailable;
  const hasContext = ctx.profile || ctx.hasSnapshots;

  async function loadAi() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/weekly-plan?mode=ai");
      const d = await res.json();
      if (!res.ok) {
        toast(d.error ?? "Erro ao gerar plano.", "error");
        return;
      }
      setData(d);
      setMode("ai");
    } catch {
      toast("Não foi possível gerar o plano com IA.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      title="Plano semanal assistido"
      description="Personalizado com seu perfil, metas e experimentos — nunca um template genérico."
      action={
        <div className="flex gap-2">
          <Button size="xs" variant="ghost" onClick={() => { setData(weekly); setMode("padrao"); }}>
            Padrão
          </Button>
          <Button size="xs" onClick={loadAi} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Plano com IA
          </Button>
        </div>
      }
    >
      {!hasContext ? (
        <div className="py-2">
          <Badge tone="warning" dot>DADO INSUFICIENTE</Badge>
          <p className="text-[13px] text-ink-soft mt-3 leading-relaxed">
            Para um plano personalizado, preencha o nicho no perfil e/ou conecte uma conta
            (Instagram ou TikTok) para ter snapshots reais. Nenhum dado é inventado.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone={ctx.profile ? "success" : "neutral"} dot>Perfil {ctx.profile ? "preenchido" : "incompleto"}</Badge>
            <Badge tone={ctx.instagramConnected ? "success" : "neutral"} dot>Instagram {ctx.instagramConnected ? "conectado" : "não conectado"}</Badge>
            <Badge tone={ctx.tiktokConnected ? "success" : "neutral"} dot>TikTok {ctx.tiktokConnected ? "conectado" : "não conectado"}</Badge>
            <Badge tone={ctx.hasActiveGoals ? "success" : "neutral"} dot>{ctx.hasActiveGoals ? "Metas ativas" : "Sem metas ativas"}</Badge>
            <Badge tone={ctx.hasActiveExperiments ? "success" : "neutral"} dot>{ctx.hasActiveExperiments ? "Experimentos ativos" : "Sem experimentos ativos"}</Badge>
          </div>

          {data.suggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.suggestions.map((s, i) => (
                <div key={i} className="rounded-md border border-border-soft bg-bg p-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink">{s.title}</span>
                    <div className="flex gap-2">
                      <Badge size="xs" tone="brand">{PLATFORM_LABEL[s.platform] ?? s.platform}</Badge>
                      <Badge size="xs" tone="neutral">{FORMAT_LABEL[s.format] ?? s.format}</Badge>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed">{s.basedOn}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ink-soft">
              {mode === "ai" ? "A IA não produziu sugestões — contexto ainda insuficiente." : "Sem sugestões no momento."}
            </p>
          )}

          <details className="mt-1">
            <summary className="text-[12.5px] font-semibold text-purple hover:text-indigo cursor-pointer">
              Ver racional completo (transparência)
            </summary>
            <pre className="mt-2 text-[11.5px] text-ink-soft whitespace-pre-wrap font-mono leading-relaxed bg-bg border border-border-soft rounded-md p-3 max-h-64 overflow-auto">
              {data.rationale}
            </pre>
          </details>
        </div>
      )}
    </SectionCard>
  );
}

// ------------------------------------------------------------
// Modal de criação
// ------------------------------------------------------------

interface CreateContentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  ideas: IdeaData[];
  goals: GoalData[];
  experiments: ExperimentData[];
  copies: CopyData[];
  preselectIdeaId?: string | null;
  onConsumedPreselect?: () => void;
}

function CreateContentModal({ open, onClose, onSave, ideas, goals, experiments, copies, preselectIdeaId, onConsumedPreselect }: CreateContentModalProps) {
  const [title, setTitle] = React.useState("");
  const [platform, setPlatform] = React.useState("instagram");
  const [format, setFormat] = React.useState("reel");
  const [theme, setTheme] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [hypothesis, setHypothesis] = React.useState("");
  const [ideaId, setIdeaId] = React.useState("");
  const [copyId, setCopyId] = React.useState("");
  const [goalId, setGoalId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(""); setPlatform("instagram"); setFormat("reel"); setTheme("");
      setObjective(""); setScheduledAt(""); setNotes(""); setHypothesis("");
      setIdeaId(""); setCopyId(""); setGoalId("");
      if (preselectIdeaId) {
        setIdeaId(preselectIdeaId);
        const idea = ideas.find((i) => i.id === preselectIdeaId);
        if (idea) {
          setTitle(idea.title);
          setObjective(idea.objective);
          if (idea.platform) setPlatform(idea.platform);
          if (idea.format) setFormat(normalizeFormat(idea.format));
        }
        onConsumedPreselect?.();
      }
    }
  }, [open, preselectIdeaId, ideas, onConsumedPreselect]);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    const ok = await onSave({
      title: title.trim(),
      platform,
      format,
      theme: theme.trim(),
      objective: objective.trim(),
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      notes: notes.trim(),
      hypothesis: hypothesis.trim(),
      ideaId: ideaId || null,
      copyId: copyId || null,
      goalId: goalId || null,
    });
    setSaving(false);
  }

  const selectedIdea = ideas.find((i) => i.id === ideaId);

  return (
    <Modal open={open} onClose={onClose} title="Novo conteúdo planejado" description="Crie um item no calendário. Ele entra como rascunho (ou agendado, se tiver data)." size="lg">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink">Título *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Reel de antes/depois"
            className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink">Plataforma</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer">
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink">Formato</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer">
              {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink">Tema (opcional)</span>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex.: autoridade, bastidores, venda"
            className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink">Objetivo (opcional)</span>
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex.: alcance, engajamento, autoridade, venda"
            className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink">Data / horário (agendamento interno)</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
          <span className="text-[11px] text-ink-soft">É apenas o planejamento interno — nunca publica automaticamente.</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink">Associar ideia</span>
            <select value={ideaId} onChange={(e) => setIdeaId(e.target.value)} className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer">
              <option value="">Nenhuma</option>
              {ideas.filter((i) => i.status !== "PRODUZIDA").map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink">Associar copy</span>
            <select value={copyId} onChange={(e) => setCopyId(e.target.value)} className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer">
              <option value="">Nenhuma</option>
              {copies.map((c) => (
                <option key={c.id} value={c.id}>{c.content.slice(0, 40)}…</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink">Associar meta (Fase 5)</span>
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer">
            <option value="">Nenhuma</option>
            {goals.filter((g) => g.status === "ATIVA").map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </label>

        {selectedIdea && selectedIdea.rationale && (
          <div className="rounded-md bg-ai-soft border border-purple/15 p-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-purple">
              <Lightbulb size={14} /> Racional da ideia (preservado)
            </div>
            <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed">{selectedIdea.rationale}</p>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink">Observações (opcional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Detalhes de produção, referências..."
            className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 resize-none"
          />
        </label>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !title.trim()}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Criar conteúdo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Modal de detalhe
// ------------------------------------------------------------

interface ContentDetailModalProps {
  content: ContentItem;
  onClose: () => void;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onStatus: (id: string, status: string) => void;
  ideas: IdeaData[];
  copies: CopyData[];
  drafts: DraftData[];
  experiments: ExperimentData[];
  goals: GoalData[];
  setDrafts: React.Dispatch<React.SetStateAction<DraftData[]>>;
}

function ContentDetailModal({
  content, onClose, onUpdate, onDelete, onDuplicate, onStatus,
  ideas, copies, drafts, experiments, goals, setDrafts,
}: ContentDetailModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = React.useState<"detalhes" | "preview" | "copy">("detalhes");
  const [versions, setVersions] = React.useState<CopyVersion[]>([]);
  const [versionText, setVersionText] = React.useState("");
  const [versionNote, setVersionNote] = React.useState("");

  // Preview social (edição)
  const [previewCaption, setPreviewCaption] = React.useState("");
  const [previewHashtags, setPreviewHashtags] = React.useState("");
  const [previewMediaType, setPreviewMediaType] = React.useState("reel");
  const [savingPreview, setSavingPreview] = React.useState(false);

  React.useEffect(() => {
    setTab("detalhes");
    setVersions([]);
    setVersionText("");
    setVersionNote("");
    if (content?.draftCaption) setPreviewCaption(content.draftCaption);
    if (content?.draftId) {
      const d = drafts.find((x) => x.id === content.draftId);
      if (d) {
        setPreviewCaption(d.caption);
        setPreviewHashtags(d.hashtags);
        setPreviewMediaType(d.mediaType);
      }
    }
  }, [content?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const attachedIdea = ideas.find((i) => i.id === content.ideaId);
  const attachedCopy = copies.find((c) => c.id === content.copyId);
  const attachedGoal = goals.find((g) => g.id === content.goalId);
  const attachedExperiments = experiments.filter((e) => content.experimentIds.includes(e.id));

  async function loadVersions() {
    try {
      const res = await fetch(`/api/calendar/copy-versions?contentId=${content.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVersions(data);
    } catch {
      toast("Erro ao carregar versões.", "error");
    }
  }

  async function saveVersion() {
    if (!versionText.trim()) return;
    try {
      const res = await fetch(`/api/calendar/copy-versions?contentId=${content.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: versionText.trim(), note: versionNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar versão.", "error");
        return;
      }
      toast(`Versão ${data.version.version} salva.`);
      setVersionText("");
      setVersionNote("");
      await loadVersions();
    } catch {
      toast("Não foi possível salvar a versão.", "error");
    }
  }

  async function savePreview() {
    setSavingPreview(true);
    try {
      const payload = {
        platform: content.platform,
        mediaType: previewMediaType,
        caption: previewCaption,
        hashtags: previewHashtags,
        format: content.format,
      };
      let draftId = content.draftId;
      let res: Response;
      if (draftId) {
        res = await fetch(`/api/drafts?id=${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.draft) draftId = data.draft.id;
      }
      if (!res.ok) {
        toast("Erro ao salvar preview.", "error");
        return;
      }
      // Vincula o rascunho ao conteúdo (se ainda não estava).
      if (draftId && content.draftId !== draftId) {
        await onUpdate(content.id, { draftId });
      }
      toast("Preview social salvo. Nada foi publicado.");
      // Atualiza a lista local de rascunhos.
      const resList = await fetch("/api/drafts");
      if (resList.ok) setDrafts(await resList.json());
    } catch {
      toast("Não foi possível salvar o preview.", "error");
    } finally {
      setSavingPreview(false);
    }
  }

  async function attachExperiment(experimentId: string) {
    try {
      const res = await fetch(`/api/calendar/experiments?id=${content.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao associar experimento.", "error");
        return;
      }
      toast("Experimento associado ao conteúdo.");
      await onUpdate(content.id, {}); // refresh local
    } catch {
      toast("Não foi possível associar experimento.", "error");
    }
  }

  async function detachExperiment(experimentId: string) {
    try {
      const res = await fetch(`/api/calendar/experiments?id=${content.id}&experimentId=${experimentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast("Erro ao remover experimento.", "error");
        return;
      }
      toast("Associação removida.");
      await onUpdate(content.id, {});
    } catch {
      toast("Não foi possível remover experimento.", "error");
    }
  }

  const pipelineIndex = PIPELINE_ORDER.indexOf(content.status);

  return (
    <Modal open onClose={onClose} title={content.title} description="Detalhes, associações e preparação do conteúdo. Nada é publicado automaticamente." size="lg">
      <div className="flex flex-col gap-4">
        {/* Status / pipeline */}
        <div className="flex items-center gap-2 flex-wrap">
          {PIPELINE_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => onStatus(content.id, s)}
                className={cn(
                  "text-[12px] font-semibold px-2.5 py-1 rounded-pill border transition-all duration-300 cursor-pointer",
                  content.status === s
                    ? "bg-purple text-white border-purple"
                    : i < pipelineIndex
                      ? "bg-success-soft text-success border-success/30"
                      : "bg-bg text-ink-soft border-border-soft hover:text-ink"
                )}
              >
                {STATUS_LABEL[s]}
              </button>
              {i < PIPELINE_ORDER.length - 1 && <ChevronRight size={13} className="text-ink-muted" />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["RASCUNHO", "CANCELADO", "FALHOU"].map((s) => (
            <button
              key={s}
              onClick={() => onStatus(content.id, s)}
              className={cn(
                "text-[12px] font-semibold px-2.5 py-1 rounded-pill border transition-all duration-300 cursor-pointer",
                content.status === s
                  ? "bg-danger text-white border-danger"
                  : "bg-bg text-ink-soft border-border-soft hover:text-ink"
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
          <button
            onClick={() => onDuplicate(content.id)}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-pill bg-bg text-ink-soft border border-border-soft hover:text-ink transition-colors cursor-pointer"
          >
            <Copy size={13} /> Duplicar
          </button>
          <button
            onClick={() => router.push(`/preview-social?content=${content.id}`)}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-pill bg-ai-soft text-purple border border-purple/20 hover:bg-purple hover:text-white transition-colors cursor-pointer"
          >
            <ExternalLink size={13} /> Abrir no Preview Social
          </button>
          <button
            onClick={() => onDelete(content.id)}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-pill bg-danger-soft text-danger border border-danger/20 hover:bg-danger hover:text-white transition-colors cursor-pointer"
          >
            <Trash2 size={13} /> Excluir
          </button>
        </div>

        {/* Informações */}
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{PLATFORM_LABEL[content.platform] ?? content.platform}</Badge>
          <Badge tone="neutral">{FORMAT_LABEL[content.format] ?? content.format}</Badge>
          <Badge tone={content.status === "PUBLICADO" ? "success" : content.status === "CANCELADO" || content.status === "FALHOU" ? "danger" : "info"}>
            {STATUS_LABEL[content.status] ?? content.status}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft font-medium">
            <Clock size={13} /> {fmtDateTime(content.scheduledAt)}
          </span>
        </div>

        {content.publishedAt && (
          <div className="rounded-md bg-success-soft border border-success/20 p-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success flex-none" />
            <span className="text-[12.5px] text-success font-semibold">
              Marcado como publicado em {fmtDateTime(content.publishedAt)}
              {content.externalId ? ` · id externo: ${content.externalId}` : ""}
            </span>
          </div>
        )}

        {(content.objective || content.theme) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {content.objective && (
              <div className="rounded-md bg-bg border border-border-soft p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Objetivo</span>
                <p className="text-[13px] text-ink mt-0.5">{content.objective}</p>
              </div>
            )}
            {content.theme && (
              <div className="rounded-md bg-bg border border-border-soft p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Tema</span>
                <p className="text-[13px] text-ink mt-0.5">{content.theme}</p>
              </div>
            )}
          </div>
        )}

        {/* Associações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md bg-bg border border-border-soft p-3">
            <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink">
              <Lightbulb size={15} className="text-purple" /> Ideia
            </div>
            {attachedIdea ? (
              <>
                <p className="text-[13px] text-ink mt-1">{attachedIdea.title}</p>
                {attachedIdea.rationale && (
                  <p className="text-[11.5px] text-ink-soft mt-0.5 italic">{attachedIdea.rationale}</p>
                )}
              </>
            ) : (
              <p className="text-[12.5px] text-ink-soft mt-1">Nenhuma ideia associada.</p>
            )}
            <select
              value={content.ideaId ?? ""}
              onChange={(e) => onUpdate(content.id, { ideaId: e.target.value || null })}
              className="mt-2 w-full px-3 py-2 rounded-[8px] bg-card border border-border-soft text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
            >
              <option value="">Associar ideia…</option>
              {ideas.filter((i) => i.status !== "PRODUZIDA" || i.id === content.ideaId).map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
          </div>

          <div className="rounded-md bg-bg border border-border-soft p-3">
            <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink">
              <Target size={15} className="text-purple" /> Meta (Fase 5)
            </div>
            {attachedGoal ? (
              <>
                <p className="text-[13px] text-ink mt-1">{attachedGoal.title}</p>
                <Badge size="xs" tone="info" className="mt-1">{attachedGoal.category}</Badge>
              </>
            ) : (
              <p className="text-[12.5px] text-ink-soft mt-1">Nenhuma meta associada.</p>
            )}
            <select
              value={content.goalId ?? ""}
              onChange={(e) => onUpdate(content.id, { goalId: e.target.value || null })}
              className="mt-2 w-full px-3 py-2 rounded-[8px] bg-card border border-border-soft text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
            >
              <option value="">Associar meta…</option>
              {goals.filter((g) => g.status === "ATIVA").map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Experimentos */}
        <div className="rounded-md bg-bg border border-border-soft p-3">
          <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink">
            <FlaskConical size={15} className="text-warn" /> Experimentos associados
          </div>
          <p className="text-[11.5px] text-ink-soft mt-0.5">
            Preparação apenas — resultados nunca são inventados.
          </p>
          <div className="flex flex-col gap-1.5 mt-2">
            {attachedExperiments.length === 0 && (
              <p className="text-[12.5px] text-ink-soft">Nenhum experimento associado.</p>
            )}
            {attachedExperiments.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-md bg-card border border-border-soft px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink font-medium truncate">{e.hypothesis}</p>
                  <span className="text-[11px] text-ink-muted">variável: {e.variable}</span>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <Badge size="xs" tone={e.status === "RUNNING" ? "info" : "warning"}>{e.status}</Badge>
                  <button
                    onClick={() => detachExperiment(e.id)}
                    className="text-ink-muted hover:text-danger transition-colors cursor-pointer"
                    aria-label="Remover experimento"
                  >
                    <Unlink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <select
            value=""
            onChange={(e) => { if (e.target.value) attachExperiment(e.target.value); }}
            className="mt-2 w-full px-3 py-2 rounded-[8px] bg-card border border-border-soft text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
          >
            <option value="">Associar experimento…</option>
            {experiments
              .filter((e) => !content.experimentIds.includes(e.id) && (e.status === "RUNNING" || e.status === "DRAFT" || e.status === "ENOUGH_DATA"))
              .map((e) => (
                <option key={e.id} value={e.id}>{e.hypothesis}</option>
              ))}
          </select>
        </div>

        {/* Abas internas */}
        <Tabs
          tabs={[
            { id: "detalhes", label: "Detalhes" },
            { id: "copy", label: "Copy e versões" },
            { id: "preview", label: "Preview Social" },
          ]}
          activeId={tab}
          onChange={(t) => {
            setTab(t as "detalhes" | "preview" | "copy");
            if (t === "copy") loadVersions();
          }}
        />

        {tab === "detalhes" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink">Hipótese estratégica</span>
              <textarea
                value={content.hypothesis}
                onChange={(e) => onUpdate(content.id, { hypothesis: e.target.value })}
                rows={2}
                placeholder="O que este conteúdo testa?"
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 resize-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink">Observações</span>
              <textarea
                value={content.notes}
                onChange={(e) => onUpdate(content.id, { notes: e.target.value })}
                rows={3}
                placeholder="Detalhes de produção, referências..."
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 resize-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink">Reagendar</span>
              <input
                type="datetime-local"
                value={content.scheduledAt ? new Date(content.scheduledAt).toISOString().slice(0, 16) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate(content.id, {
                    scheduledAt: val ? new Date(val).toISOString() : null,
                    ...(val ? { status: content.status === "RASCUNHO" ? "AGENDADO" : content.status } : {}),
                  });
                }}
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
              />
              <span className="text-[11px] text-ink-soft">Agendamento interno apenas.</span>
            </label>
          </div>
        )}

        {tab === "copy" && (
          <div className="flex flex-col gap-3">
            {attachedCopy ? (
              <div className="rounded-md bg-ai-soft border border-purple/15 p-3">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-purple">
                  <PenSquare size={14} /> Copy associada
                </div>
                <p className="text-[13px] text-ink mt-1.5 whitespace-pre-wrap leading-relaxed">{attachedCopy.content}</p>
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-soft">
                Nenhuma copy associada. Associe no campo acima (Ideia/Copy) ou gere uma no Preview Social.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold text-ink">Versões da copy ({versions.length})</span>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-auto">
                {versions.length === 0 && (
                  <p className="text-[12.5px] text-ink-soft">Nenhuma versão salva ainda.</p>
                )}
                {versions.map((v) => (
                  <div key={v.id} className="rounded-md bg-bg border border-border-soft px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple">v{v.version}</span>
                      {v.note && <span className="text-[11px] text-ink-muted italic">{v.note}</span>}
                    </div>
                    <p className="text-[12.5px] text-ink mt-0.5 whitespace-pre-wrap line-clamp-3">{v.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border-soft pt-3">
              <span className="text-[12.5px] font-semibold text-ink">Adicionar versão</span>
              <textarea
                value={versionText}
                onChange={(e) => setVersionText(e.target.value)}
                rows={3}
                placeholder="Nova versão da copy (nunca sobrescreve as anteriores)"
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 resize-none"
              />
              <input
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="Nota da versão (opcional)"
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
              />
              <Button size="sm" variant="ghost" onClick={saveVersion} disabled={!versionText.trim()}>
                <Save size={15} /> Salvar versão
              </Button>
            </div>
          </div>
        )}

        {tab === "preview" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              <Eye size={15} className="text-purple" />
              Visualize e edite como o conteúdo aparecerá. Nada é publicado.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-ink">Tipo de mídia</span>
                <select
                  value={previewMediaType}
                  onChange={(e) => setPreviewMediaType(e.target.value)}
                  className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 cursor-pointer"
                >
                  <option value="reel">Reel / Vídeo</option>
                  <option value="post">Post / Imagem</option>
                  <option value="carrossel">Carrossel</option>
                  <option value="story">Story</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-ink">Plataforma</span>
                <input
                  value={PLATFORM_LABEL[content.platform] ?? content.platform}
                  disabled
                  className="px-3.5 py-2.5 rounded-[10px] bg-surface border border-border-soft text-[14px] text-ink-soft"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink">Legenda</span>
              <textarea
                value={previewCaption}
                onChange={(e) => setPreviewCaption(e.target.value)}
                rows={4}
                placeholder="Legenda do conteúdo..."
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 resize-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink">Hashtags</span>
              <input
                value={previewHashtags}
                onChange={(e) => setPreviewHashtags(e.target.value)}
                placeholder="#exemplo #conteudo"
                className="px-3.5 py-2.5 rounded-[10px] bg-bg border border-border-soft text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
              />
            </label>
            <div className="flex justify-end">
              <Button size="sm" onClick={savePreview} disabled={savingPreview}>
                {savingPreview ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar preview
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
