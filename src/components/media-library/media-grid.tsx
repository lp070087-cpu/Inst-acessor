"use client";

import * as React from "react";
import { Check, Film, ImageIcon, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MediaAssetView } from "@/lib/media-library";

/**
 * GRADE DA BIBLIOTECA — leve de propósito
 * =======================================
 * Duas decisões que existem para a grade não pesar:
 *
 * 1. VÍDEO NÃO BAIXA O ARQUIVO. O `<video>` recebe só `preload="metadata"` e
 *    um `poster` quando a URL é de imagem. Sem isso, uma grade com 24 vídeos
 *    dispararia 24 downloads de arquivo inteiro só para desenhar miniaturas —
 *    era o cenário a evitar num celular em rede móvel. Nada de `autoPlay`.
 *
 * 2. IMAGEM CARREGA SOB DEMANDA. `loading="lazy"` + `decoding="async"`: o
 *    navegador só busca o que está perto de aparecer na tela.
 *
 * A grade em si é CSS (`aspect-square` + `grid`), sem cálculo de posição em JS
 * — não há re-render por rolagem.
 */

export interface MediaGridProps {
  items: MediaAssetView[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  /** Quando true, o clique abre em vez de selecionar (uso no seletor). */
  onOpen?: (item: MediaAssetView) => void;
  /** Mostra o rótulo de data/uso sob a miniatura. */
  showMeta?: boolean;
}

/** Formata bytes para o rótulo do item. */
function humanSize(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaTile({
  item,
  selected,
  onToggle,
  onOpen,
  showMeta,
}: {
  item: MediaAssetView;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen?: (item: MediaAssetView) => void;
  showMeta?: boolean;
}) {
  const isVideo = item.type === "VIDEO";
  const size = humanSize(item.size);
  const quando = new Date(item.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => (onOpen ? onOpen(item) : onToggle(item.id))}
        aria-pressed={onOpen ? undefined : selected}
        aria-label={`${item.title ?? item.originalName ?? "Mídia"}${selected ? " (selecionada)" : ""}`}
        /* Menos borda: o card é a PRÓPRIA mídia. A moldura só aparece no hover
           ou quando selecionado — a grade fica visual, não uma tabela de caixas. */
        className={cn(
          "relative block w-full aspect-square overflow-hidden rounded-[14px] bg-surface cursor-pointer transition-all",
          "ring-offset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/60",
          selected
            ? "ring-[2.5px] ring-purple"
            : "ring-1 ring-border-soft/60 hover:ring-border"
        )}
      >
        {isVideo ? (
          <video
            src={item.url}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.title ?? item.originalName ?? "Mídia"}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        )}

        {/* Indicador de vídeo — canto inferior, discreto. */}
        {isVideo && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-semibold text-white">
            <Film size={11} />
            Vídeo
          </span>
        )}

        {/* Seleção: círculo no canto. Some quando não selecionado e sem hover,
            para não poluir a grade. */}
        {!onOpen && (
          <span
            className={cn(
              "absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center transition-opacity",
              selected
                ? "bg-purple text-white opacity-100"
                : "bg-white/85 text-transparent opacity-0 group-hover:opacity-100"
            )}
          >
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </button>

      {showMeta && (
        <p className="mt-1.5 px-0.5 text-[11px] text-ink-muted truncate">
          {quando}
          {size ? ` · ${size}` : ""}
        </p>
      )}
    </div>
  );
}

/** Esqueleto da grade — mesma proporção dos itens, para não haver salto. */
export function MediaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-[14px] bg-surface animate-pulse"
        />
      ))}
    </div>
  );
}

export function MediaGrid({ items, selectedIds, onToggle, onOpen, showMeta }: MediaGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
      {items.map((item) => (
        <MediaTile
          key={item.id}
          item={item}
          selected={selectedIds.has(item.id)}
          onToggle={onToggle}
          onOpen={onOpen}
          showMeta={showMeta}
        />
      ))}
    </div>
  );
}

/** Botão de "carregar mais" com estado de carregamento. */
export function LoadMoreButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-pill border border-border-soft bg-card px-4 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink hover:border-border transition-colors cursor-pointer disabled:opacity-60"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? "Carregando..." : "Carregar mais"}
      </button>
    </div>
  );
}

export { ImageIcon };
