"use client";

import * as React from "react";
import { upload } from "@vercel/blob/client";
import {
  Eye,
  Image as ImageIcon,
  Images,
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
  Send,
  Zap,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { FIELD_CLASS_FILLED, SELECT_CLASS_FILLED } from "@/lib/ui/field";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PreviewFrame, type PreviewSlide } from "@/components/ai/preview-frame";
import { MediaPicker } from "@/components/media-library/media-picker";
import type { MediaAssetView } from "@/lib/media-library";
import {
  DEFAULT_FRAMING,
  MIN_ZOOM,
  MAX_ZOOM,
  clamp,
  isDefaultFraming,
  type Framing,
} from "@/components/ai/use-media-framing";

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
  /** Enquadramento da mídia de capa, serializado — ver `use-media-framing.ts`. */
  framing?: string | null;
}

/**
 * Item REAL já publicado/enfileirado, como `GET /api/calendar` devolve.
 * A aba "Postados" mostra estes — nada é criado aqui, só lido.
 */
export interface PostedItem {
  id: string;
  platform: string;
  format: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  draftCaption: string | null;
  draftMediaUrl: string | null;
  draftMediaType: string | null;
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
  userId: string;
  aiConfigured: boolean;
  initialDrafts: Draft[];
  initialSaved: SavedCopy[];
  /**
   * Mídia escolhida na Biblioteca e resolvida no SERVIDOR (`?mid=<id>`).
   * Já vem isolada por usuário — o cliente não faz fetch nem valida acesso.
   */
  initialMedia: { id: string; url: string; type: string } | null;
  /** Formato sugerido pela Biblioteca ("Criar carrossel" → "carrossel"). */
  initialFormat: string | null;
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

export function PreviewSocial({
  userId,
  aiConfigured,
  initialDrafts,
  initialSaved,
  initialMedia,
  initialFormat,
}: PreviewSocialProps) {
    const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  // `initialFormat` vem da Biblioteca (ex.: "Criar carrossel") e tem prioridade
  // sobre o padrão "post" — é a intenção que o usuário já expressou.
  const [format, setFormat] = React.useState<string>(initialFormat ?? "post");
  /**
   * SLIDES do preview. Um array — e não `mediaUrl`/`mediaType` soltos — porque
   * o carrossel precisa de várias imagens, cada uma com o seu enquadramento.
   * Post/Reel/Story usam sempre `slides[0]`; o carrossel usa todos.
   */
  const [slides, setSlides] = React.useState<PreviewSlide[]>([]);
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [mediaUrl, setMediaUrl] = React.useState<string>("");
  const [mediaType, setMediaType] = React.useState<"image" | "video">("image");
  /**
   * `true` quando a mídia é válida para o PREVIEW local mas grande demais para
   * ir ao banco em base64. Nesse caso o rascunho é salvo sem o arquivo — melhor
   * do que estourar o limite do schema e devolver um erro incompreensível.
   */
  const [mediaOversize, setMediaOversize] = React.useState(false);
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>(initialDrafts);
  const [savedCopies, setSavedCopies] = React.useState<SavedCopy[]>(initialSaved);
  /**
   * POSTADOS — carregados SOB DEMANDA, na primeira vez que a aba abre.
   *
   * Não vêm no carregamento inicial de propósito: a lista só interessa a quem
   * clica na aba, e trazer o histórico inteiro junto com a tela de criação é
   * exatamente o tipo de peso inicial que atrapalha no celular. Uma busca, uma
   * vez, e o resultado fica em memória.
   */
  const [posted, setPosted] = React.useState<PostedItem[]>([]);
  const [postedLoaded, setPostedLoaded] = React.useState(false);
  const [postingLoad, setPostingLoad] = React.useState(false);
  const [view, setView] = React.useState<"criar" | "postados" | "salvos" | "biblioteca">("criar");
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  /** Seletor da Biblioteca de Mídia. */
  const [pickerOpen, setPickerOpen] = React.useState(false);

  /**
   * Mídia escolhida na Biblioteca (`/biblioteca-de-midia` → "Criar publicação").
   *
   * Chega JÁ RESOLVIDA pelo servidor (`?mid=<id>`) — sem `sessionStorage` e sem
   * fetch no cliente. Dois ganhos: sobrevive a recarregar a página e a abrir em
   * aba nova, e a autorização fica onde deve (o servidor confere que a mídia é
   * do usuário antes de mandá-la).
   */
  React.useEffect(() => {
    if (!initialMedia) return;
    setSlides([
      {
        id: `lib-${initialMedia.id}`,
        url: initialMedia.url,
        type: initialMedia.type === "VIDEO" ? "video" : "image",
        framing: { ...DEFAULT_FRAMING },
      },
    ]);
    setActiveSlide(0);
    setMediaUrl(initialMedia.url);
    setMediaType(initialMedia.type === "VIDEO" ? "video" : "image");
    // A mídia já está no Blob: não há arquivo local para enviar de novo.
    setMediaFile(null);
    setView("criar");
    toast("Mídia da biblioteca carregada no preview.");
    // Roda uma vez, na montagem, para o HTML que chegou do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega POSTADOS na primeira vez que a aba abre (a declaração de `view`
  // precisa vir ANTES deste efeito — daí ele estar aqui, e não junto do estado).
  React.useEffect(() => {
    if (view !== "postados" || postedLoaded || postingLoad) return;
    let cancelled = false;
    setPostingLoad(true);
    // `?status=PUBLICADO` filtra no SERVIDOR. Sem o filtro, a rota monta a view
    // de cada conteúdo planejado (uma consulta por linha, até 500) só para o
    // cliente descartar quase tudo — peso real num celular em 3G.
    fetch("/api/calendar?status=PUBLICADO")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((rows: unknown) => {
        if (cancelled || !Array.isArray(rows)) return;
        // `publishedAt` é o que separa "publicado" de "marcado como publicado
        // sem data". Sem ele o item não entra: a aba não pode mostrar como
        // postado algo que não tem quando.
        const publicados = (rows as PostedItem[]).filter((r) => r.publishedAt);
        publicados.sort(
          (a, b) =>
            new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
        );
        setPosted(publicados);
        setPostedLoaded(true);
      })
      .catch(() => {
        if (!cancelled) toast("Não foi possível carregar os conteúdos publicados.", "error");
      })
      .finally(() => {
        if (!cancelled) setPostingLoad(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, postedLoaded, postingLoad, toast]);

  // Título interno do conteúdo (opcional): alimenta o PlannedContent gerado por
  // Programar / Publicar agora. Sem ele, o título é derivado da legenda.
  const [title, setTitle] = React.useState("");

  // Fluxos de publicação (reutilizam o MOTOR existente — nada é duplicado).
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState("");
  const [publishing, setPublishing] = React.useState(false);
  const [scheduling, setScheduling] = React.useState(false);


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
    setMediaFile(null);
    setPlatform(d.platform);
    setFormat(d.format || "post");
    setMediaUrl(d.mediaUrl);
    setMediaType(d.mediaType === "video" ? "video" : "image");
    setMediaOversize(false);
    setCaption(d.caption);
    setHashtags(d.hashtags);
    setLastGenerated("");
    // Reconstrói o slide a partir do rascunho. O enquadramento salvo VOLTA
    // quando existir — é o que faz o recorte sobreviver a salvar/reabrir/F5.
    // JSON inválido cai no neutro em vez de quebrar a tela.
    let framing: Framing = { ...DEFAULT_FRAMING };
    if (d.framing) {
      try {
        const parsed = JSON.parse(d.framing) as Partial<Framing>;
        framing = {
          zoom: clamp(Number(parsed.zoom) || 1, MIN_ZOOM, MAX_ZOOM),
          offsetX: Number(parsed.offsetX) || 0,
          offsetY: Number(parsed.offsetY) || 0,
        };
      } catch {
        /* enquadramento corrompido → neutro */
      }
    }

    setSlides(
      d.mediaUrl
        ? [
            {
              id: `draft-${d.id}`,
              url: d.mediaUrl,
              type: d.mediaType === "video" ? "video" : "image",
              framing,
            },
          ]
        : []
    );
    setActiveSlide(0);
    setView("criar");
    toast("Rascunho carregado no editor.");
  }

  /** O motor de publicação real conhece Instagram e TikTok. */
  const publishablePlatform = platform === "instagram" || platform === "tiktok";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);

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

      // Cada arquivo virou um SLIDE com enquadramento próprio. Um carrossel
      // não é uma lista separada de mídias: é o mesmo array, e o formato decide
      // se os slides depois do primeiro aparecem.
      const novo: PreviewSlide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        type: isVideo ? "video" : "image",
        framing: { ...DEFAULT_FRAMING },
      };
      setSlides((prev) => {
        // Post/Reel/Story são de UMA mídia: trocar o arquivo substitui o slide,
        // não acumula. O carrossel acumula.
        const next = format === "carrossel" ? [...prev, novo] : [novo];
        setActiveSlide(next.length - 1);
        return next;
      });

      if (oversize) {
        toast("Mídia grande: aparece no preview, mas será salva sem o arquivo.");
      } else {
        toast(
          format === "carrossel"
            ? `Imagem ${slides.length + 1} adicionada ao carrossel.`
            : "Mídia adicionada ao preview."
        );
      }
    } catch {
      toast("Não foi possível carregar o arquivo.", "error");
    } finally {
      // Permite escolher o MESMO arquivo de novo depois de limpar.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Move um slide do carrossel uma posição (-1 esquerda, +1 direita). */
  function moveSlide(index: number, direction: -1 | 1) {
    setSlides((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      setActiveSlide(target);
      return next;
    });
  }

  /** Remove um slide do carrossel. */
  function removeSlide(id: string) {
    setSlides((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveSlide((cur) => Math.min(cur, Math.max(0, next.length - 1)));
      // A mídia "principal" (que vai no rascunho) acompanha o carrossel.
      const first = next[0];
      setMediaUrl(first?.url ?? "");
      setMediaType(first?.type ?? "image");
      return next;
    });
    toast("Imagem removida do carrossel.");
  }

  /** Aplica o enquadramento (zoom/posição) a um slide. */
  function setSlideFraming(id: string, framing: Framing) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, framing } : s)));
  }

  /**
   * Traz mídias da BIBLIOTECA para o preview.
   *
   * Reaproveita a URL já persistida — o arquivo NÃO é reenviado. É exatamente o
   * ganho da Biblioteca: o mesmo binário serve para vários conteúdos.
   *
   * O `id` do slide recebe prefixo `lib-<mediaId>` para que dois slides da mesma
   * mídia (ex.: usar a mesma foto duas vezes no carrossel) não colidam como
   * chave de React — o enquadramento é POR SLIDE, não por arquivo.
   */
  function addFromLibrary(assets: MediaAssetView[]) {
    if (assets.length === 0) return;
    const novos: PreviewSlide[] = assets.map((a) => ({
      id: `lib-${a.id}-${Math.random().toString(36).slice(2, 7)}`,
      url: a.url,
      type: a.type === "VIDEO" ? "video" : "image",
      framing: { ...DEFAULT_FRAMING },
    }));

    setSlides((prev) => {
      // Carrossel acumula; os formatos de mídia única substituem.
      const next = format === "carrossel" ? [...prev, ...novos] : [novos[0]];
      setActiveSlide(format === "carrossel" ? prev.length : 0);
      return next;
    });

    // O rascunho guarda UMA mediaUrl (a que vai para o motor de publicação).
    // Aqui ela passa a ser a primeira mídia escolhida.
    setMediaUrl(novos[0].url);
    setMediaType(novos[0].type);
    setMediaOversize(false);
    // A mídia da biblioteca já está no Blob: não há `File` local para enviar.
    setMediaFile(null);

    toast(
      novos.length === 1
        ? "Mídia da biblioteca adicionada."
        : `${novos.length} mídias da biblioteca adicionadas.`
    );
  }

  function clearAll() {
    setMediaFile(null);
    setMediaUrl("");
    setSlides([]);
    setActiveSlide(0);
    setMediaOversize(false);
    setCaption("");
    setHashtags("");
    setFormat("post");
    setObjective("");
    setAudience("");
    setContext("");
    setLastGenerated("");
    setTitle("");
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

  /**
   * Garante que o conteúdo atual está no banco como SocialDraft e devolve o id.
   *
   * É o MESMO caminho de `handleSave` (upload ao Vercel Blob → POST /api/drafts),
   * extraído para ser reutilizado por Salvar / Programar / Publicar agora sem
   * duplicar a lógica de upload. NÃO cria um segundo fluxo.
   *
   * Devolve `null` quando algo falhou — quem chamou já mostrou o motivo.
   */
  async function ensureDraft(): Promise<string | null> {
    let uploadedMediaUrl = mediaUrl;
    if (mediaFile) {
      setUploadingMedia(true);
      try {
        const blob = await upload(
          `inst-acessor/${userId}/${mediaFile.name}`,
          mediaFile,
          { access: "public", handleUploadUrl: "/api/upload/media" }
        );
        uploadedMediaUrl = blob.url;
      } finally {
        setUploadingMedia(false);
      }
    }

    // O enquadramento da mídia de CAPA viaja junto (JSON curto), para o recorte
    // sobreviver a salvar/reabrir/F5. Só a capa: é ela que o rascunho
    // representa (`mediaUrl` é uma só). O LIMITE segue valendo — o binário
    // publicado é o original, o recorte é do preview. Ver `use-media-framing.ts`.
    const capa = slides[activeSlide] ?? slides[0];
    const framingJson =
      capa && !isDefaultFraming(capa.framing) ? JSON.stringify(capa.framing) : undefined;

    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        mediaType,
        mediaUrl: uploadedMediaUrl,
        caption,
        hashtags,
        format,
        framing: framingJson,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Erro ao salvar o rascunho.", "error");
      return null;
    }
    const draft = data.draft as Draft | undefined;
    if (draft) setDrafts((prev) => [draft, ...prev.filter((d) => d.id !== draft.id)]);
    return draft?.id ?? null;
  }

  async function handleSave() {
    setLoading(true);
    try {
      const id = await ensureDraft();
      if (!id) return;
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

  /*
   * PROGRAMAR PUBLICAÇÃO — usa a ponte JÁ EXISTENTE `POST /api/calendar/schedule-from-draft`
   * (Fase 6.5). O rascunho é gravado primeiro (se preciso) para que o
   * `draftId` — e portanto a mídia pública — viaje até o PlannedContent.
   */
  async function handleSchedule() {
    if (!caption.trim()) {
      toast("Adicione uma legenda antes de programar.", "error");
      return;
    }
    if (!scheduleAt) {
      toast("Escolha a data e a hora da publicação.", "error");
      return;
    }
    setScheduling(true);
    try {
      const draftId = await ensureDraft();
      if (!draftId) return;
      const iso = new Date(scheduleAt).toISOString();
      const res = await fetch("/api/calendar/schedule-from-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          platform,
          format,
          title: title.trim() || caption.trim().slice(0, 80) || "Conteúdo do Preview Social",
          scheduledAtList: [iso],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível programar.", "error");
        return;
      }
      setScheduleOpen(false);
      setScheduleAt("");
      toast("Conteúdo programado no Calendário.");
    } catch {
      toast("Não foi possível programar.", "error");
    } finally {
      setScheduling(false);
    }
  }

  /*
   * PUBLICAR AGORA — confirmação visual → garante o rascunho → enfileira via
   * `POST /api/publishing`. O disparo real é do MOTOR existente no servidor;
   * o client nunca fala com a Meta.
   */
  async function handlePublishNow() {
    setPublishing(true);
    try {
      const draftId = await ensureDraft();
      if (!draftId) return;

      const created = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          format,
          title: title.trim() || caption.trim().slice(0, 80) || "Conteúdo do Preview Social",
          objective: "",
          scheduledAt: new Date().toISOString(),
          draftId,
        }),
      });
      const createdData = await created.json();
      if (!created.ok) {
        toast(createdData.error ?? "Não foi possível preparar o conteúdo.", "error");
        return;
      }
      const contentId: string | undefined = createdData.content?.id;
      if (!contentId) {
        toast("Não foi possível preparar o conteúdo.", "error");
        return;
      }

      const pub = await fetch("/api/publishing?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, platform, format }),
      });
      const pubData = await pub.json();
      if (!pub.ok) {
        toast(pubData.error ?? "Não foi possível publicar.", "error");
        return;
      }
      if (pubData.status === "PUBLICADO") {
        toast("Publicado com sucesso no Instagram.");
      } else if (pubData.errorMessage) {
        toast(pubData.errorMessage, "error");
      } else {
        toast("Publicação enviada. Acompanhe o status na Central de Publicação.");
      }
      setConfirmOpen(false);
    } catch {
      toast("Não foi possível publicar.", "error");
    } finally {
      setPublishing(false);
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

  const inputCls = FIELD_CLASS_FILLED;

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        tabs={[
          { id: "criar", label: "Criar" },
          { id: "postados", label: `Postados (${posted.length})` },
          { id: "salvos", label: `Rascunhos (${drafts.length})` },
          { id: "biblioteca", label: `Legendas salvas (${savedCopies.length})` },
        ]}
        activeId={view}
        onChange={(v) => setView(v as "criar" | "postados" | "salvos" | "biblioteca")}
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
                      onClick={() => {
                        setFormat(f.id);
                        // Post/Reel/Story mostram UMA mídia (a primeira). Sem
                        // isto, sair de um carrossel parado na 3ª imagem deixava
                        // essa 3ª aparecendo no formato de mídia única. Os
                        // slides seguem em memória: voltar ao carrossel
                        // restaura o conjunto inteiro.
                        if (f.id !== "carrossel") setActiveSlide(0);
                      }}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-5 text-[13.5px] font-semibold transition-colors cursor-pointer",
                      mediaUrl
                        ? "border-success/40 text-success bg-success/5"
                        : "border-border text-ink-soft hover:border-purple/40 hover:text-purple"
                    )}
                  >
                    <UploadCloud size={18} />
                    {format === "carrossel"
                      ? mediaUrl
                        ? "Outra do dispositivo"
                        : "Do dispositivo"
                      : mediaUrl
                        ? "Trocar do dispositivo"
                        : "Do dispositivo"}
                  </button>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-border px-4 py-5 text-[13.5px] font-semibold text-ink-soft transition-colors cursor-pointer hover:border-purple/40 hover:text-purple"
                  >
                    <Images size={18} />
                    Da Biblioteca
                  </button>
                </div>
                <p className="text-[11.5px] text-ink-muted">
                  {format === "carrossel"
                    ? "A biblioteca deixa você escolher várias de uma vez, sem reenviar arquivo."
                    : "Usar uma mídia já enviada evita subir o mesmo arquivo de novo."}
                </p>
                {mediaOversize && (
                  <p className="text-[11.5px] text-warn">
                    Arquivo grande: aparece no preview, mas o rascunho será salvo sem ele.
                  </p>
                )}

                {/* ---- CARROSSEL: miniaturas com reordenar/remover ---- */}
                {format === "carrossel" && slides.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11.5px] font-semibold text-ink-muted">
                      {slides.length} imagem{slides.length > 1 ? "ns" : ""} · a ordem é a do carrossel
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {slides.map((s, i) => (
                        <div
                          key={s.id}
                          className={cn(
                            "relative flex-none rounded-[10px] overflow-hidden border-2 cursor-pointer",
                            i === activeSlide ? "border-purple" : "border-border-soft"
                          )}
                          onClick={() => setActiveSlide(i)}
                        >
                          {s.type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.url} alt="" loading="lazy" decoding="async" className="w-16 h-16 object-cover" />
                          ) : (
                            <video src={s.url} className="w-16 h-16 object-cover" muted preload="metadata" />
                          )}
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-ink/75 text-white text-[9.5px] font-bold grid place-items-center">
                            {i + 1}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 bg-ink/60 py-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSlide(i, -1);
                              }}
                              disabled={i === 0}
                              aria-label="Mover para a esquerda"
                              className="text-white/85 hover:text-white disabled:opacity-25 cursor-pointer text-[10px] leading-none px-1"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSlide(s.id);
                              }}
                              aria-label="Remover imagem"
                              className="text-white/85 hover:text-danger cursor-pointer text-[10px] leading-none px-1"
                            >
                              ✕
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSlide(i, 1);
                              }}
                              disabled={i === slides.length - 1}
                              aria-label="Mover para a direita"
                              className="text-white/85 hover:text-white disabled:opacity-25 cursor-pointer text-[10px] leading-none px-1"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex-none w-16 h-16 rounded-[10px] border-2 border-dashed border-border text-ink-muted hover:border-purple/50 hover:text-purple grid place-items-center cursor-pointer"
                        aria-label="Adicionar imagem ao carrossel"
                      >
                        <UploadCloud size={18} />
                      </button>
                    </div>
                  </div>
                )}

                {/* ---- ENQUADRAMENTO: zoom + reset (a posição vem do arraste) ---- */}
                {slides.length > 0 && (() => {
                  const current = slides[activeSlide] ?? slides[0];
                  if (!current) return null;
                  return (
                    <div className="flex items-center gap-3">
                      <span className="text-[11.5px] font-semibold text-ink-muted flex-none">
                        Zoom
                      </span>
                      <input
                        type="range"
                        min={MIN_ZOOM}
                        max={MAX_ZOOM}
                        step={0.05}
                        value={current.framing.zoom}
                        onChange={(e) =>
                          setSlideFraming(current.id, {
                            ...current.framing,
                            zoom: Number(e.target.value),
                          })
                        }
                        className="flex-1 accent-purple cursor-pointer"
                        aria-label="Zoom do enquadramento"
                      />
                      <span className="text-[11.5px] text-ink-muted w-10 text-right tabular-nums">
                        {current.framing.zoom.toFixed(2)}×
                      </span>
                      <button
                        type="button"
                        onClick={() => setSlideFraming(current.id, { ...DEFAULT_FRAMING })}
                        disabled={isDefaultFraming(current.framing)}
                        className="text-[11.5px] font-semibold text-purple hover:underline disabled:text-ink-muted disabled:no-underline cursor-pointer disabled:cursor-default flex-none"
                      >
                        Centralizar
                      </button>
                    </div>
                  );
                })()}

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
                      className={SELECT_CLASS_FILLED}
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
                      className={SELECT_CLASS_FILLED}
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

              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-ink-soft">
                  Título do conteúdo <span className="font-normal text-ink-muted">(opcional)</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Lançamento coleção verão"
                  maxLength={120}
                  className={inputCls}
                />
                <p className="text-[11.5px] text-ink-muted">
                  Usado no Calendário e na fila de publicação. Sem título, usamos o início da legenda.
                </p>
              </div>

              {/*
                TRÊS AÇÕES DO MESMO FLUXO — Salvar / Programar / Publicar agora.
                Todas passam pelas rotas que JÁ existem (/api/drafts,
                /api/calendar/schedule-from-draft, /api/publishing). O client
                nunca chama a Meta.
              */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border-soft mt-1">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={loading || publishing || scheduling}
                  className="gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar rascunho
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setScheduleOpen(true)}
                  disabled={loading || publishing || scheduling || !caption.trim()}
                  className="gap-2"
                >
                  <CalendarClock size={16} /> Programar publicação
                </Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={loading || publishing || scheduling || !caption.trim() || !publishablePlatform}
                  className="gap-2"
                  title={
                    publishablePlatform
                      ? undefined
                      : "A publicação real está disponível para Instagram e TikTok."
                  }
                >
                  {publishing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Publicar agora
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

            {/* O mockup agora vem de `PreviewFrame`, que muda a PROPORÇÃO por
                formato (4:5 no feed, 9:16 em Reel/Story) e aplica o
                enquadramento escolhido. Antes a proporção era fixa e o formato
                só trocava um rótulo. */}
            <PreviewFrame
              format={format as "post" | "reel" | "story" | "carrossel"}
              slides={slides}
              activeIndex={activeSlide}
              onIndexChange={setActiveSlide}
              onFramingChange={setSlideFraming}
              caption={caption}
              tags={tags}
            />

            <p className="text-[12px] text-ink-muted text-center max-w-[280px]">
              Apenas pré-visualização local. Nada é publicado nem enviado a
              Meta/TikTok.
            </p>
          </div>
        </div>
      )}

      {/* ---------- CONFIRMAÇÃO DE PUBLICAÇÃO — nunca publica em silêncio ---------- */}
      <Modal
        open={confirmOpen}
        onClose={() => (publishing ? undefined : setConfirmOpen(false))}
        title={`Publicar agora no ${platformLabel}?`}
        description="Confira a prévia antes de enviar. A publicação é real e aparece no seu perfil."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded-[12px] overflow-hidden bg-surface grid place-items-center flex-none">
              {mediaUrl ? (
                mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="Prévia da mídia" className="w-full h-full object-cover" />
                ) : (
                  <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline />
                )
              ) : (
                <ImageIcon size={22} className="text-ink-muted" />
              )}
            </div>
            <div className="min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple">
                  {platformLabel}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {formatLabel}
                </span>
              </div>
              <p className="text-[13px] text-ink leading-snug line-clamp-4 whitespace-pre-wrap break-words">
                {caption.trim() || "Sem legenda"}
              </p>
            </div>
          </div>

          {mediaOversize && (
            <div className="flex items-start gap-2 rounded-[10px] bg-warn/10 border border-warn/30 p-2.5">
              <AlertTriangle size={15} className="text-warn flex-none mt-0.5" />
              <p className="text-[12px] text-ink-soft">
                A mídia é grande demais para ir ao banco e seria enviada sem o arquivo.
                A publicação real exige uma URL pública — reenvie um arquivo menor.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={publishing}>
              Cancelar
            </Button>
            <Button onClick={handlePublishNow} disabled={publishing} className="gap-2">
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {publishing
                ? platform === "instagram"
                  ? "Enviando para o Instagram…"
                  : "Enviando para publicação…"
                : "Publicar agora"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------- SELETOR DA BIBLIOTECA ----------
          `multiple` segue o FORMATO: carrossel aceita várias; Post/Story/Reel
          aceitam uma. Reel pede só vídeo. */}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple={format === "carrossel"}
        onlyType={format === "reel" ? "VIDEO" : undefined}
        onConfirm={addFromLibrary}
      />

      {/* ---------- PROGRAMAR — grava o rascunho e cria o PlannedContent ---------- */}
      <Modal
        open={scheduleOpen}
        onClose={() => (scheduling ? undefined : setScheduleOpen(false))}
        title="Programar publicação"
        description="O conteúdo vai para o Calendário com a mídia já vinculada. Nada é enviado à rede agora."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-ink-soft">Data e hora</label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className={inputCls}
            />
            <p className="text-[11.5px] text-ink-muted">
              {platformLabel} · {formatLabel}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setScheduleOpen(false)} disabled={scheduling}>
              Cancelar
            </Button>
            <Button onClick={handleSchedule} disabled={scheduling || !scheduleAt} className="gap-2">
              {scheduling ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
              {scheduling ? "Programando..." : "Programar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------- POSTADOS — conteúdos REAIS do calendário ---------- */}
      {view === "postados" && (
        <div className="flex flex-col gap-3">
          {posted.length === 0 ? (
            <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
              <EmptyState
                icon={Send}
                title="Nada publicado ainda"
                description="Quando você publicar pelo app, o conteúdo aparece aqui com a data e o link real do Instagram."
              />
            </div>
          ) : postingLoad ? (
            /* Esqueleto enquanto a lista real chega — não inventamos conteúdo
               para "encher" a aba. */
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-[12px] border border-border-soft bg-card p-3 flex items-center gap-3 animate-pulse"
                >
                  <span className="w-12 h-12 rounded-[10px] bg-surface flex-none" />
                  <span className="flex-1 h-3 bg-surface rounded" />
                </div>
              ))}
            </div>
          ) : (
            posted.map((p) => <PostedRow key={p.id} item={p} />)
          )}
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
            <div className="flex flex-col gap-2.5">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="rounded-[12px] border border-border-soft bg-bg-ice px-3 py-2.5 flex items-center gap-3"
                >
                  {d.mediaUrl ? (
                    d.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.mediaUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-[10px] object-cover flex-none"
                      />
                    ) : (
                      <video
                        src={d.mediaUrl}
                        className="w-12 h-12 rounded-[10px] object-cover flex-none"
                        muted
                      />
                    )
                  ) : (
                    <span className="w-12 h-12 rounded-[10px] bg-surface grid place-items-center text-ink-muted flex-none">
                      <ImageIcon size={18} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    {d.caption && (
                      <p className="text-[12.5px] text-ink leading-snug line-clamp-1 whitespace-pre-wrap break-words">
                        {d.caption}
                      </p>
                    )}
                    <p className="text-[11.5px] text-ink-muted mt-0.5">
                      {FORMATS.find((f) => f.id === d.format)?.label ?? d.format}
                    </p>
                  </div>
                  <button
                    onClick={() => loadDraft(d)}
                    className="text-[12px] font-semibold text-purple hover:underline cursor-pointer flex-none"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="p-1.5 rounded-[8px] text-ink-muted hover:text-danger cursor-pointer flex-none"
                    aria-label="Excluir rascunho"
                  >
                    <Trash2 size={15} />
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
/**
 * Linha de um conteúdo REALMENTE publicado.
 *
 * `externalId` é o id do objeto na Meta — o link para o post no Instagram só é
 * montado quando ele existe. Sem `externalId` não há link: inventar uma URL
 * levaria a uma página 404 disfarçada de "ver no Instagram".
 */
function PostedRow({ item }: { item: PostedItem }) {
  const quando = item.publishedAt
    ? new Date(item.publishedAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const formato = item.format === "legenda" ? "post" : item.format;

  return (
    <div className="rounded-[12px] border border-border-soft bg-card px-3 py-2.5 flex items-center gap-3">
      {item.draftMediaUrl ? (
        item.draftMediaType === "video" ? (
          <video src={item.draftMediaUrl} className="w-12 h-12 rounded-[10px] object-cover flex-none" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.draftMediaUrl} alt="" className="w-12 h-12 rounded-[10px] object-cover flex-none" />
        )
      ) : (
        <span className="w-12 h-12 rounded-[10px] bg-surface grid place-items-center text-ink-muted flex-none">
          <ImageIcon size={18} />
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-ink font-medium leading-snug line-clamp-1 break-words">
          {item.draftCaption || item.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge tone="success" size="xs">
            Publicado
          </Badge>
          <span className="text-[11px] text-ink-muted">
            {FORMATS.find((f) => f.id === formato)?.label ?? formato}
          </span>
          {quando && <span className="text-[11px] text-ink-muted">· {quando}</span>}
        </div>
      </div>

      {item.externalId && (
        <a
          href={`https://www.instagram.com/p/${item.externalId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-semibold text-purple hover:underline flex-none"
        >
          Ver
        </a>
      )}
    </div>
  );
}

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
