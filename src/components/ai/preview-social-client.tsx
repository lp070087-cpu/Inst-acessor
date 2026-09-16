"use client";

import * as React from "react";
import {
  Eye,
  Image as ImageIcon,
  Clapperboard,
  Save,
  Trash2,
  Eraser,
  Loader2,
  UploadCloud,
  Sparkles,
  RefreshCw,
  Copy as CopyIcon,
  Check,
  Star,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * PREVIEW SOCIAL — CENTRAL DE CRIAÇÃO
 * ===================================
 * O módulo "Gerador de Copy" foi INCORPORADO aqui: gerar a legenda com IA,
 * editar, marcar hashtags, ver no mockup e salvar rascunho acontecem na mesma
 * tela.
 *
 * O motor de copy NÃO foi duplicado. Esta tela chama a MESMA rota que o
 * Gerador usava — `POST /api/ai/generate-copy` → `generateCopy()` — apenas
 * enviando também a plataforma e o formato selecionados aqui.
 *
 * Continuam valendo as verdades já estabelecidas: nada é publicado, nada é
 * enviado à Meta/TikTok, e nenhuma prévia é simulada com dado inventado.
 */

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
] as const;

const FORMATS = [
  { id: "post", label: "Post" },
  { id: "reel", label: "Reel" },
  { id: "story", label: "Story" },
  { id: "carrossel", label: "Carrossel" },
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

interface Draft {
  id: string;
  platform: string;
  mediaType: string;
  mediaUrl: string;
  caption: string;
  hashtags: string;
  format: string;
  updatedAt: string;
}

interface SavedCopy {
  id: string;
  platform: string;
  format: string;
  content: string;
  isFavorite: boolean;
  createdAt: string;
}

interface PreviewSocialProps {
  aiConfigured: boolean;
  initialDrafts: Draft[];
  initialSaved: SavedCopy[];
}

/**
 * Mesmo teto do `saveDraftSchema.mediaUrl` no servidor. O rascunho guarda a
 * mídia em base64, então este é o limite prático para que o arquivo entre no
 * banco — acima disso ele vive só no preview local.
 */
const MAX_MEDIA_URL = 2_000_000;

/** Lê um arquivo como data URL (usado para vídeo, que não é redimensionado). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

/** Redimensiona imagem local para caber no preview (data URL ≤ ~1.2MB). */
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export function PreviewSocial({ aiConfigured, initialDrafts, initialSaved }: PreviewSocialProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  const [format, setFormat] = React.useState<string>("post");
  const [mediaUrl, setMediaUrl] = React.useState<string>("");
  const [mediaType, setMediaType] = React.useState<"image" | "video">("image");
  /**
   * `true` quando a mídia é válida para o PREVIEW local mas grande demais para
   * ir ao banco em base64. Nesse caso o rascunho é salvo sem o arquivo — melhor
   * do que estourar o limite do schema e devolver um erro incompreensível.
   */
  const [mediaOversize, setMediaOversize] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>(initialDrafts);
  const [savedCopies, setSavedCopies] = React.useState<SavedCopy[]>(initialSaved);
  const [view, setView] = React.useState<"criar" | "salvos" | "biblioteca">("criar");
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // ---- Campos de criação de copy ----
  const [objective, setObjective] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [context, setContext] = React.useState("");
  const [tone, setTone] = React.useState<string>("casual");
  const [size, setSize] = React.useState<string>("medio");
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  /**
   * Guarda o texto que a IA devolveu por último. Se a legenda atual for
   * diferente disso, houve edição manual — e nesse caso "Gerar com IA" pede
   * confirmação antes de sobrescrever.
   */
  const [lastGenerated, setLastGenerated] = React.useState<string>("");

  const captionEdited = caption.length > 0 && caption !== lastGenerated;

  /** Carrega um rascunho de volta no editor. */
  function loadDraft(d: Draft) {
    setPlatform(d.platform);
    setFormat(d.format || "post");
    setMediaUrl(d.mediaUrl);
    setMediaType(d.mediaType === "video" ? "video" : "image");
    setMediaOversize(false);
    setCaption(d.caption);
    setHashtags(d.hashtags);
    setLastGenerated("");
    setView("criar");
    toast("Rascunho carregado no editor.");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    try {
      const url = isVideo
        ? await readAsDataUrl(file)
        : await downscaleImage(file);

      // O banco guarda o rascunho em base64, então o schema limita o tamanho
      // (`saveDraftSchema.mediaUrl`). A imagem é reduzida no canvas e quase
      // sempre cabe; vídeo não é reduzido, então avisamos ANTES de salvar em
      // vez de deixar o salvamento falhar com erro de validação.
      const oversize = url.length > MAX_MEDIA_URL;
      setMediaOversize(oversize);
      setMediaType(isVideo ? "video" : "image");
      setMediaUrl(url);

      if (oversize) {
        toast("Mídia grande: aparece no preview, mas será salva sem o arquivo.");
      } else {
        toast("Mídia adicionada ao preview.");
      }
    } catch {
      toast("Não foi possível carregar o arquivo.", "error");
    } finally {
      // Permite escolher o MESMO arquivo de novo depois de limpar.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearAll() {
    setMediaUrl("");
    setMediaOversize(false);
    setCaption("");
    setHashtags("");
    setFormat("post");
    setObjective("");
    setAudience("");
    setContext("");
    setLastGenerated("");
  }

  /** Chama o MOTOR existente do Gerador de Copy (mesma rota, sem duplicação). */
  async function generateWithAI() {
    if (!aiConfigured) {
      toast("A IA ainda não foi configurada.", "error");
      return;
    }

    // Não sobrescreve edição manual sem avisar. Confirmação simples — sem
    // sistema de versionamento.
    if (captionEdited) {
      const ok = window.confirm(
        "Você editou a legenda manualmente. Gerar uma nova copy vai substituir esse texto. Continuar?"
      );
      if (!ok) return;
    }

    setGenerating(true);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          // O motor normaliza `post`/`feed` → `legenda` e entende o formato.
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

      const content: string = data.content ?? "";
      // Separa as hashtags que o motor sugerir no fim do texto, para o campo
      // próprio — o preview mostra os dois separados, como numa legenda real.
      const { body, tags } = splitHashtags(content);
      setCaption(body);
      setLastGenerated(body);
      if (tags && !hashtags.trim()) setHashtags(tags);
      toast("Copy gerada. Edite à vontade.");
    } catch {
      toast("Não foi possível gerar a copy.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function copyCaption() {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(
        hashtags.trim() ? `${caption}\n\n${hashtags.trim()}` : caption
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Legenda copiada!");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          mediaType,
          // Mídia grande não vai ao banco: o rascunho guarda legendas,
          // hashtags e formato, e o arquivo continua só no preview local.
          mediaUrl: mediaOversize ? "" : mediaUrl,
          caption,
          hashtags,
          format,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar.", "error");
        return;
      }
      setDrafts((prev) => [data.draft, ...prev]);
      toast(
        mediaOversize
          ? "Rascunho salvo sem o arquivo (mídia grande demais para guardar)."
          : "Rascunho salvo!"
      );
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setLoading(false);
    }
  }

  /** Salva a legenda na biblioteca de copies (mesma API do Gerador). */
  async function saveCopyToLibrary() {
    if (!caption.trim()) {
      toast("Não há legenda para salvar.", "error");
      return;
    }
    try {
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          format: format === "post" ? "legenda" : format,
          objective,
          tone,
          audience,
          context,
          content: hashtags.trim() ? `${caption}\n\n${hashtags.trim()}` : caption,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar.", "error");
        return;
      }
      setSavedCopies((prev) => [data.copy, ...prev]);
      toast("Legenda salva na biblioteca!");
    } catch {
      toast("Erro ao salvar.", "error");
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/drafts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Erro ao excluir.", "error");
        return;
      }
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast("Rascunho excluído.");
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  async function toggleFavoriteCopy(id: string) {
    try {
      const res = await fetch(`/api/copy?id=${encodeURIComponent(id)}`, { method: "PATCH" });
      if (!res.ok) return;
      setSavedCopies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
      );
    } catch {
      /* silencioso */
    }
  }

  async function removeCopy(id: string) {
    try {
      const res = await fetch(`/api/copy?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Erro ao excluir.", "error");
        return;
      }
      setSavedCopies((prev) => prev.filter((c) => c.id !== id));
      toast("Legenda excluída.");
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  /** Restaura uma copy salva para o editor. */
  function loadCopy(content: string, p: string, f: string) {
    const { body, tags } = splitHashtags(content);
    setCaption(body);
    setLastGenerated("");
    if (tags) setHashtags(tags);
    setPlatform(p === "tiktok" ? "tiktok" : "instagram");
    setFormat(f === "legenda" ? "post" : f);
    setView("criar");
    toast("Legenda carregada no editor.");
  }

  const formatLabel = FORMATS.find((f) => f.id === format)?.label ?? format;
  const platformLabel = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
  const tags = hashtags
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const inputCls =
    "h-11 rounded-[12px] border border-border bg-bg-ice px-3.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow";

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        tabs={[
          { id: "criar", label: "Criar" },
          { id: "salvos", label: `Rascunhos (${drafts.length})` },
          { id: "biblioteca", label: `Legendas salvas (${savedCopies.length})` },
        ]}
        activeId={view}
        onChange={(v) => setView(v as "criar" | "salvos" | "biblioteca")}
      />

      {view === "criar" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* ============ COLUNA DE CRIAÇÃO ============ */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* --- 1. Plataforma + Formato --- */}
            <div className="rounded-lg bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-4">
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
                        "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                        format === f.id
                          ? "bg-ai-soft border-purple/40 text-purple"
                          : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11.5px] text-ink-muted">
                  O formato muda o que a IA escreve: um Story curto não é uma legenda longa de feed.
                </p>
              </div>

              {/* Upload local */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-ink-soft">
                  Mídia (upload local)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={onFile}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-6 text-[13.5px] font-semibold transition-colors cursor-pointer",
                    mediaUrl
                      ? "border-success/40 text-success bg-success/5"
                      : "border-border text-ink-soft hover:border-purple/40 hover:text-purple"
                  )}
                >
                  <UploadCloud size={18} />
                  {mediaUrl ? "Trocar mídia" : "Escolher imagem ou vídeo do seu computador"}
                </button>
                {mediaOversize && (
                  <p className="text-[11.5px] text-warn">
                    Arquivo grande: aparece no preview, mas o rascunho será salvo sem ele.
                  </p>
                )}
                {mediaUrl && (
                  <div className="grid place-items-center">
                    {mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt="Preview da mídia"
                        className="max-h-52 rounded-[12px] border border-border-soft object-contain"
                      />
                    ) : (
                      <video src={mediaUrl} className="max-h-52 rounded-[12px]" controls muted />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- 2. Briefing + Gerar com IA --- */}
            <div className="rounded-lg bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple" />
                <h3 className="font-display text-[15px] font-bold text-ink">
                  Briefing da criação
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-semibold text-ink-soft">Objetivo</label>
                  <input
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="Ex.: divulgar novo produto"
                    maxLength={200}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-semibold text-ink-soft">Público</label>
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Ex.: mulheres 25-40 que amam moda"
                    maxLength={200}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-ink-soft">Contexto</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="O que acontece neste conteúdo? Detalhes que a IA deve considerar..."
                  rows={2}
                  maxLength={400}
                  className={cn(inputCls, "h-auto py-2.5 resize-none")}
                />
              </div>

              {/* Tom/Tamanho ficam recolhidos para não poluir a criação simples. */}
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12.5px] font-semibold text-ink-soft">Tom</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className={inputCls}
                    >
                      {TONES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12.5px] font-semibold text-ink-soft">Tamanho</label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className={inputCls}
                    >
                      {SIZES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-[12px] font-semibold text-ink-muted hover:text-purple transition-colors cursor-pointer self-start"
              >
                {showAdvanced ? "− Ocultar tom e tamanho" : "+ Ajustar tom e tamanho"}
              </button>

              <Button
                onClick={generateWithAI}
                disabled={generating || !aiConfigured}
                className="gap-2 w-full"
                title={
                  aiConfigured
                    ? undefined
                    : "Adicione uma chave de API (OpenAI ou Gemini) para liberar a geração."
                }
              >
                {generating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {generating ? "Gerando..." : "Gerar com IA"}
              </Button>

              {!aiConfigured && (
                <p className="text-[12px] text-ink-muted text-center">
                  IA ainda não configurada — nada é simulado enquanto isso.
                </p>
              )}
            </div>

            {/* --- 3. Legenda + Hashtags --- */}
            <div className="rounded-lg bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="text-[12.5px] font-semibold text-ink-soft">
                  Legenda / Copy
                </label>
                <div className="flex items-center gap-3">
                  {captionEdited && (
                    <span className="text-[11.5px] text-ink-muted">editada por você</span>
                  )}
                  {caption && (
                    <button
                      onClick={copyCaption}
                      className="text-[12px] font-semibold text-ink-muted hover:text-purple transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {copied ? <Check size={13} /> : <CopyIcon size={13} />}
                      {copied ? "Copiada" : "Copiar"}
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={7}
                maxLength={2200}
                placeholder="Escreva a legenda ou gere com IA. Você pode editar livremente depois."
                className={cn(inputCls, "h-auto py-3 resize-y leading-relaxed")}
              />

              {caption && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={generateWithAI}
                    disabled={generating || !aiConfigured}
                    className="gap-1.5"
                  >
                    <RefreshCw size={13} /> Regenerar
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={saveCopyToLibrary}
                    className="gap-1.5"
                  >
                    <Save size={13} /> Salvar na biblioteca
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-ink-soft">Hashtags</label>
                <input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="Ex.: #moda #acessorios"
                  maxLength={500}
                  className={inputCls}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={handleSave} disabled={loading} className="gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar rascunho
                </Button>
                <Button variant="ghost" onClick={clearAll} className="gap-2">
                  <Eraser size={16} /> Limpar
                </Button>
              </div>
            </div>
          </div>

          {/* ============ PREVIEW ============ */}
          <div className="flex flex-col items-center gap-4 lg:sticky lg:top-4 lg:self-start">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              <Eye size={15} className="text-purple" />
              Preview · {platformLabel} · {formatLabel}
            </div>

            {/* Largura fluida: era `w-[300px]` fixo e, somado ao `border-[10px]`,
                o mockup media 320px — estourava a viewport em telas de 320/360px.
                Com `w-full max-w-[300px]` ele encolhe dentro do container. */}
            <div className="relative w-full max-w-[300px] rounded-[40px] border-[10px] border-ink bg-ink shadow-brand-lg overflow-hidden">
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-ink rounded-full z-20" />

              {/* Altura responsiva: 540px fixos eram altos demais em telas
                  baixas (celular na horizontal, ~360px de altura útil). A
                  área de mídia é `flex-1`, então ela se ajusta sozinha. */}
              <div className="relative h-[440px] sm:h-[540px] bg-bg-ice flex flex-col">
                {/* Header do perfil */}
                <div className="flex items-center gap-2.5 px-4 pt-9 pb-2">
                  <span className="w-8 h-8 rounded-full bg-brand-grad grid place-items-center text-[11px] font-bold text-white">
                    IA
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink truncate min-w-0">
                    Inst Acessor
                  </span>
                  {format === "story" && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      Story
                    </span>
                  )}
                </div>

                {/* Mídia */}
                <div className="flex-1 bg-surface grid place-items-center overflow-hidden">
                  {mediaUrl ? (
                    mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt="Mídia"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-ink-muted px-6 text-center">
                      <ImageIcon size={26} />
                      <span className="text-[12px]">
                        Adicione uma mídia para visualizar o preview.
                      </span>
                    </div>
                  )}
                </div>

                {/* Caption + hashtags */}
                {(caption || tags.length > 0) && (
                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {caption && (
                      /* BLOCO 5 — a legenda é escrita à mão e pode trazer uma
                         palavra sem ponto de quebra. Dentro do mockup (proporção
                         fixa) isso empurrava a borda: `break-words` mantém a
                         legenda contida na largura do aparelho. */
                      <p className="text-[12px] text-ink leading-snug line-clamp-4 whitespace-pre-wrap break-words">
                        {caption}
                      </p>
                    )}
                    {tags.length > 0 && (
                      /* BLOCO 5 — uma hashtag longa sem espaços não pode
                         alargar o mockup: `break-words` a quebra dentro do
                         próprio bloco de legenda. */
                      <p className="text-[12px] text-[#00376B] font-medium break-words">
                        {tags.join(" ")}
                      </p>
                    )}
                  </div>
                )}

                {/* Barra inferior */}
                <div className="px-4 py-2 border-t border-border-soft flex items-center justify-between">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Clapperboard size={15} />
                    <span className="text-[10.5px] font-semibold">
                      {format === "story" ? "Story" : format === "reel" ? "Reel" : "Publicação"}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-ink-muted">Pré-visualização</span>
                </div>
              </div>
            </div>

            <p className="text-[12px] text-ink-muted text-center max-w-[280px]">
              Apenas pré-visualização local. Nada é publicado nem enviado a
              Meta/TikTok.
            </p>
          </div>
        </div>
      )}

      {view === "salvos" && (
        /* Rascunhos salvos */
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          {drafts.length === 0 ? (
            <EmptyState
              icon={Save}
              title="Nenhum rascunho salvo"
              description="Crie um preview e salve para encontrar aqui depois."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="rounded-[12px] border border-border-soft bg-bg-ice p-4 flex items-start gap-3"
                >
                  {d.mediaUrl ? (
                    d.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.mediaUrl}
                        alt=""
                        className="w-16 h-16 rounded-[10px] object-cover flex-none"
                      />
                    ) : (
                      <video
                        src={d.mediaUrl}
                        className="w-16 h-16 rounded-[10px] object-cover flex-none"
                        muted
                      />
                    )
                  ) : (
                    <span className="w-16 h-16 rounded-[10px] bg-surface grid place-items-center text-ink-muted flex-none">
                      <ImageIcon size={20} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        {d.platform}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                        {FORMATS.find((f) => f.id === d.format)?.label ?? d.format}
                      </span>
                    </div>
                    {d.caption && (
                      <p className="text-[13px] text-ink leading-snug line-clamp-2 mt-1 whitespace-pre-wrap break-words">
                        {d.caption}
                      </p>
                    )}
                    <button
                      onClick={() => loadDraft(d)}
                      className="text-[12px] font-semibold text-purple hover:underline cursor-pointer mt-1.5"
                    >
                      Abrir no editor
                    </button>
                  </div>
                  <button
                    onClick={() => remove(d.id)}
                    className="p-1.5 rounded-[8px] text-ink-muted hover:text-danger cursor-pointer flex-none"
                    aria-label="Excluir rascunho"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "biblioteca" && (
        /* Legendas salvas — antigo "Histórico" do Gerador de Copy */
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          {savedCopies.length === 0 ? (
            <EmptyState
              icon={Save}
              title="Nenhuma legenda salva"
              description="Gere uma copy e clique em Salvar na biblioteca para encontrar aqui depois."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {savedCopies.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-[12px] border border-border-soft bg-bg-ice p-4"
                >
                  {/* BLOCO 5 — `min-w-0 flex-1` na coluna dos rótulos: é ela
                      que encolhe quando o rótulo do formato é longo; sem isso
                      a coluna empurrava os ícones de favoritar/excluir para
                      fora do card. */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        {c.platform}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                        {FORMATS.find((f) => f.id === c.format)?.label ?? c.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      <button
                        onClick={() => toggleFavoriteCopy(c.id)}
                        className={cn(
                          "p-1.5 rounded-[8px] cursor-pointer transition-colors",
                          c.isFavorite ? "text-warn" : "text-ink-muted hover:text-warn"
                        )}
                        aria-label="Favoritar"
                      >
                        <Star size={16} fill={c.isFavorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => removeCopy(c.id)}
                        className="p-1.5 rounded-[8px] text-ink-muted hover:text-danger cursor-pointer"
                        aria-label="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[13.5px] text-ink whitespace-pre-wrap line-clamp-4 break-words">
                    {c.content}
                  </p>
                  <button
                    onClick={() => loadCopy(c.content, c.platform, c.format)}
                    className="text-[12px] font-semibold text-purple hover:underline cursor-pointer self-start"
                  >
                    Abrir no editor
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Separa as hashtags que vierem no fim do texto gerado.
 * Só mexe quando elas estão AGRUPADAS no final — hashtag no meio de uma frase
 * faz parte da frase e não é removida.
 */
function splitHashtags(content: string): { body: string; tags: string } {
  const lines = content.split("\n");
  const tagLine = /^\s*(?:#[\p{L}\p{N}_]+\s*)+$/u;

  let cut = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "") {
      cut = i;
      continue;
    }
    if (tagLine.test(line)) {
      cut = i;
      continue;
    }
    break;
  }

  if (cut >= lines.length) return { body: content.trim(), tags: "" };

  const tags = lines
    .slice(cut)
    .join(" ")
    .split(/\s+/)
    .filter((t) => t.startsWith("#"))
    .join(" ");

  return { body: lines.slice(0, cut).join("\n").trim(), tags };
}
