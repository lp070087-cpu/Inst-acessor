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
  { id: "post", label: "Post" },
  { id: "reel", label: "Reel" },
  { id: "story", label: "Story" },
  { id: "carrossel", label: "Carrossel" },
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

interface PreviewSocialProps {
  initialDrafts: Draft[];
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

export function PreviewSocial({ initialDrafts }: PreviewSocialProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  const [format, setFormat] = React.useState<string>("post");
  const [mediaUrl, setMediaUrl] = React.useState<string>("");
  const [mediaType, setMediaType] = React.useState<"image" | "video">("image");
  const [caption, setCaption] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>(initialDrafts);
  const [view, setView] = React.useState<"criar" | "salvos">("criar");
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    try {
      if (isVideo) {
        const reader = new FileReader();
        reader.onload = () => {
          setMediaType("video");
          setMediaUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        const url = await downscaleImage(file);
        setMediaType("image");
        setMediaUrl(url);
      }
      toast("Mídia adicionada ao preview.");
    } catch {
      toast("Não foi possível carregar o arquivo.", "error");
    }
  }

  function clearAll() {
    setMediaUrl("");
    setCaption("");
    setHashtags("");
    setFormat("post");
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
          mediaUrl,
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
      toast("Rascunho salvo!");
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setLoading(false);
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
          { id: "criar", label: "Criar preview" },
          { id: "salvos", label: `Rascunhos (${drafts.length})` },
        ]}
        activeId={view}
        onChange={(v) => setView(v as "criar" | "salvos")}
      />

      {view === "criar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
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
            </div>

            {/* Upload local */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Mídia (upload local)</label>
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
                  "flex items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-8 text-[13.5px] font-semibold transition-colors cursor-pointer",
                  mediaUrl
                    ? "border-success/40 text-success bg-success/5"
                    : "border-border text-ink-soft hover:border-purple/40 hover:text-purple"
                )}
              >
                <UploadCloud size={18} />
                {mediaUrl
                  ? "Trocar mídia"
                  : "Escolher imagem ou vídeo do seu computador"}
              </button>
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

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Legenda</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="Escreva a legenda do post..."
                className={cn(inputCls, "h-auto py-2.5 resize-none")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Hashtags</label>
              <input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="Ex.: #moda #acessorios"
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

          {/* Preview do celular */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              <Eye size={15} className="text-purple" />
              Preview · {platformLabel} · {formatLabel}
            </div>

            <div className="relative w-[300px] rounded-[40px] border-[10px] border-ink bg-ink shadow-brand-lg overflow-hidden">
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-ink rounded-full z-20" />

              <div className="relative h-[540px] bg-bg-ice flex flex-col">
                {/* Header do perfil */}
                <div className="flex items-center gap-2.5 px-4 pt-9 pb-2">
                  <span className="w-8 h-8 rounded-full bg-brand-grad grid place-items-center text-[11px] font-bold text-white">
                    IA
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink">Inst Acessor</span>
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
                      <p className="text-[12px] text-ink leading-snug line-clamp-4">{caption}</p>
                    )}
                    {tags.length > 0 && (
                      <p className="text-[12px] text-[#00376B] font-medium">
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
      ) : (
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
                      <p className="text-[13px] text-ink leading-snug line-clamp-2 mt-1">
                        {d.caption}
                      </p>
                    )}
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
    </div>
  );
}
