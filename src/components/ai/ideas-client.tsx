"use client";

import * as React from "react";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  Star,
  Save,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "reels", label: "Reels" },
  { id: "stories", label: "Stories" },
  { id: "carrossel", label: "Carrossel" },
  { id: "tiktok", label: "TikTok" },
  { id: "educativo", label: "Educativo" },
  { id: "autoridade", label: "Autoridade" },
  { id: "venda", label: "Venda" },
  { id: "engajamento", label: "Engajamento" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  NOVA: "Nova",
  FAVORITA: "Favorita",
  DESCARTADA: "Descartada",
  PRODUZIDA: "Produzida",
};

interface Idea {
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

interface GeneratedIdea {
  title: string;
  format?: string;
  objective?: string;
  context?: string;
  rationale?: string;
}

interface IdeasClientProps {
  aiConfigured: boolean;
  initialIdeas: Idea[];
}

export function IdeasClient({ aiConfigured, initialIdeas }: IdeasClientProps) {
  const { toast } = useToast();

  const [category, setCategory] = React.useState<string>("reels");
  const [count, setCount] = React.useState(3);
  const [ideas, setIdeas] = React.useState<Idea[]>(initialIdeas);
  const [generated, setGenerated] = React.useState<GeneratedIdea[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<"gerar" | "salvas">("gerar");

  if (!aiConfigured) {
    return (
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
        <EmptyState
          icon={Lightbulb}
          title="IA ainda não configurada"
          description="Para gerar ideias de conteúdo, adicione uma chave de API (OpenAI ou Gemini) nas variáveis de ambiente. Nada é simulado."
        />
      </div>
    );
  }

  async function runGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.message ?? data.error ?? "Erro ao gerar ideias.", "error");
        return;
      }
      setGenerated(data.ideas);
    } catch {
      toast("Não foi possível gerar ideias.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(idea: GeneratedIdea) {
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: idea.title,
          format: idea.format ?? "",
          objective: idea.objective ?? "",
          context: idea.context ?? "",
          rationale: idea.rationale ?? "",
          platform: category === "tiktok" ? "tiktok" : "instagram",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar.", "error");
        return;
      }
      setIdeas((prev) => [data.idea, ...prev]);
      toast("Ideia salva!");
    } catch {
      toast("Erro ao salvar.", "error");
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      const res = await fetch(
        `/api/ideas?id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`,
        { method: "PATCH" }
      );
      if (!res.ok) {
        toast("Erro ao atualizar.", "error");
        return;
      }
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      toast(STATUS_LABEL[status] ?? "Atualizado.");
    } catch {
      toast("Erro ao atualizar.", "error");
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/ideas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Erro ao excluir.", "error");
        return;
      }
      setIdeas((prev) => prev.filter((i) => i.id !== id));
      toast("Ideia excluída.");
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  const catLabel = (id: string) =>
    CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        tabs={[
          { id: "gerar", label: "Gerar ideias" },
          { id: "salvas", label: `Salvas (${ideas.length})` },
        ]}
        activeId={view}
        onChange={(v) => setView(v as "gerar" | "salvas")}
      />

      {view === "gerar" ? (
        <div className="flex flex-col gap-5">
          {/* Controles */}
          <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                      category === c.id
                        ? "bg-ai-soft border-purple/40 text-purple"
                        : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[12.5px] font-semibold text-ink-soft">
                  Quantidade
                </label>
                {[1, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={cn(
                      "w-8 h-8 rounded-[10px] border text-[13px] font-bold transition-all cursor-pointer",
                      count === n
                        ? "bg-purple text-white border-purple"
                        : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button onClick={runGenerate} disabled={loading} className="gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? "Gerando..." : "Gerar ideias"}
              </Button>
            </div>
          </div>

          {/* Resultado */}
          <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
            {generated.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="Nenhuma ideia ainda"
                description="Escolha uma categoria e clique em Gerar ideias. As sugestões são baseadas apenas no seu perfil real."
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[15.5px] font-bold text-ink">
                    {catLabel(category)}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={runGenerate} disabled={loading}>
                    <RefreshCw size={15} /> Regenerar
                  </Button>
                </div>
                {generated.map((idea, idx) => (
                  <div
                    key={idx}
                    className="rounded-[12px] border border-border-soft bg-bg-ice p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13.5px] font-bold text-ink">{idea.title}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {idea.format && (
                            <span className="text-[11px] font-semibold text-purple bg-ai-soft rounded-pill px-2 py-0.5">
                              {idea.format}
                            </span>
                          )}
                          {idea.objective && (
                            <span className="text-[11px] font-semibold text-ink-soft bg-surface rounded-pill px-2 py-0.5">
                              {idea.objective}
                            </span>
                          )}
                        </div>
                        {idea.context && (
                          <p className="text-[12.5px] text-ink-soft leading-relaxed">
                            {idea.context}
                          </p>
                        )}
                        {idea.rationale && (
                          <p className="text-[12px] text-purple leading-relaxed bg-ai-soft rounded-[8px] px-2.5 py-1.5">
                            Por que esta ideia: {idea.rationale}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleSave(idea)}>
                        <Save size={14} /> Salvar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Salvas */
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          {ideas.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="Nenhuma ideia salva"
              description="Gere ideias e salve as melhores para acompanhar aqui."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="rounded-[12px] border border-border-soft bg-bg-ice p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                          {idea.platform}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                          {catLabel(idea.category)}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-bold rounded-pill px-2 py-0.5",
                            idea.status === "PRODUZIDA" && "bg-success/10 text-success",
                            idea.status === "FAVORITA" && "bg-warn/10 text-warn",
                            idea.status === "DESCARTADA" && "bg-surface text-ink-muted",
                            idea.status === "NOVA" && "bg-ai-soft text-purple"
                          )}
                        >
                          {STATUS_LABEL[idea.status] ?? idea.status}
                        </span>
                      </div>
                      <span className="text-[14px] font-bold text-ink">{idea.title}</span>
                      {idea.context && (
                        <p className="text-[12.5px] text-ink-soft leading-relaxed">
                          {idea.context}
                        </p>
                      )}
                      {idea.rationale && (
                        <p className="text-[12px] text-purple leading-relaxed bg-ai-soft rounded-[8px] px-2.5 py-1.5">
                          Por que esta ideia: {idea.rationale}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      <button
                        onClick={() =>
                          (window.location.href = `/calendario?planejar=${encodeURIComponent(idea.id)}`)
                        }
                        className="p-1.5 rounded-[8px] text-ink-muted hover:text-purple cursor-pointer"
                        aria-label="Planejar no calendário"
                        title="Planejar no calendário"
                      >
                        <CalendarDays size={16} />
                      </button>
                      <button
                        onClick={() => setStatus(idea.id, "FAVORITA")}
                        className={cn(
                          "p-1.5 rounded-[8px] cursor-pointer transition-colors",
                          idea.status === "FAVORITA"
                            ? "text-warn"
                            : "text-ink-muted hover:text-warn"
                        )}
                        aria-label="Favoritar"
                      >
                        <Star size={16} fill={idea.status === "FAVORITA" ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => setStatus(idea.id, "PRODUZIDA")}
                        className="p-1.5 rounded-[8px] text-ink-muted hover:text-success cursor-pointer"
                        aria-label="Marcar como produzida"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        onClick={() => setStatus(idea.id, "DESCARTADA")}
                        className="p-1.5 rounded-[8px] text-ink-muted hover:text-ink cursor-pointer"
                        aria-label="Descartar"
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => remove(idea.id)}
                        className="p-1.5 rounded-[8px] text-ink-muted hover:text-danger cursor-pointer"
                        aria-label="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
