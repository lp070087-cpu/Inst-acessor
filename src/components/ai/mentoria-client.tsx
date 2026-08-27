"use client";

import * as React from "react";
import {
  GraduationCap,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
] as const;

const PRIORITY_LABEL: Record<string, string> = {
  ALTA: "Prioridade alta",
  MEDIA: "Prioridade média",
  BAIXA: "Prioridade baixa",
};

const STATUS_LABEL: Record<string, string> = {
  NOVA: "Nova",
  APLICADA: "Aplicada",
  IGNORADA: "Ignorada",
  CONCLUIDA: "Concluída",
};

const CATEGORY_LABEL: Record<string, string> = {
  crescimento: "Crescimento",
  engajamento: "Engajamento",
  frequencia: "Frequência",
  consistencia: "Consistência",
  conteudo: "Conteúdo",
  alcance: "Alcance",
  perfil: "Perfil",
};

interface Card {
  id: string;
  category: string;
  label: string;
  priority: "ALTA" | "MEDIA" | "BAIXA";
  problem: string;
  explanation: string;
  action: string;
  status: string;
  createdAt: string;
}

interface MentoriaClientProps {
  initialCards: Card[];
}

const priorityColor = (p: string) =>
  p === "ALTA"
    ? "bg-danger-soft text-danger"
    : p === "MEDIA"
      ? "bg-warn/10 text-warn"
      : "bg-surface text-ink-soft";

const statusColor = (s: string) =>
  s === "CONCLUIDA"
    ? "bg-success/10 text-success"
    : s === "APLICADA"
      ? "bg-info/10 text-info"
      : s === "IGNORADA"
        ? "bg-surface text-ink-muted"
        : "bg-ai-soft text-purple";

export function MentoriaClient({ initialCards }: MentoriaClientProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  const [cards, setCards] = React.useState<Card[]>(initialCards);
  const [loading, setLoading] = React.useState(false);

  async function runGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/mentoria?platform=${encodeURIComponent(platform)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao gerar recomendações.", "error");
        return;
      }
      setCards((prev) => {
        const existing = new Set(prev.map((c) => c.category));
        const merged = [...prev];
        for (const card of data.cards) {
          if (!existing.has(card.category)) {
            merged.push(card);
            existing.add(card.category);
          }
        }
        return merged;
      });
      toast(data.cards.length > 0 ? "Recomendações geradas!" : "Nenhuma recomendação nova.");
    } catch {
      toast("Não foi possível gerar recomendações.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/mentoria?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast("Erro ao atualizar.", "error");
        return;
      }
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    } catch {
      toast("Erro ao atualizar.", "error");
    }
  }

  const filtered = cards.filter((c) => c.status !== "IGNORADA");

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho de geração */}
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">Plataforma</label>
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={cn(
                  "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                  platform === p.id
                    ? "bg-ai-soft border-purple/40 text-purple"
                    : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-ink-soft max-w-lg">
            As recomendações são geradas a partir do seu diagnóstico real — métricas e
            estrutura. Sem conhecimento proprietário inventado.
          </p>
          <Button onClick={runGenerate} disabled={loading} className="gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Analisando..." : "Gerar recomendações"}
          </Button>
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          <EmptyState
            icon={GraduationCap}
            title="Nenhuma recomendação ainda"
            description="Conecte uma rede social e clique em Gerar recomendações. Quando não houver dados suficientes, nada é recomendado."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((card) => (
            <div
              key={card.id}
              className="rounded-[14px] bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[11px] font-bold rounded-pill px-2.5 py-1", priorityColor(card.priority))}>
                    {PRIORITY_LABEL[card.priority]}
                  </span>
                  <span className="text-[11px] font-bold rounded-pill px-2.5 py-1 bg-surface text-ink-soft">
                    {CATEGORY_LABEL[card.category] ?? card.category}
                  </span>
                  <span className={cn("text-[11px] font-bold rounded-pill px-2.5 py-1", statusColor(card.status))}>
                    {STATUS_LABEL[card.status] ?? card.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="font-display text-[15.5px] font-bold text-ink">{card.label}</h3>
                <p className="text-[13.5px] text-ink-soft leading-relaxed">{card.explanation}</p>
              </div>

              <div className="flex items-start gap-2 rounded-[12px] bg-ai-soft/60 border border-purple/15 px-4 py-3">
                <ArrowRight size={15} className="text-purple mt-0.5 flex-none" />
                <p className="text-[13.5px] text-ink leading-relaxed">{card.action}</p>
              </div>

              {card.status === "NOVA" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatus(card.id, "APLICADA")}
                    className="gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Marcar como aplicada
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatus(card.id, "IGNORADA")}
                    className="gap-1.5"
                  >
                    <X size={14} /> Ignorar
                  </Button>
                </div>
              )}

              {card.status === "APLICADA" && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setStatus(card.id, "CONCLUIDA")}
                    className="gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Concluir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatus(card.id, "NOVA")}
                  >
                    <RefreshCw size={14} /> Reabrir
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-[12.5px] text-ink-muted px-1">
        <AlertTriangle size={14} className="mt-0.5 flex-none" />
        Recomendações são sugestões estruturais baseadas nos seus dados. Não substituem
        decisões de negócio.
      </p>
    </div>
  );
}
