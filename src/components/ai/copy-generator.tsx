"use client";

import * as React from "react";
import {
  Copy as CopyIcon,
  RefreshCw,
  Save,
  Sparkles,
  Star,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
] as const;

const FORMATS = [
  { id: "legenda", label: "Legenda" },
  { id: "reel", label: "Reel" },
  { id: "story", label: "Story" },
  { id: "carrossel", label: "Carrossel" },
  { id: "tiktok", label: "TikTok" },
  { id: "cta", label: "CTA" },
  { id: "headline", label: "Headline" },
  { id: "bio", label: "Bio" },
  { id: "anuncio", label: "Anúncio" },
] as const;

const TONES = [
  { id: "casual", label: "Casual" },
  { id: "profissional", label: "Profissional" },
  { id: "divertido", label: "Divertido" },
  { id: "inspirador", label: "Inspirador" },
  { id: "educativo", label: "Educativo" },
] as const;

const SIZES = [
  { id: "curto", label: "Curto" },
  { id: "medio", label: "Médio" },
  { id: "longo", label: "Longo" },
] as const;

interface SavedCopy {
  id: string;
  platform: string;
  format: string;
  content: string;
  isFavorite: boolean;
  createdAt: string;
}

interface CopyGeneratorProps {
  aiConfigured: boolean;
  initialSaved: SavedCopy[];
}

export function CopyGenerator({ aiConfigured, initialSaved }: CopyGeneratorProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  const [format, setFormat] = React.useState<string>("legenda");
  const [tone, setTone] = React.useState<string>("casual");
  const [size, setSize] = React.useState<string>("medio");
  const [objective, setObjective] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [context, setContext] = React.useState("");

  const [result, setResult] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [saved, setSaved] = React.useState<SavedCopy[]>(initialSaved);
  const [view, setView] = React.useState<"gerar" | "historico">("gerar");

  if (!aiConfigured) {
    return (
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
        <EmptyState
          icon={Sparkles}
          title="IA ainda não configurada"
          description="Para gerar copies, adicione uma chave de API (OpenAI ou Gemini) nas variáveis de ambiente. Enquanto isso, nada é simulado."
        />
      </div>
    );
  }

  async function runGenerate() {
    setLoading(true);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          format,
          objective,
          tone,
          audience,
          context,
          size,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.message ?? data.error ?? "Erro ao gerar copy.", "error");
        return;
      }
      setResult(data.content);
    } catch {
      toast("Não foi possível gerar a copy.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Copy copiada!");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  async function handleSave() {
    if (!result) return;
    try {
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          format,
          objective,
          tone,
          audience,
          context,
          content: result,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar.", "error");
        return;
      }
      setSaved((prev) => [data.copy, ...prev]);
      toast("Copy salva!");
    } catch {
      toast("Erro ao salvar.", "error");
    }
  }

  async function toggleFavorite(id: string) {
    try {
      const res = await fetch(`/api/copy?id=${encodeURIComponent(id)}`, { method: "PATCH" });
      if (!res.ok) return;
      setSaved((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
      );
    } catch {
      /* silencioso */
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/copy?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Erro ao excluir.", "error");
        return;
      }
      setSaved((prev) => prev.filter((c) => c.id !== id));
      toast("Copy excluída.");
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  const inputCls =
    "h-11 rounded-[12px] border border-border bg-bg-ice px-3.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow";

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        tabs={[
          { id: "gerar", label: "Gerar" },
          { id: "historico", label: `Histórico (${saved.length})` },
        ]}
        activeId={view}
        onChange={(v) => setView(v as "gerar" | "historico")}
      />

      {view === "gerar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Formulário */}
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

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Formato</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-pill border text-[12.5px] font-semibold transition-all cursor-pointer",
                      format === f.id
                        ? "bg-ai-soft border-purple/40 text-purple"
                        : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-ink-soft">Tom</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className={inputCls}>
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-ink-soft">Tamanho</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} className={inputCls}>
                  {SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Objetivo</label>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex.: divulgar novo produto"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Público</label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ex.: mulheres 25-40 que amam moda"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Contexto</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={2}
                className={cn(inputCls, "h-auto py-2.5 resize-none")}
              />
            </div>

            <Button onClick={runGenerate} disabled={loading} className="gap-2 w-full">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Gerando..." : "Gerar copy"}
            </Button>
          </div>

          {/* Resultado */}
          <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[15.5px] font-bold text-ink">Resultado</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={runGenerate} disabled={loading}>
                  <RefreshCw size={15} /> Regenerar
                </Button>
              </div>
            </div>

            {result ? (
              <>
                <div className="flex-1 rounded-[12px] bg-surface/50 border border-border-soft p-4 whitespace-pre-wrap text-[14px] leading-relaxed text-ink min-h-[220px]">
                  {result}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check size={15} /> : <CopyIcon size={15} />}
                    {copied ? "Copiada!" : "Copiar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSave}>
                    <Save size={15} /> Salvar
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 grid place-items-center">
                <EmptyState
                  icon={Sparkles}
                  title="Nenhuma copy gerada"
                  description="Preencha os campos e clique em Gerar copy."
                  className="border-none bg-transparent"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Histórico */
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          {saved.length === 0 ? (
            <EmptyState
              icon={Save}
              title="Nenhuma copy salva"
              description="Gere uma copy e salve para encontrar aqui depois."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {saved.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-[12px] border border-border-soft bg-bg-ice p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        {c.platform}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                        {c.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(c.id)}
                        className={cn(
                          "p-1.5 rounded-[8px] cursor-pointer transition-colors",
                          c.isFavorite ? "text-warn" : "text-ink-muted hover:text-warn"
                        )}
                        aria-label="Favoritar"
                      >
                        <Star size={16} fill={c.isFavorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="p-1.5 rounded-[8px] text-ink-muted hover:text-danger cursor-pointer"
                        aria-label="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[13.5px] text-ink whitespace-pre-wrap line-clamp-4">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
