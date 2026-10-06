"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Trash2,
  X,
  AlertTriangle,
  Images,
  LayoutGrid,
  Film,
  ImageIcon as ImageIconLucide,
  Sparkles,
  RefreshCw,
  CircleDashed,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { MediaGrid, MediaGridSkeleton, LoadMoreButton } from "./media-grid";
import { uploadMediaBatch, type UploadItem } from "@/lib/ai/services/media-library-client";
import type { MediaAssetView } from "@/lib/media-library";

/**
 * BIBLIOTECA DE MÍDIA
 * ===================
 * O usuário envia fotos e vídeos UMA VEZ e reaproveita em vários conteúdos. O
 * arquivo passa a ter existência própria em vez de viver amarrado a um rascunho
 * (era o que fazia a mesma foto ser reenviada a cada conteúdo novo).
 *
 * Fluxo: dispositivo → Biblioteca → Preview Social → Calendário → Publicação.
 *
 * O QUE ESTA TELA NÃO FAZ, de propósito:
 *   - não pede acesso permanente à galeria do aparelho (usa o seletor nativo
 *     de arquivos, que já permite múltipla seleção onde o sistema suporta);
 *   - não carrega o acervo inteiro de uma vez (página de 24, com "carregar mais");
 *   - não baixa vídeo para montar a miniatura (só metadata);
 *   - não apaga arquivo que ainda esteja em uso (a API devolve 409 e explica).
 */

type FilterId = "all" | "IMAGE" | "VIDEO" | "unused";

const FILTERS: { id: FilterId; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Todas", icon: LayoutGrid },
  { id: "IMAGE", label: "Fotos", icon: ImageIconLucide },
  { id: "VIDEO", label: "Vídeos", icon: Film },
  { id: "unused", label: "Não utilizados", icon: CircleDashed },
];

interface MediaLibraryProps {
  userId: string;
}

export function MediaLibrary({ userId }: MediaLibraryProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [items, setItems] = React.useState<MediaAssetView[]>([]);
  const [counts, setCounts] = React.useState({ all: 0, image: 0, video: 0 });
  const [filter, setFilter] = React.useState<FilterId>("all");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number; current: string | null }>({
    done: 0,
    total: 0,
    current: null,
  });
  const [failed, setFailed] = React.useState<{ id: string; file: File; error: string }[]>([]);

  const fileRef = React.useRef<HTMLInputElement>(null);
  // Trava de concorrência: `loadingRef` evita disparar duas buscas se o efeito
  // rodar de novo antes de a primeira responder (StrictMode em dev faz isso).
  const loadingRef = React.useRef(false);

  /** Busca uma página. `reset` recomeça da primeira (troca de filtro). */
  const fetchPage = React.useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (opts.reset) {
        setLoading(true);
        setLoadError(false);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams();
        // "unused" é um EIXO DIFERENTE de tipo: combina com "all" (não é um
        // tipo de mídia). Por isso não entra no parâmetro `type`.
        if (filter === "IMAGE" || filter === "VIDEO") params.set("type", filter);
        if (filter === "unused") params.set("unused", "1");
        if (!opts.reset && cursor) params.set("before", cursor);

        const res = await fetch(`/api/media-library?${params.toString()}`);
        if (!res.ok) throw new Error("falha");
        const data = (await res.json()) as {
          items: MediaAssetView[];
          nextCursor: string | null;
          total: number;
        };

        setItems((prev) => (opts.reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, cursor]
  );

  /** Primeira carga e troca de filtro. */
  React.useEffect(() => {
    setSelected(new Set());
    setCursor(null);
    void fetchPage({ reset: true });
    // `filter` é a dependência real; `fetchPage` muda com ela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  /** Contagens das abas — uma vez, e depois de cada mutação. */
  const refreshCounts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/media-library?counts=1");
      if (!res.ok) return;
      const data = (await res.json()) as { counts: { all: number; image: number; video: number } };
      setCounts(data.counts);
    } catch {
      /* rótulo é acessório: não vale interromper a tela por ele */
    }
  }, []);

  React.useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedItems = React.useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected]
  );

  /** ---- upload em lote ---- */
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    // Permite escolher o MESMO arquivo de novo depois.
    if (fileRef.current) fileRef.current.value = "";
    if (list.length === 0) return;

    setUploading(true);
    setFailed([]);

    const outcomes = await uploadMediaBatch(list, userId, {
      onItem: () => {
        /* o progresso agregado já é mostrado por `onProgress` */
      },
      onProgress: (p) => setProgress(p),
    });

    const falhas = outcomes
      .filter((o) => !o.ok)
      .map((o, i) => ({
        id: o.id,
        // Reassocia o arquivo pelo índice original do lote.
        file: list[i],
        error: o.error ?? "Falha no envio.",
      }))
      .filter((f) => f.file);

    setFailed(falhas);
    setUploading(false);

    const okCount = outcomes.filter((o) => o.ok).length;
    if (okCount > 0) {
      toast(`${okCount} ${okCount === 1 ? "mídia enviada" : "mídias enviadas"}.`);
      setCursor(null);
      await fetchPage({ reset: true });
      await refreshCounts();
    }
    if (falhas.length > 0) {
      toast(
        `${falhas.length} ${falhas.length === 1 ? "arquivo falhou" : "arquivos falharam"}.`,
        "error"
      );
    }
  }

  /** ---- excluir selecionadas ---- */
  async function deleteSelected() {
    if (selectedItems.length === 0) return;

    const confirmed = window.confirm(
      selectedItems.length === 1
        ? "Excluir esta mídia da biblioteca?"
        : `Excluir ${selectedItems.length} mídias da biblioteca?`
    );
    if (!confirmed) return;

    let bloqueadas = 0;
    let excluidas = 0;

    // Sequencial de propósito: são poucas, e em série a mensagem de bloqueio
    // fica precisa (saber QUAIS estão em uso, não só "algumas falharam").
    for (const item of selectedItems) {
      try {
        const res = await fetch(`/api/media-library?id=${encodeURIComponent(item.id)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          excluidas++;
        } else if (res.status === 409) {
          bloqueadas++;
        } else {
          bloqueadas++;
        }
      } catch {
        bloqueadas++;
      }
    }

    if (excluidas > 0) toast(`${excluidas} ${excluidas === 1 ? "mídia excluída" : "mídias excluídas"}.`);
    if (bloqueadas > 0) {
      toast(
        bloqueadas === 1
          ? "1 mídia não foi excluída: ela está em uso num rascunho."
          : `${bloqueadas} mídias não foram excluídas: estão em uso em rascunhos.`,
        "error"
      );
    }

    clearSelection();
    setCursor(null);
    await fetchPage({ reset: true });
    await refreshCounts();
  }

  /** ---- ações inteligentes: levam a seleção para o Preview Social ---- */
  function criarComSelecao(formato: "post" | "carrossel" | "reel") {
    if (selectedItems.length === 0) return;
    // A seleção viaja por sessionStorage: são poucos ids, não arquivos — o
    // Preview busca a URL real na API. Evita reenviar mídia que já está lá.
    try {
      sessionStorage.setItem(
        "inst-acessor:biblioteca-selecao",
        JSON.stringify({
          format: formato,
          ids: selectedItems.map((i) => i.id),
          urls: selectedItems.map((i) => ({ id: i.id, url: i.url, type: i.type })),
        })
      );
    } catch {
      toast("Não foi possível preparar a seleção.", "error");
      return;
    }
    router.push("/preview-social?da=biblioteca");
  }

  const filtroLabel = FILTERS.find((f) => f.id === filter)?.label ?? "Todas";

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- AÇÃO PRINCIPAL ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={onFiles}
        />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          <UploadCloud size={16} />
          Adicionar mídias
        </Button>
        <p className="text-[12.5px] text-ink-muted">
          Selecione várias fotos e vídeos de uma vez. O arquivo entra na sua biblioteca e pode ser
          reaproveitado em vários conteúdos.
        </p>
      </div>

      {/* ---------- PROGRESSO DO LOTE ---------- */}
      {uploading && progress.total > 0 && (
        <div className="rounded-[12px] border border-border-soft bg-card px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink">
              {progress.current ?? "Enviando..."}
            </span>
            <span className="text-[12px] text-ink-muted tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
          {/* Barra de progresso puramente CSS — sem re-render por animação. */}
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full bg-brand-grad transition-[width] duration-300"
              style={{
                width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-[11.5px] text-ink-muted">
            Enviando em lotes de 3 para não sobrecarregar a conexão.
          </p>
        </div>
      )}

      {/* ---------- FALHAS + RETRY ---------- */}
      {failed.length > 0 && (
        <div className="rounded-[12px] border border-danger/25 bg-danger-soft px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-danger flex-none mt-0.5" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <p className="text-[12.5px] text-ink">
              {failed.length} {failed.length === 1 ? "arquivo não foi enviado" : "arquivos não foram enviados"}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const arquivos = failed.map((f) => f.file);
                  setFailed([]);
                  setUploading(true);
                  const outcomes = await uploadMediaBatch(arquivos, userId, {
                    onItem: () => {},
                    onProgress: (p) => setProgress(p),
                  });
                  setUploading(false);
                  const ainda = outcomes
                    .filter((o) => !o.ok)
                    .map((o, i) => ({ id: o.id, file: arquivos[i], error: o.error ?? "" }))
                    .filter((f) => f.file);
                  setFailed(ainda);
                  if (ainda.length === 0) {
                    toast("Mídias enviadas.");
                    setCursor(null);
                    await fetchPage({ reset: true });
                    await refreshCounts();
                  }
                }}
                className="gap-2"
              >
                <RefreshCw size={14} /> Tentar novamente
              </Button>
              <button
                type="button"
                onClick={() => setFailed([])}
                className="text-[12.5px] text-ink-soft hover:text-ink cursor-pointer"
              >
                Dispensar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- FILTROS ---------- */}
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          // "Não utilizados" não tem contagem pré-carregada (depende dos
          // rascunhos). Mostramos o número só quando esse filtro está ativo,
          // onde a própria resposta da API trouxe o total correto.
          const count =
            f.id === "unused"
              ? filter === "unused"
                ? items.length
                : null
              : f.id === "all"
                ? counts.all
                : f.id === "IMAGE"
                  ? counts.image
                  : counts.video;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                filter === f.id
                  ? "bg-ai-soft border-purple/40 text-purple"
                  : "bg-card border-border-soft text-ink-soft hover:text-ink"
              )}
            >
              <Icon size={14} />
              {f.label}
              {count != null && <span className="text-[11.5px] opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ---------- GRADE ---------- */}
      {loading ? (
        <MediaGridSkeleton />
      ) : loadError ? (
        <div className="rounded-[14px] border border-border-soft bg-card p-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={22} className="text-danger" />
          <div>
            <p className="text-[14px] font-semibold text-ink">Não foi possível carregar a biblioteca</p>
            <p className="text-[12.5px] text-ink-muted mt-1">Verifique a conexão e tente de novo.</p>
          </div>
          <Button variant="outline" onClick={() => void fetchPage({ reset: true })} className="gap-2">
            <RefreshCw size={14} /> Tentar novamente
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] border border-border-soft bg-card p-6">
          <EmptyState
            icon={Images}
            title={filter === "all" ? "Sua biblioteca está vazia" : `Nenhuma mídia em "${filtroLabel}"`}
            description={
              filter === "all"
                ? "Adicione fotos e vídeos uma vez e reaproveite em quantos conteúdos quiser."
                : "Troque o filtro ou adicione novas mídias."
            }
          />
        </div>
      ) : (
        <>
          <MediaGrid
            items={items}
            selectedIds={selected}
            onToggle={toggleSelect}
            showMeta
          />
          {cursor && (
            <LoadMoreButton loading={loadingMore} onClick={() => void fetchPage()} />
          )}
        </>
      )}

      {/* ---------- BARRA DE AÇÃO DA SELEÇÃO ----------
          Fixa embaixo no celular (as ações não podem sair da tela) e em linha
          no desktop. */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 sm:sticky sm:inset-x-auto sm:bottom-4 sm:self-center">
          <div className="flex flex-wrap items-center gap-2 border-t border-border-soft bg-card/95 px-4 py-3 backdrop-blur sm:rounded-pill sm:border sm:shadow-brand-lg sm:px-3">
            <span className="text-[13px] font-semibold text-ink mr-1">
              {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
            </span>
            <Button
              onClick={() => criarComSelecao("post")}
              disabled={selectedItems.some((i) => i.type === "VIDEO")}
              className="gap-1.5"
              title={
                selectedItems.some((i) => i.type === "VIDEO")
                  ? "Post com uma foto. Para vídeo, use Reel."
                  : undefined
              }
            >
              <Sparkles size={14} /> Criar publicação
            </Button>
            <Button variant="outline" onClick={() => criarComSelecao("carrossel")} className="gap-1.5">
              <LayoutGrid size={14} /> Criar carrossel
            </Button>
            <Button
              variant="outline"
              onClick={() => criarComSelecao("reel")}
              disabled={!selectedItems.some((i) => i.type === "VIDEO")}
              className="gap-1.5"
              title={
                !selectedItems.some((i) => i.type === "VIDEO")
                  ? "Reel precisa de um vídeo."
                  : undefined
              }
            >
              <Film size={14} /> Criar Reel
            </Button>
            <button
              type="button"
              onClick={() => void deleteSelected()}
              className="flex items-center gap-1.5 rounded-pill border border-border-soft px-3 py-2 text-[13px] font-semibold text-danger hover:bg-danger-soft cursor-pointer"
            >
              <Trash2 size={14} /> Excluir
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto rounded-full p-2 text-ink-muted hover:text-ink cursor-pointer"
              aria-label="Limpar seleção"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
