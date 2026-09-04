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
  ChevronLeft,
  ChevronRight,
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  CalendarDays,
  Film,
  Copy as CopyIcon,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  isFormatAvailable,
  PLATFORM_LABELS,
  FORMAT_LABELS,
} from "@/lib/publishing/compatibility";

/**
 * PREVIEW SOCIAL AVANÇADO — Fase 6.5 (6.5.3 a 6.5.14)
 * ==================================================
 * Fluxo: CRIAR → ADICIONAR MÍDIA → EDITAR → PREVIEW → LEGENDA → HASHTAGS →
 * DATA/HORA → SALVAR RASCUNHO → PROGRAMAR → CALENDÁRIO → (futura publicação real).
 *
 * - Carrossel com até 7 imagens (adicionar/remover/substituir/reordenar/navegar/
 *   posição X/7). Limite de 7 é REGRA INTERNA do Inst Acessor — não é limite
 *   oficial da Meta/TikTok (não há id de mídia externo inventado: os uids são
 *   locais gerados no cliente).
 * - Editor de imagem LEVE (client, sem serviço externo, sem Photoshop):
 *   proporção 1:1/4:5/9:16, rotação, zoom, reposição, brilho/contraste, reset.
 * - Preview por formato (6.5.6/6.5.7): Instagram Post/Carrossel/Reel/Story e
 *   TikTok Vídeo (foto/carrossel = estrutura interna; capacidade futura a
 *   confirmar). Nunca afirma publicação.
 * - Compatibilidade por plataforma (6.5.8): formato indisponível →
 *   "Formato ainda não disponível para esta plataforma."
 * - Legenda (6.5.9): escrever/editar/usar copy salva — nunca sobrescreve sem ação.
 * - Hashtags dedicadas (6.5.10).
 * - Programar publicação (6.5.11): plataforma/formato/dia/mês/ano/hora/minuto
 *   (fuso do app) → cria/atualiza PlannedContent → aparece no Calendário.
 * - Vários dias (6.5.12): "Serão criados N conteúdos planejados." SEM recorrência
 *   infinita, SEM duplicação silenciosa — um PlannedContent por dia.
 * - Editar conteúdo programado (6.5.13): Calendário → abrir aqui com mídia/ordem/
 *   edições/legenda/hashtags/plataforma/formato/data/hora; owner-check via sessão.
 * - Rascunho (6.5.14): salvar e continuar depois; rascunho ≠ agendado ≠ publicado.
 */

const RATIOS = ["1:1", "4:5", "9:16"] as const;
type Ratio = (typeof RATIOS)[number];

interface ImageEdits {
  ratio: Ratio;
  rotate: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  brightness: number;
  contrast: number;
}

const DEFAULT_EDITS: ImageEdits = {
  ratio: "1:1",
  rotate: 0,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 100,
  contrast: 100,
};

interface DraftItem {
  uid: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  edits: ImageEdits;
}

interface DraftSummary {
  id: string;
  platform: string;
  mediaType: string;
  mediaUrl: string;
  caption: string;
  hashtags: string;
  format: string;
  items?: unknown;
  updatedAt: string;
}

interface CopySummary {
  id: string;
  platform: string;
  format: string;
  content: string;
  isFavorite: boolean;
  createdAt: string;
}

interface InitialContent {
  id: string;
  title: string;
  platform: string;
  format: string;
  scheduledAt?: string | null;
  draftId?: string | null;
  draft?: DraftSummary | null;
  ideaId?: string | null;
  copyId?: string | null;
  goalId?: string | null;
}

interface PreviewSocialProps {
  initialDrafts: DraftSummary[];
  copies?: CopySummary[];
  initialContent?: InitialContent | null;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
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

function readVideoAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler vídeo"));
    reader.readAsDataURL(file);
  });
}

function editStyle(edits: ImageEdits): React.CSSProperties {
  return {
    transform: `rotate(${edits.rotate}deg) scale(${edits.zoom}) translate(${edits.offsetX}%, ${edits.offsetY}%)`,
    filter: `brightness(${edits.brightness / 100}) contrast(${edits.contrast / 100})`,
  };
}

const RATIO_ASPECT: Record<Ratio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
};

const FORMAT_ORDER = ["post", "carrossel", "reel", "story", "video"];

function nextDays(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const today = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const label = d
      .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
      .replace(/\./g, "");
    out.push({ key, label });
  }
  return out;
}

function toLocalDateKey(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function toLocalTime(iso?: string | null): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildLocalDateTime(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}

export function PreviewSocial({ initialDrafts, copies = [], initialContent }: PreviewSocialProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>(
    initialContent?.platform ?? "instagram"
  );
  const [format, setFormat] = React.useState<string>(initialContent?.format ?? "post");
  const [items, setItems] = React.useState<DraftItem[]>(() => {
    const draftItems = initialContent?.draft?.items as DraftItem[] | undefined;
    if (draftItems && draftItems.length > 0) {
      return draftItems;
    }
    if (initialContent?.draft?.mediaUrl) {
      return [
        {
          uid: uid(),
          mediaType:
            (initialContent.draft.mediaType as "image" | "video") || "image",
          mediaUrl: initialContent.draft.mediaUrl,
          edits: { ...DEFAULT_EDITS },
        },
      ];
    }
    return [];
  });
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [caption, setCaption] = React.useState(initialContent?.draft?.caption ?? "");
  const [hashtags, setHashtags] = React.useState(initialContent?.draft?.hashtags ?? "");
  const [drafts, setDrafts] = React.useState<DraftSummary[]>(initialDrafts);
  const [view, setView] = React.useState<"criar" | "salvos">("criar");
  const [loading, setLoading] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [selectedDays, setSelectedDays] = React.useState<string[]>(
    initialContent?.scheduledAt ? [toLocalDateKey(initialContent.scheduledAt)] : []
  );
  const [timeValue, setTimeValue] = React.useState(toLocalTime(initialContent?.scheduledAt));
  const [scheduleTitle, setScheduleTitle] = React.useState(
    initialContent?.title ?? ""
  );
  const [copyOpen, setCopyOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const replaceRef = React.useRef<HTMLInputElement>(null);
  const isEditing = !!initialContent;

  // Ao trocar de plataforma, ajusta o formato para um disponível.
  React.useEffect(() => {
    if (!isFormatAvailable(platform, format)) {
      const first = FORMAT_ORDER.find((f) => isFormatAvailable(platform, f));
      if (first) setFormat(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  const activeItem = items[activeIndex] ?? null;
  const availableFormats = FORMAT_ORDER.filter((f) => isFormatAvailable(platform, f));
  const tags = hashtags
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const inputCls =
    "h-11 rounded-[12px] border border-border bg-bg-ice px-3.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow";

  function serializeItems(): DraftItem[] {
    return items.map((it) => ({
      uid: it.uid,
      mediaType: it.mediaType,
      mediaUrl: it.mediaUrl,
      edits: it.edits,
    }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    try {
      const url = isVideo
        ? await readVideoAsDataUrl(file)
        : await downscaleImage(file);
      const next = [
        ...items,
        { uid: uid(), mediaType: (isVideo ? "video" : "image") as "image" | "video", mediaUrl: url, edits: { ...DEFAULT_EDITS } },
      ].slice(0, 7);
      setItems(next);
      setActiveIndex(next.length - 1);
      toast("Mídia adicionada.");
    } catch {
      toast("Não foi possível carregar o arquivo.", "error");
    }
  }

  async function onFileReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || activeIndex < 0 || !items[activeIndex]) return;
    const isVideo = file.type.startsWith("video/");
    try {
      const url = isVideo
        ? await readVideoAsDataUrl(file)
        : await downscaleImage(file);
      setItems((prev) =>
        prev.map((it, i) =>
          i === activeIndex
            ? { ...it, mediaType: (isVideo ? "video" : "image") as "image" | "video", mediaUrl: url }
            : it
        )
      );
      toast("Mídia substituída.");
    } catch {
      toast("Não foi possível carregar o arquivo.", "error");
    }
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    setActiveIndex((cur) => (next.length === 0 ? 0 : Math.min(cur, next.length - 1)));
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setActiveIndex(target);
  }

  function updateEdits(patch: Partial<ImageEdits>) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === activeIndex ? { ...it, edits: { ...it.edits, ...patch } } : it
      )
    );
  }

  function clearAll() {
    setItems([]);
    setActiveIndex(0);
    setCaption("");
    setHashtags("");
    setFormat(initialContent?.format ?? "post");
    setPlatform(initialContent?.platform ?? "instagram");
  }

  async function saveDraftRequest(body: Record<string, unknown>) {
    if (isEditing && initialContent?.draft?.id) {
      const res = await fetch(`/api/drafts?id=${encodeURIComponent(initialContent.draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { res, draftId: initialContent.draft.id };
    }
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { res, draftId: data?.draft?.id ?? null };
  }

  async function handleSave() {
    setLoading(true);
    try {
      const body = {
        platform,
        mediaType: activeItem?.mediaType ?? "image",
        mediaUrl: activeItem?.mediaUrl ?? "",
        caption,
        hashtags,
        format,
        items: serializeItems(),
      };
      const { res, draftId } = await saveDraftRequest(body);
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar.", "error");
        return;
      }
      setDrafts((prev) => {
        const fresh = {
          id: draftId ?? "",
          platform,
          mediaType: body.mediaType,
          mediaUrl: body.mediaUrl,
          caption,
          hashtags,
          format,
          items: serializeItems(),
          updatedAt: new Date().toISOString(),
        };
        const without = prev.filter((d) => d.id !== fresh.id);
        return [fresh, ...without];
      });
      toast(isEditing ? "Alterações salvas no rascunho!" : "Rascunho salvo!");
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeDraft(id: string) {
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

  async function ensureDraft(): Promise<string | null> {
    const existing = isEditing && initialContent?.draft?.id ? initialContent.draft.id : drafts[0]?.id;
    if (existing) return existing;
    const body = {
      platform,
      mediaType: activeItem?.mediaType ?? "image",
      mediaUrl: activeItem?.mediaUrl ?? "",
      caption,
      hashtags,
      format,
      items: serializeItems(),
    };
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return null;
    setDrafts((prev) => [data.draft, ...prev]);
    return data.draft?.id ?? null;
  }

  async function handlePublishNow() {
    setLoading(true);
    try {
      // 1) Garante o rascunho salvo (mídia/ordem/edições/legenda/hashtags).
      const draftId = await ensureDraft();
      if (!draftId) {
        toast("Salve o rascunho antes de publicar.", "error");
        return;
      }
      // 2) Cria um conteúdo planejado no calendário (status PRONTO) se não for edição.
      let contentId: string | null = isEditing && initialContent ? initialContent.id : null;
      if (!contentId) {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: scheduleTitle.trim() || "Conteúdo programado",
            platform,
            format,
            draftId,
            objective: "",
            scheduledAt: null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error ?? "Erro ao criar o conteúdo.", "error");
          return;
        }
        contentId = data?.content?.id ?? null;
      }
      if (!contentId) {
        toast("Não foi possível preparar o conteúdo.", "error");
        return;
      }
      // 3) Enfileira e publica agora (o adapter confirma; nesta fase retorna
      //    INTEGRATION_NOT_CONFIGURED e o item fica FALHOU com mensagem amigável).
      const pub = await fetch("/api/publishing?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          platform,
          format,
          caption,
          hashtags,
          mediaUrl: activeItem?.mediaUrl ?? "",
          mediaCount: items.length,
          mimeType: activeItem?.mediaType === "video" ? "video/mp4" : "image/jpeg",
        }),
      });
      const pubData = await pub.json();
      if (!pub.ok) {
        toast(pubData.error ?? "Erro ao publicar.", "error");
        return;
      }
      if (pubData.ok) {
        toast("Publicação confirmada!");
      } else {
        toast(
          pubData.errorMessage ?? "A publicação entrou na fila, mas precisa de ajustes.",
          pubData.errorCode === "INTEGRATION_NOT_CONFIGURED" ? "info" : "error"
        );
      }
      setScheduleOpen(false);
      setSelectedDays([]);
    } catch {
      toast("Erro ao publicar.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSchedule() {
    setLoading(true);
    try {
      if (isEditing && initialContent) {
        if (!selectedDays[0]) {
          toast("Selecione uma data.", "error");
          return;
        }
        // 1) garante o rascunho salvo (mídia/ordem/edições/legenda/hashtags).
        const body = {
          platform,
          mediaType: activeItem?.mediaType ?? "image",
          mediaUrl: activeItem?.mediaUrl ?? "",
          caption,
          hashtags,
          format,
          items: serializeItems(),
        };
        let draftId = initialContent.draft?.id ?? null;
        if (draftId) {
          const r = await fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) throw new Error("draft");
        } else {
          const r = await fetch("/api/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const d = await r.json();
          if (!r.ok) throw new Error("draft");
          draftId = d?.draft?.id ?? null;
        }
        // 2) atualiza o conteúdo no calendário (data/hora, plataforma, formato, título).
        const res = await fetch(`/api/calendar?id=${encodeURIComponent(initialContent.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: scheduleTitle.trim() || "Conteúdo programado",
            platform,
            format,
            scheduledAt: buildLocalDateTime(selectedDays[0], timeValue),
            draftId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error ?? "Erro ao reagendar.", "error");
          return;
        }
        toast("Conteúdo atualizado no calendário!");
        setScheduleOpen(false);
        return;
      }

      // Modo criação — vários dias (6.5.12).
      if (selectedDays.length === 0) {
        toast("Selecione ao menos um dia.", "error");
        return;
      }
      const draftId = await ensureDraft();
      if (!draftId) {
        toast("Salve o rascunho antes de programar.", "error");
        return;
      }
      const scheduledAtList = selectedDays.map((d) => buildLocalDateTime(d, timeValue));
      const res = await fetch("/api/calendar/schedule-from-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          platform,
          format,
          title: scheduleTitle.trim() || "Conteúdo programado",
          objective: "",
          scheduledAtList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao programar.", "error");
        return;
      }
      toast(
        `${data.created} ${data.created === 1 ? "conteúdo" : "conteúdos"} programado${data.created === 1 ? "" : "s"} no calendário!`
      );
      setScheduleOpen(false);
      setSelectedDays([]);
    } catch {
      toast("Erro ao programar.", "error");
    } finally {
      setLoading(false);
    }
  }

  const formatLabel = FORMAT_LABELS[format] ?? format;
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const isStory = format === "story";
  const isReel = format === "reel";
  const isTikTok = platform === "tiktok";
  const isCarousel = format === "carrossel";

  return (
    <div className="flex flex-col gap-5">
      {isEditing && (
        <div className="rounded-[12px] border border-purple/20 bg-ai-soft px-4 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-purple">
            <CalendarClock size={15} />
            Editando conteúdo do Calendário
          </div>
          <p className="text-[12px] text-ink-soft">
            Carregamos mídia, ordem, edições, legenda, hashtags, plataforma, formato,
            data e hora. Salve para atualizar o rascunho e programe para ajustar o
            agendamento.
          </p>
        </div>
      )}

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
            {/* Plataforma */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Plataforma</label>
              <div className="flex gap-2">
                {(["instagram", "tiktok"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={cn(
                      "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                      platform === p
                        ? "bg-ai-soft border-purple/40 text-purple"
                        : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                    )}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Formato (compatível) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Formato</label>
              <div className="flex flex-wrap gap-2">
                {availableFormats.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn(
                      "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                      format === f
                        ? "bg-ai-soft border-purple/40 text-purple"
                        : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                    )}
                  >
                    {FORMAT_LABELS[f] ?? f}
                  </button>
                ))}
              </div>
              {!isFormatAvailable(platform, format) && (
                <p className="text-[12px] text-warn">
                  Formato ainda não disponível para esta plataforma.
                </p>
              )}
              {isTikTok && format !== "video" && (
                <p className="text-[12px] text-warn">
                  O TikTok aceita vídeo; foto/carrossel são capacidade futura a
                  confirmar com a integração.
                </p>
              )}
            </div>

            {/* Upload local */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">
                Mídia (upload local) · até 7 imagens
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
                disabled={items.length >= 7}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-6 text-[13.5px] font-semibold transition-colors cursor-pointer",
                  items.length >= 7
                    ? "border-border text-ink-muted cursor-not-allowed"
                    : "border-border text-ink-soft hover:border-purple/40 hover:text-purple"
                )}
              >
                <UploadCloud size={18} />
                {items.length >= 7
                  ? "Limite de 7 imagens atingido"
                  : items.length > 0
                  ? "Adicionar outra imagem"
                  : "Escolher imagem ou vídeo do seu computador"}
              </button>
              <p className="text-[11.5px] text-ink-muted">
                O limite de 7 é uma regra interna do Inst Acessor — não é um limite
                oficial da Meta/TikTok.
              </p>
            </div>

            {/* Carrossel / itens */}
            {items.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink-soft">
                    {items.length > 1
                      ? `Imagem ${activeIndex + 1}/${items.length}`
                      : activeItem?.mediaType === "video"
                      ? "Vídeo"
                      : "Imagem 1/1"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveIndex((c) => Math.max(0, c - 1))}
                      disabled={activeIndex === 0}
                      className="p-1.5 rounded-[8px] text-ink-muted hover:text-purple disabled:opacity-30 cursor-pointer"
                      aria-label="Imagem anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setActiveIndex((c) => Math.min(items.length - 1, c + 1))}
                      disabled={activeIndex >= items.length - 1}
                      className="p-1.5 rounded-[8px] text-ink-muted hover:text-purple disabled:opacity-30 cursor-pointer"
                      aria-label="Próxima imagem"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {items.map((it, i) => (
                    <div
                      key={it.uid}
                      className={cn(
                        "relative flex-none w-16 h-16 rounded-[10px] border-2 overflow-hidden group",
                        i === activeIndex
                          ? "border-purple"
                          : "border-border-soft hover:border-purple/40"
                      )}
                    >
                      {it.mediaType === "video" ? (
                        <video src={it.mediaUrl} className="w-full h-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.mediaUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => removeItem(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-ink/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Remover imagem"
                      >
                        <X size={11} />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 flex justify-center gap-1 pb-0.5 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => moveItem(i, -1)}
                          disabled={i === 0}
                          className="w-5 h-5 rounded bg-white/90 text-ink grid place-items-center disabled:opacity-30 cursor-pointer"
                          aria-label="Mover para a esquerda"
                        >
                          <ArrowLeft size={10} />
                        </button>
                        <button
                          onClick={() => moveItem(i, 1)}
                          disabled={i >= items.length - 1}
                          className="w-5 h-5 rounded bg-white/90 text-ink grid place-items-center disabled:opacity-30 cursor-pointer"
                          aria-label="Mover para a direita"
                        >
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Imagem ativa + ações */}
                {activeItem && (
                  <div className="flex flex-col gap-2">
                    <div
                      className={cn(
                        "relative w-full max-w-[320px] overflow-hidden rounded-[12px] border border-border-soft bg-ink grid place-items-center",
                        RATIO_ASPECT[activeItem.edits.ratio]
                      )}
                    >
                      {activeItem.mediaType === "video" ? (
                        <video
                          src={activeItem.mediaUrl}
                          className="absolute inset-0 w-full h-full object-contain"
                          muted
                          controls
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeItem.mediaUrl}
                          alt="Imagem ativa"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={editStyle(activeItem.edits)}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer">
                        <input
                          ref={replaceRef}
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={onFileReplace}
                        />
                        <Button variant="outline" size="sm" type="button" className="gap-1.5">
                          <UploadCloud size={14} /> Substituir
                        </Button>
                      </label>
                      <Button variant="outline" size="sm" type="button" onClick={() => setEditOpen(true)} className="gap-1.5">
                        <RotateCw size={14} /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeItem(activeIndex)} className="gap-1.5 text-danger">
                        <Trash2 size={14} /> Remover
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legenda */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-semibold text-ink-soft">Legenda</label>
                <button
                  onClick={() => setCopyOpen(true)}
                  className="text-[12px] font-semibold text-purple hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <CopyIcon size={13} /> Usar copy salva
                </button>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="Escreva a legenda do post..."
                className={cn(inputCls, "h-auto py-2.5 resize-none")}
              />
            </div>

            {/* Hashtags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-ink-soft">Hashtags</label>
              <input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="Ex.: #moda #acessorios"
                className={inputCls}
              />
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={handleSave} disabled={loading} className="gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isEditing ? "Salvar alterações" : "Salvar rascunho"}
              </Button>
              <Button variant="outline" onClick={() => setScheduleOpen(true)} className="gap-2">
                <CalendarDays size={16} /> Programar publicação
              </Button>
              <Button variant="ghost" onClick={clearAll} className="gap-2">
                <Eraser size={16} /> Limpar
              </Button>
            </div>
            <p className="text-[11.5px] text-ink-muted">
              Programar é agendamento interno — nada é enviado a Meta/TikTok. O
              conteúdo aparecerá no Calendário.
            </p>
          </div>

          {/* Preview do celular */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              <Eye size={15} className="text-purple" />
              Preview · {platformLabel} · {formatLabel}
            </div>

            {/* Phone shell 100% fixo — Post/Carrossel/Reel/Story mudam apenas o
                conteúdo interno (a tela é um viewport absoluto de tamanho constante). */}
            <div className="relative w-[300px] h-[560px] flex-none rounded-[40px] border-[10px] border-ink bg-ink shadow-brand-lg overflow-hidden">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-ink rounded-full z-20" />

              <div className="absolute inset-0 bg-bg-ice flex flex-col overflow-hidden">
                {/* Header do perfil */}
                <div className="flex items-center gap-2.5 px-4 pt-9 pb-2">
                  <span className="w-8 h-8 rounded-full bg-brand-grad grid place-items-center text-[11px] font-bold text-white">
                    IA
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink">
                    {isTikTok ? "@instacessor" : "Inst Acessor"}
                  </span>
                  {isTikTok && <MoreHorizontal size={16} className="ml-auto text-ink-soft" />}
                  {!isTikTok && isStory && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      Story
                    </span>
                  )}
                </div>

                {/* Mídia */}
                <div className="flex-1 bg-surface grid place-items-center overflow-hidden relative">
                  {activeItem ? (
                    activeItem.mediaType === "video" ? (
                      <video
                        src={activeItem.mediaUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeItem.mediaUrl}
                        alt="Mídia"
                        className="w-full h-full object-cover"
                        style={editStyle(activeItem.edits)}
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-ink-muted px-6 text-center">
                      <ImageIcon size={26} />
                      <span className="text-[12px]">
                        Adicione uma mídia para visualizar o preview.
                      </span>
                    </div>
                  )}
                  {/* Contador de carrossel */}
                  {isCarousel && items.length > 1 && (
                    <div className="absolute top-3 right-3 z-10 flex gap-1">
                      {items.map((it, i) => (
                        <span
                          key={it.uid}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            i === activeIndex ? "bg-white" : "bg-white/50"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {/* Barra de progresso Story */}
                  {isStory && (
                    <div className="absolute top-0 inset-x-0 flex gap-1 p-2 pt-1 z-10">
                      {Array.from({ length: Math.max(1, items.length) }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-[3px] flex-1 rounded-full",
                            i === activeIndex ? "bg-white" : "bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {isStory && (
                    <div className="absolute top-6 right-3 z-10">
                      <X size={18} className="text-white drop-shadow" />
                    </div>
                  )}
                </div>

                {/* Ações (Reel / TikTok) */}
                {(isReel || isTikTok) && activeItem && (
                  <div className="absolute bottom-24 right-2 z-10 flex flex-col items-center gap-3 text-white">
                    <span className="flex flex-col items-center gap-0.5 drop-shadow">
                      <Heart size={20} fill="white" />
                      <span className="text-[9px] font-semibold">12,4 mil</span>
                    </span>
                    <span className="flex flex-col items-center gap-0.5 drop-shadow">
                      <MessageCircle size={20} />
                      <span className="text-[9px] font-semibold">318</span>
                    </span>
                    <span className="flex flex-col items-center gap-0.5 drop-shadow">
                      <Send size={20} />
                    </span>
                  </div>
                )}

                {/* Caption + hashtags */}
                {(caption || tags.length > 0) && (
                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {caption && (
                      <p className="text-[12px] text-ink leading-snug line-clamp-4">{caption}</p>
                    )}
                    {tags.length > 0 && (
                      <p className={cn("text-[12px] font-medium", isTikTok ? "text-purple" : "text-[#00376B]")}>
                        {tags.join(" ")}
                      </p>
                    )}
                  </div>
                )}

                {/* Barra inferior */}
                <div className="px-4 py-2 border-t border-border-soft flex items-center justify-between">
                  <div className="flex items-center gap-2 text-ink-muted">
                    {activeItem?.mediaType === "video" ? <Film size={15} /> : <Clapperboard size={15} />}
                    <span className="text-[10.5px] font-semibold">
                      {format === "story" ? "Story" : format === "reel" ? "Reel" : format === "carrossel" ? "Carrossel" : "Publicação"}
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
                        {PLATFORM_LABELS[d.platform] ?? d.platform}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                        {FORMAT_LABELS[d.format] ?? d.format}
                      </span>
                      {(d.items as DraftItem[] | undefined)?.length ? (
                        <span className="text-[11px] font-semibold text-ink-soft">
                          {(d.items as DraftItem[]).length} mídias
                        </span>
                      ) : null}

                    </div>
                    {d.caption && (
                      <p className="text-[13px] text-ink leading-snug line-clamp-2 mt-1">
                        {d.caption}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeDraft(d.id)}
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

      {/* Modal de edição de imagem */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar imagem" size="md">
        {activeItem && activeItem.mediaType === "image" ? (
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "relative w-full max-w-[260px] mx-auto overflow-hidden rounded-[12px] border border-border-soft bg-ink grid place-items-center",
                RATIO_ASPECT[activeItem.edits.ratio]
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeItem.mediaUrl}
                alt="Edição"
                className="absolute inset-0 w-full h-full object-cover"
                style={editStyle(activeItem.edits)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-ink-soft">Proporção</span>
              <div className="flex gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    onClick={() => updateEdits({ ratio: r })}
                    className={cn(
                      "px-3 py-1.5 rounded-[8px] border text-[12px] font-semibold transition-colors cursor-pointer",
                      activeItem.edits.ratio === r
                        ? "bg-ai-soft border-purple/40 text-purple"
                        : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-ink-soft">Rotação</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => updateEdits({ rotate: (activeItem.edits.rotate + 90) % 360 })}
                    className="gap-1"
                  >
                    <RotateCw size={14} /> 90°
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-ink-soft">Zoom</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => updateEdits({ zoom: Math.max(1, +(activeItem.edits.zoom - 0.1).toFixed(2)) })}
                    className="gap-1"
                  >
                    <ZoomOut size={14} />
                  </Button>
                  <span className="text-[12px] font-bold text-ink w-8 text-center">
                    {activeItem.edits.zoom.toFixed(1)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => updateEdits({ zoom: Math.min(3, +(activeItem.edits.zoom + 0.1).toFixed(2)) })}
                    className="gap-1"
                  >
                    <ZoomIn size={14} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-soft">Brilho</span>
              <input
                type="range"
                min={0}
                max={200}
                value={activeItem.edits.brightness}
                onChange={(e) => updateEdits({ brightness: Number(e.target.value) })}
                className="accent-purple"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-soft">Contraste</span>
              <input
                type="range"
                min={0}
                max={200}
                value={activeItem.edits.contrast}
                onChange={(e) => updateEdits({ contrast: Number(e.target.value) })}
                className="accent-purple"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" type="button" onClick={() => updateEdits({ ...DEFAULT_EDITS })} className="gap-1.5">
                <RefreshCw size={14} /> Reset
              </Button>
              <Button size="sm" type="button" onClick={() => setEditOpen(false)} className="gap-1.5">
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] bg-surface p-4 flex flex-col gap-2 text-center">
              <Film size={22} className="mx-auto text-ink-muted" />
              <p className="text-[13px] text-ink-soft">
                A edição visual é aplicada a imagens. Para vídeo, o preview já usa o
                arquivo original.
              </p>
            </div>
            <Button type="button" onClick={() => setEditOpen(false)}>
              Concluir
            </Button>
          </div>
        )}
      </Modal>

      {/* Modal de programação */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title={isEditing ? "Reagendar conteúdo" : "Programar publicação"}
        description={
          isEditing
            ? "Atualiza o conteúdo no Calendário (data/hora, plataforma, formato)."
            : "Agendamento interno — nada é enviado às redes."
        }
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Título interno</label>
            <input
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              className={inputCls}
              placeholder="Ex.: Carrossel — dicas de acessórios"
            />
          </div>

          {!isEditing ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-soft">
                  Selecione os dias (vários permitidos)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {nextDays(14).map((d) => {
                    const active = selectedDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        onClick={() =>
                          setSelectedDays((prev) =>
                            active ? prev.filter((k) => k !== d.key) : [...prev, d.key]
                          )
                        }
                        className={cn(
                          "px-3 py-2 rounded-[10px] border text-[12.5px] font-semibold transition-colors cursor-pointer",
                          active
                            ? "bg-ai-soft border-purple/40 text-purple"
                            : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-soft">
                  Horário (fuso do app)
                </label>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="rounded-[10px] bg-surface p-3 flex items-center gap-2">
                <CalendarClock size={16} className="text-purple flex-none" />
                {selectedDays.length === 0 ? (
                  <span className="text-[12.5px] text-ink-soft">
                    Nenhum dia selecionado ainda.
                  </span>
                ) : (
                  <span className="text-[12.5px] text-ink font-semibold">
                    Serão criados {selectedDays.length}{" "}
                    {selectedDays.length === 1 ? "conteúdo planejado" : "conteúdos planejados"}.
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink-soft">Dia e horário</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDays[0] ?? ""}
                  onChange={(e) => setSelectedDays(e.target.value ? [e.target.value] : [])}
                  className={inputCls}
                />
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className={inputCls}
                />
              </div>
              <p className="text-[11.5px] text-ink-muted">
                Você está editando um conteúdo existente — apenas um dia será atualizado.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              onClick={handleSchedule}
              disabled={loading || (!isEditing && selectedDays.length === 0)}
              className="gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
              {isEditing ? "Atualizar no calendário" : "Programar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePublishNow}
              disabled={loading}
              className="gap-2"
            >
              <Send size={16} />
              Publicar agora
            </Button>
            <Button variant="ghost" type="button" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de seleção de copy */}
      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} title="Usar uma copy salva" size="md">
        {copies.length === 0 ? (
          <EmptyState
            icon={CopyIcon}
            title="Nenhuma copy salva"
            description="Gere e salve copies no Gerador de Copy para usar aqui."
          />
        ) : (
          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
            {copies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCaption(c.content);
                  setCopyOpen(false);
                  toast("Copy aplicada à legenda.");
                }}
                className="rounded-[10px] border border-border-soft bg-bg-ice p-3 text-left hover:border-purple/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    {PLATFORM_LABELS[c.platform] ?? c.platform}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                    {FORMAT_LABELS[c.format] ?? c.format}
                  </span>
                </div>
                <p className="text-[12.5px] text-ink leading-snug line-clamp-3">{c.content}</p>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
