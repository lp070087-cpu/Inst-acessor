"use client";

import * as React from "react";
import {
  BrainCircuit,
  Users,
  Tag,
  MessageSquare,
  PenLine,
  MousePointerClick,
  LayoutGrid,
  CalendarClock,
  Sparkles,
  TrendingUp,
  Image as ImageIcon,
  Gauge,
  Info,
  Pencil,
  RefreshCw,
  Loader2,
  X,
  Check,
  Database,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  LearnedProfileData,
  LearnedCard,
  LearnedSource,
  AIProfileField,
} from "@/lib/ai/services";

/**
 * "A IA APRENDEU SOBRE VOCÊ"
 * ==========================
 * Vive DENTRO do Perfil de Inteligência. Cada card mostra SOMENTE o que os
 * dados reais sustentam; quando falta fonte, o card traz um estado explícito
 * de "ainda não temos dados" — nunca um valor inventado.
 *
 * O usuário pode CORRIGIR o que a IA registrou (persistido em AIProfile) e
 * pedir uma "Atualização do aprendizado", que fala com a IA a partir dos dados
 * reais. O botão respeita a configuração da IA e um intervalo mínimo.
 */

const CARD_ICON: Record<string, LucideIcon> = {
  summary: BrainCircuit,
  audience: Users,
  niche: Tag,
  voiceTone: MessageSquare,
  writingStyle: PenLine,
  ctaPatterns: MousePointerClick,
  preferredFormats: LayoutGrid,
  postingFrequency: CalendarClock,
  hookPatterns: Sparkles,
  audienceReaction: TrendingUp,
  visualStyle: ImageIcon,
  performancePatterns: Gauge,
};

const SOURCE_LABEL: Record<LearnedSource, string> = {
  ai: "Aprendido pela IA",
  declared: "Informado por você",
  observed: "Observado nos dados",
  user: "Corrigido por você",
};

const SOURCE_CLASS: Record<LearnedSource, string> = {
  ai: "bg-ai-soft text-purple",
  declared: "bg-info-soft text-info",
  observed: "bg-success-soft text-success",
  user: "bg-surface text-ink-soft",
};

/** Campos extras, fora dos cards principais. */
const EXTRA_FIELDS: { field: AIProfileField; label: string }[] = [
  { field: "subNiche", label: "Subnicho" },
  { field: "objectives", label: "Objetivos" },
  { field: "communicationStyle", label: "Estilo de comunicação" },
  { field: "notes", label: "Anotações" },
];

interface PerfilInteligenciaProps {
  data: LearnedProfileData;
}

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dOnly = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Milissegundos até o próximo aprendizado permitido (0 = liberado). */
function msUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return "menos de 1 min";
}

export function PerfilInteligenciaClient({ data }: PerfilInteligenciaProps) {
  const [cards, setCards] = React.useState<LearnedCard[]>(data.cards);
  const [fields, setFields] = React.useState<Record<AIProfileField, string>>(data.profileFields);
  const [learnedAt, setLearnedAt] = React.useState<string | null>(data.learnedAt);
  const [nextAllowedAt, setNextAllowedAt] = React.useState<string | null>(data.nextAllowedAt);

  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [learning, setLearning] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  // Contador regressivo do intervalo mínimo (atualiza a cada 30s).
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const applyData = React.useCallback((next: LearnedProfileData) => {
    setCards(next.cards);
    setFields(next.profileFields);
    setLearnedAt(next.learnedAt);
    setNextAllowedAt(next.nextAllowedAt);
  }, []);

  const startEdit = (card: LearnedCard) => {
    if (!card.field) return;
    setEditingKey(card.key);
    setDraft(card.value ?? fields[card.field] ?? "");
    setError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft("");
  };

  const saveEdit = async (card: LearnedCard) => {
    if (!card.field) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [card.field]: draft }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; data?: LearnedProfileData }
        | null;
      if (!res.ok || !json?.data) {
        setError(json?.error ?? "Não foi possível salvar a correção.");
        setSaving(false);
        return;
      }
      applyData(json.data);
      setEditingKey(null);
      setDraft("");
      setNotice({ tone: "ok", text: "Correção salva. A IA vai usar isto como você definiu." });
    } catch {
      setError("Não foi possível salvar a correção. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const runLearning = async () => {
    setLearning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/profile/learn", { method: "POST" });
      const json = (await res.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            nextAllowedAt?: string;
            patternsAdded?: number;
            fieldsFilled?: string[];
            data?: LearnedProfileData;
          }
        | null;

      if (res.ok && json?.data) {
        applyData(json.data);
        const parts: string[] = [];
        if (json.fieldsFilled?.length) parts.push(`${json.fieldsFilled.length} campo(s) atualizado(s)`);
        if (json.patternsAdded) parts.push(`${json.patternsAdded} padrão(ões) observado(s) salvo(s)`);
        setNotice({
          tone: "ok",
          text: parts.length
            ? `Aprendizado atualizado: ${parts.join(", ")}.`
            : "Aprendizado atualizado com os dados disponíveis.",
        });
        return;
      }

      if (res.status === 503) {
        setNotice({ tone: "warn", text: json?.message ?? "A IA ainda não foi configurada." });
      } else if (res.status === 429) {
        if (json?.nextAllowedAt) setNextAllowedAt(json.nextAllowedAt);
        setNotice({ tone: "warn", text: json?.message ?? "Aguarde antes de atualizar novamente." });
      } else {
        setNotice({ tone: "err", text: json?.message ?? "Não foi possível atualizar o aprendizado." });
      }
    } catch {
      setNotice({ tone: "err", text: "Não foi possível atualizar o aprendizado agora." });
    } finally {
      setLearning(false);
    }
  };

  const remaining = msUntil(nextAllowedAt);
  const blockedByInterval = remaining > 0;
  const learnDisabled = learning || !data.aiConfigured || blockedByInterval;

  const extras = EXTRA_FIELDS.filter(({ field }) => (fields[field] ?? "").trim().length > 0);

  return (
    <section className="flex flex-col gap-5" aria-labelledby="ia-aprendeu-title">
      {/* Cabeçalho da seção */}
      <div className="rounded-lg bg-brand-grad-soft border border-border-soft shadow-xs p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-[14px] bg-card shadow-xs grid place-items-center text-purple flex-none">
            <Sparkles size={22} strokeWidth={1.9} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="ia-aprendeu-title" className="font-display text-[17px] font-bold text-ink">
              A IA aprendeu sobre você
            </h2>
            <p className="text-[13px] text-ink-soft max-w-xl leading-relaxed">
              Tudo aqui vem apenas de dados reais da sua conta e do que você mesmo informou. Quando
              falta base, mostramos isso com honestidade — nada é inventado.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            onClick={runLearning}
            disabled={learnDisabled}
            size="sm"
            variant="primary"
            title={
              !data.aiConfigured
                ? "A IA ainda não foi configurada"
                : blockedByInterval
                  ? `Disponível em ${formatRemaining(remaining)}`
                  : "Gerar um resumo a partir dos seus dados reais"
            }
          >
            {learning ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {learning ? "Atualizando…" : "Atualizar aprendizado"}
          </Button>
          <span className="text-[11.5px] text-ink-muted text-right max-w-[240px]">
            {!data.aiConfigured
              ? "Indisponível: a IA ainda não foi configurada pelo administrador."
              : blockedByInterval
                ? `Para controlar custo, o próximo aprendizado libera em ${formatRemaining(remaining)}.`
                : "Usa a IA configurada. Limitado a uma atualização a cada 6 horas por conta."}
          </span>
        </div>
      </div>

      {/* Avisos */}
      {notice && (
        <div
          role="status"
          className={cn(
            "rounded-[12px] border px-4 py-3 text-[13px] flex items-start gap-2",
            notice.tone === "ok" && "bg-success-soft border-success/25 text-ink",
            notice.tone === "warn" && "bg-warn-soft border-warn/25 text-ink",
            notice.tone === "err" && "bg-danger-soft border-danger/25 text-ink"
          )}
        >
          <Info size={15} className="mt-0.5 flex-none" />
          <span className="leading-relaxed">{notice.text}</span>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = CARD_ICON[card.key] ?? BrainCircuit;
          const empty = !card.value || !card.value.trim();
          const editing = editingKey === card.key;

          return (
            <article
              key={card.key}
              className="rounded-lg bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-[12px] bg-ai-soft text-purple grid place-items-center flex-none">
                    <Icon size={17} strokeWidth={1.9} />
                  </span>
                  <h3 className="font-display text-[14px] font-semibold text-ink truncate">
                    {card.label}
                  </h3>
                </div>
                {!empty && !editing && (
                  <span
                    className={cn(
                      "text-[10.5px] font-semibold uppercase tracking-wide rounded-pill px-2 py-1 flex-none",
                      SOURCE_CLASS[card.source]
                    )}
                  >
                    {SOURCE_LABEL[card.source]}
                  </span>
                )}
              </header>

              {editing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={5}
                    autoFocus
                    className="w-full rounded-[10px] border border-border bg-bg-ice px-3 py-2 text-[13px] text-ink leading-relaxed outline-none focus:border-purple/40 focus:ring-2 focus:ring-ai-soft resize-y"
                    placeholder="Escreva aqui o valor correto. Deixe vazio para limpar."
                  />
                  <div className="flex items-center gap-2">
                    <Button size="xs" onClick={() => saveEdit(card)} disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Salvar
                    </Button>
                    <Button size="xs" variant="outline" onClick={cancelEdit} disabled={saving}>
                      <X size={14} />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {empty ? (
                    <p className="text-[12.5px] text-ink-muted leading-relaxed flex items-start gap-2">
                      <AlertCircle size={14} className="mt-0.5 flex-none" />
                      <span>{card.emptyReason ?? "Ainda não temos dados suficientes."}</span>
                    </p>
                  ) : (
                    <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-line">
                      {card.value}
                    </p>
                  )}

                  {card.editable && card.field && (
                    <button
                      type="button"
                      onClick={() => startEdit(card)}
                      className="self-start inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-purple hover:text-indigo transition-colors cursor-pointer"
                    >
                      <Pencil size={13} />
                      {empty ? "Definir" : "Corrigir"}
                    </button>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      {/* Campos extras (nicho declarado, objetivos, etc.) */}
      {extras.length > 0 && (
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink">
            Outros dados do seu perfil
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {extras.map(({ field, label }) => (
              <div
                key={field}
                className="rounded-[12px] bg-bg-ice border border-border-soft p-4 flex flex-col gap-1"
              >
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                  {label}
                </span>
                <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-line">
                  {fields[field]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[12.5px] text-danger flex items-center gap-2 px-1">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      {/* Rodapé */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted px-1">
        <span className="inline-flex items-center gap-1.5">
          <Database size={13} />
          {learnedAt
            ? `Aprendizado atualizado em ${dt.format(new Date(learnedAt))}`
            : "O aprendizado ainda não foi executado"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Info size={13} />
          Este perfil é interno e usado apenas para personalizar suas respostas.
        </span>
        {data.hasAnyData && learnedAt && (
          <span className="inline-flex items-center gap-1.5">
            <Check size={13} className="text-success" />
            Última leitura em {dOnly.format(new Date(learnedAt))}.
          </span>
        )}
      </div>
    </section>
  );
}
